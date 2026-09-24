// Shared contracts. Server (materials/ai/api) produces these; client (engine/UI) consumes them.

export const DEFAULT_SUBJECT = "quimica";

/** A subject = one folder docs/<id>/ (optional docs/<id>/subject.json) with its own data/<id>/. */
export type Subject = {
  id: string; // folder slug, e.g. "quimica"
  name: string;
  exam: string; // e.g. "AV1"
  course?: string;
  language?: string;
  profile?: string; // AI-written: kind of content (conceptual, calculation, code) and exam style
};

export type MaterialChunk = {
  id: string; // `${documentId}-${index}`
  documentId: string; // short hash of file content
  documentName: string;
  page?: number; // PDF page, PPTX slide or notebook cell number
  text: string;
  admin?: boolean; // contacts, grading, attendance...: never becomes a topic or question
};

export type Topic = {
  id: string; // slug, e.g. "equilibrio-quimico"
  name: string;
  summary: string;
  examImportance: 1 | 2 | 3 | 4 | 5;
  keyPoints: string[];
  chunkIds: string[]; // chunks relevant to this topic (used to build One Shot / more questions)
};

export type QuestionType = "multiple-choice" | "true-false" | "fill" | "calculation";

export type Question = {
  id: string;
  topicId: string;
  type: QuestionType;
  question: string;
  options?: string[]; // multiple-choice: 4-5 options; true-false: ["Verdadeiro","Falso"]
  correctAnswer: string; // for multiple-choice/true-false: exactly one of options
  explanation: string;
  memoryTip: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  source: { document: string; page?: number };
  code?: string; // snippet shown with the question ("what does it print?", fill-in-the-blank ___ inside it)
};

export type Flashcard = { id: string; topicId: string; front: string; back: string; code?: string };

export type OneShot = {
  topicId: string;
  title: string;
  essentials: string[];
  concepts: { name: string; explanation: string }[];
  // variables: legend for each symbol; missing in one-shots generated before it existed
  formulas: { formula: string; meaning: string; whenToUse: string; variables?: { symbol: string; meaning: string }[] }[];
  traps: string[];
  recognitionPatterns: string[];
  solvedExample: { question: string; steps: string[]; answer: string };
};

export type StudyData = {
  version: string; // hash of all document hashes; changes when materials change
  createdAt: string;
  demo: boolean; // true = mock dataset (no GEMINI_API_KEY)
  subject?: Subject; // missing in data generated before multi-subject
  documents: { id: string; name: string }[];
  topics: Topic[];
  questions: Question[];
  flashcards: Flashcard[];
};

// ---- client-side progress (localStorage) ----

export type TopicStats = { seen: number; correct: number; mastery: number /* 0..1 */; lastSeen: number };

export type QuestionStats = {
  attempts: number;
  correct: number;
  lastSeen: number; // epoch ms
  lastCorrect: boolean;
  due: number; // epoch ms, simplified spaced repetition
};

export type Mistake = { questionId: string; answer: string; at: number; resolved: boolean };

export type Progress = {
  xp: number;
  streak: number; // consecutive correct answers
  bestStreak: number;
  topics: Record<string, TopicStats>;
  questions: Record<string, QuestionStats>;
  mistakes: Mistake[]; // one entry per question (latest wrong answer); resolved=true after answered correctly later
};

export type StudyMode = "cram" | "topic" | "mistakes";
