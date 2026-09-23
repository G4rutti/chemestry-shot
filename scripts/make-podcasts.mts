// One-off, run locally (Vercel is read-only): writes a two-host podcast per topic.
//   npx tsx --env-file=.env scripts/make-podcasts.mts [topicId...]
// Gemini writes a fun dialogue from the topic's One Shot, Gemini TTS voices it with two natural voices,
// and it's saved as public/podcasts/<topicId>.mp3 + transcript in src/lib/podcasts.json. Existing episodes are skipped.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Mp3Encoder } from "@breezystack/lamejs";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { generateJson } from "@/lib/ai/client";
import { oneShot } from "@/lib/ai/pipeline";
import { getStudy } from "@/lib/store";
import type { OneShot } from "@/lib/types";

const HOSTS = { Lia: "Leda", Beto: "Puck" } as const; // speaker -> Gemini prebuilt voice
const TTS_MODELS = ["gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];
const RATE = 24000; // Gemini TTS returns 16-bit mono PCM at 24 kHz
const INDEX = "src/lib/podcasts.json";

const scriptSchema = z.object({
  lines: z.array(z.object({ speaker: z.enum(["Lia", "Beto"]), text: z.string() })).min(8),
});
type Line = z.infer<typeof scriptSchema>["lines"][number];

const scriptPrompt = (s: OneShot) => `Escreva o roteiro de um episódio curto de podcast em português do Brasil sobre "${s.title}", para alunos que têm prova de Química HOJE.
Apresentadores: Lia (animada, faz perguntas e piadas) e Beto (explica com analogias do dia a dia, também engraçado). Clima de dois amigos gravando, energia de locutor de rádio, bem natural e divertido, com risadas e reações curtas ("Nossa!", "Não acredito!").
Regras:
- 16 a 26 falas curtas, no máximo ~420 palavras no total (uns 3 minutos).
- Cubra: o essencial, os conceitos, as pegadinhas, como reconhecer na prova e o exemplo resolvido passo a passo.
- Química 100% correta, baseada SOMENTE no resumo abaixo. Escreva fórmulas e símbolos por extenso como se fala (ex.: "um s dois", "H dois O", "mol por litro").
- Comece com uma vinheta tipo "Tá no ar o Chemistry Shot!" e termine chamando pra praticar no app.

RESUMO:
${JSON.stringify(s)}`;

/** Fallback when the text model is out of quota: a fixed two-host dialogue built from the One Shot. */
function templateScript(s: OneShot): Line[] {
  const L = (text: string): Line => ({ speaker: "Lia", text });
  const B = (text: string): Line => ({ speaker: "Beto", text });
  const asks = ["Beleza, Beto, o que eu PRECISO saber?", "Anotado! E o que mais?", "Isso cai, né? Manda mais!"];
  return [
    L("Tá no ar o Chemistry Shot! Eu sou a Lia."),
    B(`E eu sou o Beto! Hoje o papo é ${s.title}. Prova hoje, então bora direto ao ponto!`),
    ...s.essentials.flatMap((e, i) => [L(asks[i] ?? "E tem mais?"), B(e)]),
    ...s.concepts.flatMap((c) => [L(`Me explica ${c.name} do jeito mais simples possível.`), B(c.explanation)]),
    ...s.formulas.map((f) => B(`Anota essa fórmula: ${f.formula}. ${f.meaning}. Quando usar? ${f.whenToUse}`)),
    L("Agora a parte que o professor AMA: as pegadinhas!"),
    ...s.traps.map((t) => B(`Cuidado: ${t}`)),
    ...s.recognitionPatterns.flatMap((r) => [L("E como eu sei que a questão é desse assunto?"), B(r)]),
    L(`Bora de exercício! ${s.solvedExample.question}`),
    B(s.solvedExample.steps.join(" ")),
    L(`Então a resposta é: ${s.solvedExample.answer}!`),
    B("Isso aí! Agora corre pro app e pratica esse tópico."),
    L("Valeu, galera! Boa prova!"),
  ];
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const STYLE = "podcast brasileiro, animado e descontraído, sorriso na voz, ritmo dinâmico, bem natural";

// gemini-3.x TTS takes one part per line tagged with speechMetadata; 2.5 takes a "Speaker: text" script
const ttsContents = (model: string, lines: Line[]) =>
  model.startsWith("gemini-2.5")
    ? `Leia em português do Brasil como um ${STYLE}:\n\n` + lines.map((l) => `${l.speaker}: ${l.text}`).join("\n")
    : [{ role: "user", parts: lines.map((l) => ({ text: l.text, speechMetadata: { speaker: l.speaker, style: STYLE } })) }];

async function speak(lines: Line[]): Promise<Int16Array> {
  let lastErr: unknown;
  for (const model of TTS_MODELS)
    for (const wait of [5000, 20000, 60000]) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents: ttsContents(model, lines),
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: Object.entries(HOSTS).map(([speaker, voiceName]) => ({ speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName } } })),
              },
            },
          },
        });
        const b64 = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
        if (!b64) throw new Error("TTS sem áudio na resposta");
        const buf = Buffer.from(b64, "base64");
        return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (/\b404\b|not found/i.test(msg)) break; // try next model
        if (!/\b(429|500|503)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded/i.test(msg)) throw e;
        console.warn(`  [tts] ${model}: ${msg.slice(0, 100)} — nova tentativa em ${wait / 1000}s`);
        await sleep(wait);
      }
    }
  throw lastErr;
}

function mp3(pcm: Int16Array): Buffer {
  const enc = new Mp3Encoder(1, RATE, 64);
  const out: Buffer[] = [];
  const push = (b: Uint8Array) => out.push(Buffer.from(b.buffer, b.byteOffset, b.byteLength)); // lamejs yields Int8Array
  for (let i = 0; i < pcm.length; i += 1152) push(enc.encodeBuffer(pcm.subarray(i, i + 1152)));
  push(enc.flush());
  return Buffer.concat(out);
}

const data = await getStudy();
if (!data) throw new Error("Sem data/study.json: processe os materiais primeiro.");
const only = process.argv.slice(2);
type Episode = { lines: Line[]; seconds: number; script: "ai" | "template" };
const index: Record<string, Episode> = JSON.parse(await readFile(INDEX, "utf8").catch(() => "{}"));
await mkdir("public/podcasts", { recursive: true });

for (const topic of data.topics) {
  // template episodes are redone on the next run, hoping the text quota is back
  if (only.length ? !only.includes(topic.id) : index[topic.id]?.script === "ai") continue;
  try {
    console.log(`▶ ${topic.name}`);
    const shot = await oneShot(topic.id); // generates + saves the One Shot if it's missing
    let script = "ai" as Episode["script"]; // widened: reassigned inside the catch callback
    const lines = await generateJson(scriptPrompt(shot), scriptSchema)
      .then((r) => r.lines)
      .catch((e) => {
        console.warn(`  roteiro por IA indisponível (${String(e).slice(0, 80)}), usando roteiro padrão`);
        script = "template";
        return templateScript(shot);
      });
    if (script === "template" && index[topic.id]?.script === "template" && !only.length) continue; // nothing new to gain
    // one call for the whole dialogue: multi-speaker TTS rejects chunks where only one host speaks
    const pcm = await speak(lines);
    await writeFile(`public/podcasts/${topic.id}.mp3`, mp3(pcm));
    index[topic.id] = { lines, seconds: Math.round(pcm.length / RATE), script };
    await writeFile(INDEX, JSON.stringify(index, null, 2) + "\n");
    console.log(`  ok (${script}): ${lines.length} falas, ${index[topic.id].seconds}s`);
  } catch (e) {
    console.log(`  FALHOU: ${e instanceof Error ? e.message.slice(0, 500) : e}`);
  }
}
