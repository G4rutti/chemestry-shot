import type { Progress, Question, StudyData, StudyMode, Topic } from "../types";

const MIN = 60_000;

export const emptyProgress = (): Progress => ({ xp: 0, streak: 0, bestStreak: 0, topics: {}, questions: {}, mistakes: [] });

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?]+$/, "");

// "1.5e-3", "1.5 x 10^-3", "-2" at the start of the string; trailing units are ignored
const toNumber = (s: string): number | null => {
  const m = s.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)(?:\s*[x*×·]\s*10\s*\^?\s*([-+]?\d+))?/);
  return m ? Number(m[1]) * 10 ** Number(m[2] ?? 0) : null;
};

export function checkAnswer(q: Question, answer: string): boolean {
  if (q.type === "multiple-choice" || q.type === "true-false") return answer.trim() === q.correctAnswer.trim();
  const a = norm(answer);
  const c = norm(q.correctAnswer);
  if (a === c) return true;
  const na = toNumber(a);
  const nc = toNumber(c);
  if (na === null || nc === null) return false;
  return nc === 0 ? Math.abs(na) < 1e-9 : Math.abs(na - nc) <= 0.02 * Math.abs(nc);
}

export function recordAnswer(p: Progress, q: Question, answer: string, correct: boolean, now = Date.now()): Progress {
  const t = p.topics[q.topicId] ?? { seen: 0, correct: 0, mastery: 0, lastSeen: 0 };
  // hard questions move mastery more when right, easy ones more when wrong
  const alpha = 0.3 * (correct ? 0.8 + 0.1 * q.difficulty : 1.2 - 0.1 * q.difficulty);
  const prev = p.questions[q.id];
  const interval = correct && prev?.lastCorrect ? Math.max(5 * MIN, (prev.due - prev.lastSeen) * 2) : correct ? 5 * MIN : MIN;
  const streak = correct ? p.streak + 1 : 0;
  return {
    xp: p.xp + (correct ? 10 + 2 * q.difficulty : 1),
    streak,
    bestStreak: Math.max(p.bestStreak, streak),
    topics: {
      ...p.topics,
      [q.topicId]: {
        seen: t.seen + 1,
        correct: t.correct + (correct ? 1 : 0),
        mastery: t.mastery + alpha * ((correct ? 1 : 0) - t.mastery),
        lastSeen: now,
      },
    },
    questions: {
      ...p.questions,
      [q.id]: {
        attempts: (prev?.attempts ?? 0) + 1,
        correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
        lastSeen: now,
        lastCorrect: correct,
        due: now + interval,
      },
    },
    mistakes: correct
      ? p.mistakes.map((m) => (m.questionId === q.id && !m.resolved ? { ...m, resolved: true } : m))
      : [...p.mistakes.filter((m) => m.questionId !== q.id), { questionId: q.id, answer, at: now, resolved: false }],
  };
}

export const topicMastery = (p: Progress, topicId: string) => p.topics[topicId]?.mastery ?? 0;

export function calculateWeakness(topicId: string, p: Progress): number {
  const t = p.topics[topicId];
  if (!t || t.seen === 0) return 0.7;
  return 1 - (0.7 * t.mastery + 0.3 * (t.correct / t.seen));
}

const openMistakes = (p: Progress) => new Set(p.mistakes.filter((m) => !m.resolved).map((m) => m.questionId));

export function topicPriority(topic: Topic, data: StudyData, p: Progress, now = Date.now()): number {
  const qs = data.questions.filter((q) => q.topicId === topic.id);
  const open = openMistakes(p);
  const errorFrequency = qs.length ? qs.filter((q) => open.has(q.id)).length / qs.length : 0;
  const unseenContent = qs.length ? qs.filter((q) => !p.questions[q.id]).length / qs.length : 0;
  const last = p.topics[topic.id]?.lastSeen;
  const recency = last ? Math.min(1, (now - last) / (60 * MIN)) : 1;
  return (
    calculateWeakness(topic.id, p) * 0.35 +
    (topic.examImportance / 5) * 0.25 +
    errorFrequency * 0.2 +
    unseenContent * 0.15 +
    recency * 0.05
  );
}

function pickInPool(pool: Question[], p: Progress, now: number): Question | null {
  if (!pool.length) return null;
  const target = 1 + topicMastery(p, pool[0].topicId) * 4;
  const rank = (q: Question): [number, number, number] => {
    const s = p.questions[q.id];
    const near = Math.abs(q.difficulty - target);
    if (!s) return [1, near, 0];
    if (!s.lastCorrect && s.due <= now) return [0, near, s.due];
    return [2, s.lastSeen, near];
  };
  const cmp = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  return [...pool].sort((a, b) => cmp(rank(a), rank(b)))[0];
}

export function getNextQuestion(
  data: StudyData,
  p: Progress,
  opts: { mode: StudyMode; topicId?: string; exclude?: string[]; now?: number },
): Question | null {
  const now = opts.now ?? Date.now();
  const ex = new Set(opts.exclude ?? []);

  if (opts.mode === "mistakes") {
    const open = openMistakes(p);
    const qs = data.questions.filter((q) => open.has(q.id) && !ex.has(q.id));
    return qs.sort((a, b) => (p.questions[a.id]?.due ?? 0) - (p.questions[b.id]?.due ?? 0))[0] ?? null;
  }

  const inScope = opts.mode === "topic" ? data.questions.filter((q) => q.topicId === opts.topicId) : data.questions;
  if (!inScope.length) return null;
  const fresh = inScope.filter((q) => !ex.has(q.id));
  const pool = fresh.length ? fresh : inScope;
  if (opts.mode === "topic") return pickInPool(pool, p, now);

  const ranked = data.topics
    .filter((t) => pool.some((q) => q.topicId === t.id))
    .map((t) => ({ t, score: topicPriority(t, data, p, now) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (!ranked.length) return pickInPool(pool, p, now);
  const r = Math.random();
  const chosen = ranked[r < 0.6 || ranked.length === 1 ? 0 : r < 0.85 || ranked.length === 2 ? 1 : 2].t;
  return pickInPool(pool.filter((q) => q.topicId === chosen.id), p, now);
}

export function buildCramSession(data: StudyData, p: Progress, size = 15, now = Date.now()): Question[] {
  const out: Question[] = [];
  while (out.length < size) {
    const q = getNextQuestion(data, p, { mode: "cram", exclude: out.map((x) => x.id), now });
    if (!q || out.some((x) => x.id === q.id)) break;
    out.push(q);
  }
  return out;
}

const shuffle = <T>(xs: T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function buildExam(data: StudyData, size = 20): Question[] {
  const topics = data.topics.filter((t) => data.questions.some((q) => q.topicId === t.id));
  const total = topics.reduce((s, t) => s + t.examImportance, 0);
  const picked = new Set<Question>();
  for (const t of topics) {
    // spread picks across the difficulty-sorted list for a mix of easy/hard
    const qs = shuffle(data.questions.filter((q) => q.topicId === t.id)).sort((a, b) => a.difficulty - b.difficulty);
    const quota = Math.min(qs.length, Math.max(1, Math.round((size * t.examImportance) / total)));
    for (let i = 0; i < quota; i++) picked.add(qs[Math.floor(((i + 0.5) * qs.length) / quota)]);
  }
  for (const q of shuffle(data.questions)) {
    if (picked.size >= size) break;
    picked.add(q);
  }
  return shuffle([...picked]).slice(0, size);
}

export function weakTopics(data: StudyData, p: Progress, n = 3): Topic[] {
  const score = (t: Topic) => calculateWeakness(t.id, p) * (0.5 + t.examImportance / 10);
  return data.topics
    .filter((t) => (p.topics[t.id]?.seen ?? 0) > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, n);
}

export function overallMastery(data: StudyData, p: Progress): number {
  const total = data.topics.reduce((s, t) => s + t.examImportance, 0);
  return total ? data.topics.reduce((s, t) => s + t.examImportance * topicMastery(p, t.id), 0) / total : 0;
}
