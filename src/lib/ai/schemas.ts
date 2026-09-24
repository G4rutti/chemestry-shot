import { z } from "zod";
import { hasPII } from "@/lib/materials/extract";
import type { Flashcard, OneShot, Question, Topic } from "@/lib/types";

export const topicsSchema = z.object({
  topics: z.array(
    z.object({
      name: z.string(),
      summary: z.string(),
      examImportance: z.number(),
      keyPoints: z.array(z.string()),
      chunkIds: z.array(z.string()),
    }),
  ),
  subject: z.object({ name: z.string(), course: z.string(), profile: z.string() }).optional(),
});

const questionSchema = z.object({
  type: z.enum(["multiple-choice", "true-false", "fill", "calculation"]),
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.string(),
  explanation: z.string(),
  memoryTip: z.string(),
  difficulty: z.number(),
  source: z.object({ document: z.string(), page: z.number().optional() }),
  code: z.string().optional(),
});

const flashcardSchema = z.object({ front: z.string(), back: z.string(), code: z.string().optional() });

export const questionsSchema = z.object({ questions: z.array(questionSchema) });
export const topicContentSchema = z.object({ questions: z.array(questionSchema), flashcards: z.array(flashcardSchema) });

export const oneShotSchema = z.object({
  title: z.string(),
  essentials: z.array(z.string()),
  concepts: z.array(z.object({ name: z.string(), explanation: z.string() })),
  formulas: z.array(
    z.object({
      formula: z.string(),
      meaning: z.string(),
      whenToUse: z.string(),
      variables: z.array(z.object({ symbol: z.string(), meaning: z.string() })),
    }),
  ),
  traps: z.array(z.string()),
  recognitionPatterns: z.array(z.string()),
  solvedExample: z.object({ question: z.string(), steps: z.array(z.string()), answer: z.string() }),
});

const clamp5 = (n: number) => Math.min(5, Math.max(1, Math.round(n || 3))) as 1 | 2 | 3 | 4 | 5;
const rid = () => crypto.randomUUID().slice(0, 8);
const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || rid();

export function normalizeTopics(raw: z.infer<typeof topicsSchema>, validChunkIds: Set<string>): Topic[] {
  const seen = new Set<string>();
  return raw.topics.flatMap((t) => {
    const chunkIds = [...new Set(t.chunkIds.filter((id) => validChunkIds.has(id)))];
    let id = slug(t.name);
    while (seen.has(id)) id += "-2";
    seen.add(id);
    if (!chunkIds.length) return [];
    return [{ id, name: t.name, summary: t.summary, examImportance: clamp5(t.examImportance), keyPoints: t.keyPoints, chunkIds }];
  });
}

const TF = ["Verdadeiro", "Falso"];

const FENCE = /```\w*\n?([\s\S]*?)(?:```|$)/;
const cleanCode = (s?: string) => (s ?? "").replace(/^\s*```\w*\n?|\n?```\s*$/g, "").replace(/^\n+|\s+$/g, "");

/** Code importing a module the material never uses is an invented API ("keras" in a course without keras). */
const inventsApi = (code: string, material?: string) =>
  !!material && [...code.matchAll(/^\s*(?:from|import)\s+(\w+)/gm)].some((m) => !new RegExp(`\\b${m[1]}\\b`).test(material));

const CITES_MISSING = /\b(c[óo]digo|script|tabela|gr[áa]fico|figura)\s+(abaixo|a seguir|seguinte)|\bseguinte\s+(c[óo]digo|script|tabela|gr[áa]fico)/i;

/** `material`: topic material + course code, used to reject code with invented imports. */
export function normalizeQuestions(raw: z.infer<typeof questionSchema>[], topicId: string, material?: string): Question[] {
  return raw.flatMap((q) => {
    // code belongs in `code`, not pasted into the question as a ``` block
    const code = cleanCode(q.code) || cleanCode(q.question.match(FENCE)?.[1]);
    const base = {
      id: `${topicId}-${rid()}`,
      topicId,
      type: q.type,
      question: q.question.replace(new RegExp(FENCE.source, "g"), "").trim(),
      explanation: q.explanation,
      memoryTip: q.memoryTip,
      difficulty: clamp5(q.difficulty),
      source: q.source.page ? { document: q.source.document, page: q.source.page } : { document: q.source.document },
      ...(code && { code }),
    };
    const ans = q.correctAnswer.trim();
    if (!base.question || !ans) return [];
    if (hasPII([q.question, ...q.options, ans, q.explanation, q.memoryTip, code].join("\n"))) return []; // no phone/e-mail in study content
    if (code && inventsApi(code, material)) return [];
    if (!code && CITES_MISSING.test(base.question)) return []; // "o código abaixo" with nothing below
    if (q.type === "fill" && code && !/_{3,}/.test(code)) return []; // code fill: the blank must be in the code, or the code gives the answer away
    if (q.type === "fill" && code && /(['"])[^'"\n]*_{3,}[^'"\n]*\1/.test(code)) return []; // blank inside a string ('___' title/label): free text, just a guess
    if (q.type === "true-false") {
      const v = /^(v|verdadeir|true|certo|c$)/i.test(ans) ? TF[0] : /^(f|fals|errado|e$)/i.test(ans) ? TF[1] : null;
      return v ? [{ ...base, options: TF, correctAnswer: v }] : [];
    }
    if (q.type === "multiple-choice") {
      const options = [...new Set(q.options.map((o) => o.trim()).filter(Boolean))];
      const letter = /^[A-Ea-e]\)?$/.test(ans) ? options[ans.toUpperCase().charCodeAt(0) - 65] : undefined;
      const correct = options.find((o) => o.toLowerCase() === ans.toLowerCase()) ?? letter;
      return options.length >= 2 && correct ? [{ ...base, options, correctAnswer: correct }] : [];
    }
    return [{ ...base, correctAnswer: ans }];
  });
}

export const normalizeFlashcards = (raw: z.infer<typeof flashcardSchema>[], topicId: string, material?: string): Flashcard[] =>
  raw.flatMap(({ front, back, code: rawCode }) => {
    const code = cleanCode(rawCode);
    if (!front.trim() || !back.trim() || hasPII(`${front}\n${back}\n${code}`) || (code && inventsApi(code, material))) return [];
    return [{ id: `${topicId}-fc-${rid()}`, topicId, front, back, ...(code && { code }) }];
  });

export const normalizeOneShot = (raw: z.infer<typeof oneShotSchema>, topicId: string): OneShot => ({ topicId, ...raw });
