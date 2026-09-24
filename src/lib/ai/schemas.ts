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
});

const flashcardSchema = z.object({ front: z.string(), back: z.string() });

export const questionsSchema = z.object({ questions: z.array(questionSchema) });
export const topicContentSchema = z.object({ questions: z.array(questionSchema), flashcards: z.array(flashcardSchema) });

export const oneShotSchema = z.object({
  title: z.string(),
  essentials: z.array(z.string()),
  concepts: z.array(z.object({ name: z.string(), explanation: z.string() })),
  formulas: z.array(z.object({ formula: z.string(), meaning: z.string(), whenToUse: z.string() })),
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

export function normalizeQuestions(raw: z.infer<typeof questionSchema>[], topicId: string): Question[] {
  return raw.flatMap((q) => {
    const base = {
      id: `${topicId}-${rid()}`,
      topicId,
      type: q.type,
      question: q.question.trim(),
      explanation: q.explanation,
      memoryTip: q.memoryTip,
      difficulty: clamp5(q.difficulty),
      source: q.source.page ? { document: q.source.document, page: q.source.page } : { document: q.source.document },
    };
    const ans = q.correctAnswer.trim();
    if (!base.question || !ans) return [];
    if (hasPII([q.question, ...q.options, ans, q.explanation, q.memoryTip].join("\n"))) return []; // no phone/e-mail in study content
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

export const normalizeFlashcards = (raw: z.infer<typeof flashcardSchema>[], topicId: string): Flashcard[] =>
  raw.filter((f) => f.front.trim() && f.back.trim() && !hasPII(`${f.front}\n${f.back}`)).map((f) => ({ id: `${topicId}-fc-${rid()}`, topicId, ...f }));

export const normalizeOneShot = (raw: z.infer<typeof oneShotSchema>, topicId: string): OneShot => ({ topicId, ...raw });
