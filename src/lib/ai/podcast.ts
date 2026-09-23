import { Mp3Encoder } from "@breezystack/lamejs";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { OneShot } from "@/lib/types";
import { generateJson } from "./client";

// On-demand two-host podcast: a fresh AI script every time (random format, personalized with the
// student's mistakes), voiced by Gemini multi-speaker TTS and returned as MP3 bytes.

const HOSTS = { Lia: "Leda", Beto: "Puck" } as const; // speaker -> Gemini prebuilt voice
// best to oldest; free-tier quota is usually per model, so each one is another chance at a real voice
const TTS_MODELS = [
  "gemini-3.8-flash-tts",
  "gemini-3.8-flash-lite-tts",
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-pro-preview-tts",
  "gemini-2.5-flash-preview-tts",
];
// all TTS attempts share this budget so the route (maxDuration 300s, script included) never gets killed mid-way
const TTS_BUDGET_MS = 210_000;
const RATE = 24000; // Gemini TTS returns 16-bit mono PCM at 24 kHz
const BASE_STYLE = "podcast brasileiro, animado e descontraído, sorriso na voz, ritmo dinâmico, bem natural";

const FORMATS = [
  "bate-papo entre amigos, cheio de analogias do dia a dia (cozinha, futebol, balada, celular)",
  "quiz show: Lia dispara perguntas-relâmpago, Beto responde e explica, com placar e vinheta",
  "mitos e verdades: Lia traz afirmações que a galera acha, Beto desmonta ou confirma explicando",
  "história e curiosidade: começam com um fato curioso ou história real da química e ligam ao conteúdo",
  "treino pra prova: resolvem juntos, passo a passo, um exercício NOVO (diferente do exemplo do resumo)",
];

const lineSchema = z.object({
  speaker: z.enum(["Lia", "Beto"]),
  text: z.string(),
  emotion: z.string().describe('como falar essa fala, ex.: "rindo", "surpresa", "empolgado", "suspense"'),
});
const scriptSchema = z.object({ title: z.string(), lines: z.array(lineSchema).min(8) });
export type PodcastLine = z.infer<typeof lineSchema>;

const scriptPrompt = (s: OneShot, format: string, mistakes: string[]) => `Escreva o roteiro de um episódio curto de podcast em português do Brasil sobre "${s.title}", para um aluno que tem prova de Química HOJE.
Apresentadores: Lia (animada, curiosa, faz piadas) e Beto (explica bem, também engraçado). Dois amigos gravando, energia de rádio, com risadas e reações naturais.
Formato deste episódio: ${format}.
Regras:
- 14 a 22 falas curtas, no máximo ~330 palavras (uns 2 minutos).
- NÃO leia nem parafraseie o resumo abaixo: use-o só como fonte. Traga exemplos, analogias e perguntas NOVAS, diferentes das do resumo.
- Química 100% correta: confira cada afirmação antes de escrever. Na dúvida sobre um detalhe, deixe de fora.
- Não invente datas, nomes ou números históricos: só cite se tiver certeza absoluta.
- Cada fala traz algo novo: nunca repita ou parafraseie a fala anterior.
- Escreva fórmulas e símbolos por extenso como se fala ("um s dois", "H dois O", "mol por litro").
- Cubra o que mais cai na prova e pelo menos uma pegadinha.${
  mistakes.length
    ? `\n- Este aluno errou estas questões; explique esses pontos com carinho, sem dizer que ele errou:\n${mistakes.map((m) => `  • ${m}`).join("\n")}`
    : ""
}
- Dê um title criativo pro episódio. Comece com uma vinheta ("Tá no ar o Chemistry Shot!") e termine chamando pra praticar no app.
- emotion de cada fala: 1 a 3 palavras de como falar.

RESUMO (fonte):
${JSON.stringify(s)}`;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function speak(lines: PodcastLine[]): Promise<Int16Array> {
  const deadline = Date.now() + TTS_BUDGET_MS;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada");
  let lastErr: unknown = new Error("TTS: tempo esgotado");
  // newest models take one part per line tagged with speechMetadata (per-line emotion); older ones only a "Speaker: text" script
  const tagged = [{ role: "user", parts: lines.map((l) => ({ text: l.text, speechMetadata: { speaker: l.speaker, style: `${BASE_STYLE}; ${l.emotion}` } })) }];
  const script = `Leia em português do Brasil como um ${BASE_STYLE}:\n\n` + lines.map((l) => `${l.speaker}: ${l.text}`).join("\n");
  const attempts = TTS_MODELS.flatMap((model) => [
    { model, contents: tagged as unknown },
    { model, contents: tagged as unknown, retryOf: "busy" }, // a 503 on the best model is usually a short spike: one more try
    { model, contents: script as unknown, retryOf: "format" },
  ]);
  let failure: "busy" | "format" | "other" = "other";
  let last = "";
  for (const { model, contents, retryOf } of attempts) {
    const left = deadline - Date.now();
    if (left < 15_000) break; // not enough time for another try: fall back to browser voice
    if (model !== last) failure = "other";
    last = model;
    if (retryOf && retryOf !== failure) continue;
    if (retryOf === "busy") await new Promise((r) => setTimeout(r, 4000));
    try {
      const res = await ai.models.generateContent({
        model,
        contents: contents as string,
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: Object.entries(HOSTS).map(([speaker, voiceName]) => ({ speaker, voiceConfig: { prebuiltVoiceConfig: { voiceName } } })),
            },
          },
          abortSignal: AbortSignal.timeout(Math.min(left, 150_000)),
        },
      });
      const b64 = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
      if (!b64) throw new Error("TTS sem áudio na resposta");
      const buf = Buffer.from(b64, "base64");
      console.info(`[podcast] voz gerada por ${model}${retryOf === "format" ? " (roteiro em texto)" : ""}`);
      return new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2);
    } catch (e) {
      lastErr = e;
      failure = /speech metadata is not supported/i.test(msg(e)) ? "format" : /\b503\b|high demand|overloaded/i.test(msg(e)) ? "busy" : "other";
      console.warn(`[podcast] tts ${model}${retryOf ? ` (retry ${retryOf})` : ""} falhou:`, msg(e).slice(0, 150));
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

export type Podcast = { title: string; format: string; lines: PodcastLine[]; seconds: number; mp3: Buffer | null; ttsError?: string };

/** Script always comes back; audio is null when TTS is unavailable (the client then falls back to browser speech). */
export async function makePodcast(shot: OneShot, mistakes: string[]): Promise<Podcast> {
  const format = FORMATS[Math.floor(Math.random() * FORMATS.length)];
  const { title, lines } = await generateJson(scriptPrompt(shot, format, mistakes), scriptSchema);
  try {
    const pcm = await speak(lines);
    return { title, format, lines, seconds: Math.round(pcm.length / RATE), mp3: mp3(pcm) };
  } catch (e) {
    const words = lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
    return { title, format, lines, seconds: Math.round(words / 2.5), mp3: null, ttsError: msg(e).slice(0, 200) };
  }
}
