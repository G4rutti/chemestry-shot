import { createSign } from "node:crypto";
import { Mp3Encoder } from "@breezystack/lamejs";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { hasPII } from "@/lib/materials/extract";
import type { OneShot, Subject } from "@/lib/types";
import { generateJson } from "./client";

// On-demand two-host podcast: a fresh AI lesson script every time (random explanation angle, personalized with the
// student's mistakes), voiced by Google Cloud TTS (Gemini multi-speaker TTS as fallback) and returned as MP3 bytes.

const HOSTS = { Lia: "Leda", Beto: "Puck" } as const; // speaker -> voice (same names in Gemini TTS and Cloud TTS Chirp3-HD)
// best to oldest; free-tier quota is usually per model, so each one is another chance at a real voice
const TTS_MODELS = [
  "gemini-3.8-flash-tts",
  "gemini-3.8-flash-lite-tts",
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-pro-preview-tts",
  "gemini-2.5-flash-preview-tts",
];
// the whole request (script + review + TTS) must finish before the route's maxDuration (300s) kills it
const REQUEST_BUDGET_MS = 270_000;
const RATE = 24000; // both TTSs return 16-bit mono PCM at 24 kHz
const BASE_STYLE = "podcast brasileiro, animado e descontraído, sorriso na voz, ritmo dinâmico, bem natural";

// every episode is a lesson; the "angle" only changes HOW it's explained, so episodes differ without turning into quizzes
const ANGLES = [
  "analogias do dia a dia (cozinha, futebol, festa, celular; e, se for computação, servidor, API, app) para cada conceito",
  "começar por uma situação do cotidiano (um app que trava, uma fila no mercado, o sal derretendo o gelo) e explicar a matéria por trás dela",
  "construir o raciocínio do zero, como se o aluno nunca tivesse visto a matéria, um degrau de cada vez",
  "desenhar com palavras: descrever o que acontece, passo a passo, como se fosse um filme",
  "partir do erro mais comum dos alunos nessa matéria e mostrar o raciocínio certo",
];

const lineSchema = z.object({
  speaker: z.enum(["Lia", "Beto"]),
  text: z.string(),
  emotion: z.string().describe('como falar essa fala, ex.: "rindo", "surpresa", "empolgado", "suspense"'),
});
const scriptSchema = z.object({ title: z.string(), lines: z.array(lineSchema).min(12) });
export type PodcastLine = z.infer<typeof lineSchema>;

const scriptPrompt = (subject: Subject, s: OneShot, angle: string, mistakes: string[]) => `Escreva o roteiro de um episódio de podcast em português do Brasil que ENSINA "${s.title}" para um aluno que tem prova de ${subject.name} HOJE e ainda não entendeu bem a matéria.
Apresentadores: Beto (o professor: explica com clareza, paciência e humor) e Lia (a aluna curiosa e engraçada: interrompe com dúvidas de verdade como "pera, mas por quê?", "e como eu sei isso?", "então se eu mudar X, o que acontece?"). Dois amigos gravando, clima leve, com risadas e reações naturais.
Jeito de explicar neste episódio: ${angle}.
OBJETIVO: o aluno tem que ENTENDER a matéria. Isto é uma aula conversada, NÃO um quiz: não faça perguntas-relâmpago, placar, "verdadeiro ou falso" nem teste o ouvinte. Pelo menos 70% das falas são explicação.
Estrutura:
1. Gancho curto (1-2 falas) dizendo por que isso importa e cai na prova.
2. Explicação do conceito principal do zero, em passos: o que é, por que acontece, como funciona. Beto explica em falas de 2-4 frases; Lia pergunta o que um aluno realmente perguntaria e Beto responde explicando.
3. Os outros conceitos importantes do tópico, ligados entre si.
4. Um exemplo resolvido NOVO, narrado passo a passo com o raciocínio (não só a resposta).
5. Uma pegadinha de prova e como não cair nela.
6. Lia resume o episódio em 3 frases com as palavras dela; Beto chama pra praticar no app.
Regras:
- 18 a 28 falas, no máximo ~450 palavras (uns 3 minutos).
- NÃO leia nem parafraseie o resumo abaixo: use-o só como fonte. Traga explicações, analogias e exemplos NOVOS, diferentes dos do resumo.
- Conteúdo de ${subject.name} 100% correto: confira cada afirmação antes de escrever. Na dúvida sobre um detalhe, deixe de fora.
- Não invente datas, nomes ou números históricos: só cite se estiverem no resumo ou se tiver certeza absoluta.
- Cada fala traz algo novo: nunca repita ou parafraseie a fala anterior.
- Escreva fórmulas, símbolos, números romanos e código por extenso como se fala ("Tópicos Avançados dois", "um s dois", "H dois O", "mol por litro"; μ = "mi", σ = "sigma", C(n, k) = "N escolhe K", norm.sf = "norm ponto sf").
- Nunca leia código linha a linha: explique com palavras o que ele faz.
- Nunca cite e-mail, telefone ou contato de ninguém.
- Foque no que mais cai na prova.${
  mistakes.length
    ? `\n- Este aluno errou estas questões; explique esses pontos com carinho, sem dizer que ele errou:\n${mistakes.map((m) => `  • ${m}`).join("\n")}`
    : ""
}
- Dê um title criativo pro episódio. A primeira fala abre com a vinheta "Tá no ar o Study Shot!".
- emotion de cada fala: 1 a 3 palavras de como falar.

RESUMO (fonte):
${JSON.stringify(s)}`;

// second pass: free models write fluent scripts but slip on the content (wrong reasons, uncorrected student mistakes)
const reviewPrompt = (subject: Subject, s: OneShot, script: z.infer<typeof scriptSchema>) => `Você é um professor de ${subject.name} rigoroso revisando o roteiro de um podcast didático sobre "${s.title}".
Corrija TODO erro de conteúdo, explicação confusa ou contraditória e qualquer fala errada da Lia que o Beto deixou passar (o Beto deve corrigir na fala seguinte).
Use a explicação padrão do curso${subject.course ? ` (${subject.course})` : ""}, sem inventar nada fora do resumo.
Escreva números, números romanos, símbolos e código por extenso como se fala ("Tópicos Avançados dois", "um s dois", "mi", "sigma", "norm ponto sf"); código nunca é lido linha a linha.
Mantenha o tom, a estrutura, os apresentadores e o tamanho; mude só o necessário. Devolva o roteiro completo no mesmo formato.

RESUMO (fonte confiável):
${JSON.stringify(s)}

ROTEIRO:
${JSON.stringify(script)}`;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

let gcpToken: { value: string; until: number } | undefined;

/** OAuth token for the service account in GOOGLE_TTS_CREDENTIALS (signed JWT exchange, cached ~1h). */
async function googleToken(): Promise<string> {
  if (gcpToken && Date.now() < gcpToken.until) return gcpToken.value;
  const { client_email, private_key } = JSON.parse(process.env.GOOGLE_TTS_CREDENTIALS!) as { client_email: string; private_key: string };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claims)}`;
  const assertion = `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(private_key, "base64url")}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Google TTS auth ${res.status}: ${JSON.stringify(json).slice(0, 150)}`);
  gcpToken = { value: json.access_token, until: Date.now() + 50 * 60_000 };
  return json.access_token;
}

/** Cloud TTS (Chirp3-HD): one request per line (it has no multi-speaker mode), 5 at a time, joined with a short pause. */
async function speakGoogle(lines: PodcastLine[], deadline: number): Promise<Int16Array> {
  const token = await googleToken();
  const one = async (l: PodcastLine) => {
    const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: l.text },
        voice: { languageCode: "pt-BR", name: `pt-BR-Chirp3-HD-${HOSTS[l.speaker]}` },
        audioConfig: { audioEncoding: "LINEAR16", sampleRateHertz: RATE },
      }),
      signal: AbortSignal.timeout(Math.max(5_000, deadline - Date.now())),
    });
    const json = await res.json();
    if (!json.audioContent) throw new Error(`Google TTS ${res.status}: ${json.error?.message ?? "sem áudio"}`);
    const wav = Buffer.from(json.audioContent, "base64");
    const pcm = wav.subarray(wav.indexOf("data") + 8); // LINEAR16 comes as WAV: skip the header
    return new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  };
  const parts: Int16Array[] = [];
  for (let i = 0; i < lines.length; i += 5) parts.push(...(await Promise.all(lines.slice(i, i + 5).map(one))));
  const gap = new Int16Array(RATE / 4); // 250 ms between lines
  const out = new Int16Array(parts.reduce((n, p) => n + p.length + gap.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length + gap.length;
  }
  console.info(`[podcast] voz gerada pelo Google Cloud TTS (${lines.length} falas)`);
  return out;
}

async function speak(lines: PodcastLine[], deadline: number): Promise<Int16Array> {
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
export async function makePodcast(subject: Subject, shot: OneShot, mistakes: string[]): Promise<Podcast> {
  const format = ANGLES[Math.floor(Math.random() * ANGLES.length)];
  const start = Date.now();
  const draft = await generateJson(scriptPrompt(subject, shot, format, mistakes), scriptSchema);
  // review only if there's time left for it and the voices; a failed review keeps the draft rather than losing the episode
  const reviewed =
    Date.now() - start > 90_000
      ? draft
      : await generateJson(reviewPrompt(subject, shot, draft), scriptSchema).catch((e) => {
          console.warn("[podcast] revisão falhou, usando rascunho:", msg(e).slice(0, 120));
          return draft;
        });
  const { title } = reviewed;
  const lines = reviewed.lines.filter((l) => !hasPII(l.text)); // no phone/e-mail spoken, ever

  try {
    const deadline = start + REQUEST_BUDGET_MS;
    const pcm = process.env.GOOGLE_TTS_CREDENTIALS
      ? await speakGoogle(lines, deadline).catch((e) => {
          console.warn("[podcast] Google TTS falhou, tentando Gemini:", msg(e).slice(0, 150));
          return speak(lines, deadline);
        })
      : await speak(lines, deadline);
    return { title, format, lines, seconds: Math.round(pcm.length / RATE), mp3: mp3(pcm) };
  } catch (e) {
    const words = lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0);
    return { title, format, lines, seconds: Math.round(words / 2.5), mp3: null, ttsError: msg(e).slice(0, 200) };
  }
}
