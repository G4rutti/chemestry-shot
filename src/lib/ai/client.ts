import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
// when one Flash model is overloaded (503) or out of quota (429), move on to the next
const MODELS = [
  ...new Set([GEMINI_MODEL, "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"]),
];
let workingModel: string | undefined;
let ai: GoogleGenAI | undefined;

export const hasKey = () => !!process.env.GEMINI_API_KEY;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isModelMissing = (e: unknown) => /\b404\b|not[ _]found|not supported|unsupported model|is not available/i.test(msg(e));
const isBusy = (e: unknown) =>
  /\b(429|503)\b|overloaded|resource.?exhausted|unavailable|rate.?limit|aborted|timeout/i.test(msg(e));

async function withBackoff<T>(fn: () => Promise<T>): Promise<T> {
  for (const wait of [2000, 5000]) {
    try {
      return await fn();
    } catch (e) {
      if (!isBusy(e)) throw e;
      console.warn(`[gemini] ocupado, nova tentativa em ${wait / 1000}s:`, msg(e).slice(0, 120));
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return fn();
}

async function call(prompt: string, responseJsonSchema: unknown): Promise<string> {
  const client = (ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }));
  const order = workingModel ? [workingModel, ...MODELS.filter((m) => m !== workingModel)] : MODELS;
  let lastErr: unknown;
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
      console.warn(`[gemini] ${model} indisponível, trocando de modelo`);
      lastErr = e;
    }
  }
  throw lastErr;
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
