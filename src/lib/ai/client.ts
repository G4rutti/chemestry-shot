import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

// Tiny AI router: Gemini first (native structured output), then free OpenAI-compatible providers
// whenever Gemini is out of quota / overloaded. Each provider is used only if its key is set.

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
// when one Flash model is overloaded (503) or out of quota (429), move on to the next
const MODELS = [
  ...new Set([GEMINI_MODEL, "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"]),
];

// ponytail: free model lists are hardcoded and churn; override with OPENROUTER_MODELS / GROQ_MODELS (comma-separated)
// Groq first: fast and stable on its free tier, but its low tokens-per-minute cap rejects big prompts (fails fast -> OpenRouter).
// OpenRouter free models get rate-limited upstream a lot, so the less popular ones that answered reliably go first.
const COMPAT = [
  {
    name: "groq",
    key: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    models: ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"],
    fallbackInOneCall: false,
  },
  // NVIDIA NIM free tier (~40 RPM, no daily cap): nemotron-super answers in ~25s; glm/kimi write better questions but take ~90s
  {
    name: "nvidia",
    key: "NVIDIA_API_KEY",
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    models: ["nvidia/nemotron-3-super-120b-a12b", "z-ai/glm-5.3", "moonshotai/kimi-k3"],
    fallbackInOneCall: false,
  },
  {
    name: "openrouter",
    key: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    models: [
      "dots-studio/dots-3-note-preview:free",
      "nex-agi/nex-n2.5-pro:free",
      "z-ai/glm-5.2:free",
      "qwen/qwen3.8-27b:free",
      "google/gemma-4-31b-it:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
    ],
    fallbackInOneCall: true, // OpenRouter tries the `models` list itself
  },
  // Mistral free (Experiment) plan: small/medium/magistral come with 0 req/min; only ministral is open (14b: 30 RPM, 8b: 188 RPM).
  // Last resort: fast enough (~50s) but gets calculations wrong and forgets the code it cites
  {
    name: "mistral",
    key: "MISTRAL_API_KEY",
    url: "https://api.mistral.ai/v1/chat/completions",
    models: ["ministral-14b-latest", "ministral-8b-latest"],
    fallbackInOneCall: false,
  },
];

let workingModel: string | undefined;
let ai: GoogleGenAI | undefined;
let geminiOutUntil = 0; // skip Gemini for a while once its daily quota is gone

export const hasKey = () => !!process.env.GEMINI_API_KEY || COMPAT.some((p) => process.env[p.key]);

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isModelMissing = (e: unknown) => /\b404\b|not[ _]found|not supported|unsupported model|is not available/i.test(msg(e));
const isBusy = (e: unknown) =>
  /\b(429|503)\b|overloaded|resource.?exhausted|unavailable|rate.?limit|aborted|timeout/i.test(msg(e));
// daily/project quota: retrying the same model in seconds is pointless
const isQuota = (e: unknown) => /exceeded your current quota|quota exceeded|per.?day/i.test(msg(e));

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  // with a free fallback configured, waiting out a busy Gemini model is slower than just moving on
  if (COMPAT.some((p) => process.env[p.key])) return fn();
  for (const wait of [2000, 5000]) {
    try {
      return await fn();
    } catch (e) {
      if (!isBusy(e) || isQuota(e)) throw e;
      console.warn(`[ai] ocupado, nova tentativa em ${wait / 1000}s:`, msg(e).slice(0, 120));
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return fn();
}

async function callGemini(prompt: string, responseJsonSchema: unknown): Promise<string> {
  const client = (ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
  const order = workingModel ? [workingModel, ...MODELS.filter((m) => m !== workingModel)] : MODELS;
  let lastErr: unknown;
  let quotaHits = 0;
  for (const model of order) {
    const gen = (thinkingLevel: ThinkingLevel) =>
      withBackoff(() =>
        client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema,
            thinkingConfig: { thinkingLevel }, // free tier is slow; thinking doubles latency
            abortSignal: AbortSignal.timeout(150_000),
          },
        }),
      );
    try {
      // some models reject MINIMAL; LOW is the next cheapest
      const res = await gen(ThinkingLevel.MINIMAL).catch((e) => {
        if (/thinking level/i.test(msg(e))) return gen(ThinkingLevel.LOW);
        throw e;
      });
      workingModel = model;
      return res.text ?? "";
    } catch (e) {
      if (!isModelMissing(e) && !isBusy(e)) throw e;
      if (isQuota(e)) quotaHits++;
      console.warn(`[gemini] ${model} indisponível (${isQuota(e) ? "cota esgotada" : msg(e).slice(0, 80)}), trocando de modelo`);
      lastErr = e;
    }
  }
  // every model failed: skip Gemini for a while (long for exhausted quota, short for a demand spike)
  geminiOutUntil = Date.now() + (quotaHits >= 2 ? 15 : 3) * 60_000;
  throw lastErr;
}

/** Pulls the JSON object out of chat replies that wrap it in ```json fences or <think> blocks. */
const extractJson = (text: string) => {
  const t = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  return a >= 0 && b > a ? t.slice(a, b + 1) : t;
};

async function callCompat(p: (typeof COMPAT)[number], key: string, models: string[], prompt: string, jsonSchema: unknown): Promise<string> {
  const res = await fetch(p.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "Study Shot" },
    body: JSON.stringify({
      model: models[0],
      ...(p.fallbackInOneCall && { models }),
      messages: [
        { role: "system", content: `Responda SOMENTE com um objeto JSON válido (sem texto fora dele) que siga este JSON Schema:\n${JSON.stringify(jsonSchema)}` },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${p.name} ${res.status}: ${body.slice(0, 300)}`);
  const content = JSON.parse(body).choices?.[0]?.message?.content;
  if (!content) throw new Error(`${p.name}: resposta vazia`);
  return extractJson(content);
}

async function call(prompt: string, jsonSchema: unknown): Promise<string> {
  const errors: unknown[] = [];
  if (process.env.GEMINI_API_KEY && Date.now() > geminiOutUntil) {
    try {
      return await callGemini(prompt, jsonSchema);
    } catch (e) {
      if (!isModelMissing(e) && !isBusy(e)) throw e;
      errors.push(e);
    }
  }
  for (const p of COMPAT) {
    const key = process.env[p.key];
    if (!key) continue;
    const models = process.env[`${p.name.toUpperCase()}_MODELS`]?.split(",").map((m) => m.trim()) ?? p.models;
    // OpenRouter accepts at most 3 models per request (1 + 2 fallbacks), so chunk the list
    const batches = p.fallbackInOneCall ? Array.from({ length: Math.ceil(models.length / 3) }, (_, i) => models.slice(i * 3, i * 3 + 3)) : models.map((m) => [m]);
    for (const batch of batches) {
      try {
        const text = await callCompat(p, key, batch, prompt, jsonSchema);
        console.info(`[ai] respondido por ${p.name} (${batch[0]}${batch.length > 1 ? " +fallbacks" : ""})`);
        return text;
      } catch (e) {
        console.warn(`[ai] ${p.name} ${batch[0]} falhou:`, msg(e).slice(0, 150));
        errors.push(e);
      }
    }
  }
  throw errors.at(-1) ?? new Error("Nenhuma IA configurada: defina GEMINI_API_KEY, GROQ_API_KEY, NVIDIA_API_KEY ou OPENROUTER_API_KEY.");
}

/** Structured-output call validated by Zod; one retry on invalid JSON/schema. */
export async function generateJson<T extends z.ZodType>(prompt: string, schema: T): Promise<z.infer<T>> {
  const jsonSchema = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  for (let attempt = 0; ; attempt++) {
    const text = await call(prompt, jsonSchema);
    try {
      return schema.parse(JSON.parse(text));
    } catch (e) {
      if (attempt) throw e;
    }
  }
}
