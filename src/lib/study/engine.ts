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

type Num = { value: number; raw: number; pct: boolean }; // value: "7.46%" -> 0.0746; raw: 7.46

// "1.5e-3", "1.5 x 10^-3", "-2", "1/6", "7.46%" at the start of the string; trailing units are ignored,
// but not trailing digits: "4s2" is a subshell, not the number 4. A fraction has no spaces around "/":
// "X / Y" is how the key lists alternatives.
const toNumber = (s: string): Num | null => {
  const frac = s.match(/^([-+]?\d*\.?\d+)\/(\d*\.?\d+)/);
  if (frac) {
    const v = Number(frac[1]) / Number(frac[2]);
    return !/\d/.test(s.slice(frac[0].length)) && Number.isFinite(v) ? { value: v, raw: v, pct: false } : null;
  }
  const m = s.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)(?:\s*[x*×·]\s*10\s*\^?\s*([-+]?\d+))?/);
  const rest = m ? s.slice(m[0].length) : "";
  if (!m || /\d/.test(rest)) return null;
  const raw = Number(m[1]) * 10 ** Number(m[2] ?? 0);
  const pct = /^\s*%/.test(rest);
  return { value: pct ? raw / 100 : raw, raw, pct };
};

const close = (a: number, b: number) => (b === 0 ? Math.abs(a) < 1e-9 : Math.abs(a - b) <= 0.02 * Math.abs(b));

// identifiers/calls ("fit_transform", "modelo.fit", "np.mean()"): exact, since fit != fit_transform
const looksLikeCode = (s: string) => /^\S*[_.(]\S*$/.test(s.trim()) && /[a-z]/i.test(s);
const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase().replace(/\(\)$/, "");

const STOP = new Set(["o", "a", "os", "as", "um", "uma", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "ao", "pelo", "pela"]);
// content words, singularized crudely ("polares" -> "polar", "ions" -> "ion") so plural/singular both match
const words = (s: string) =>
  norm(s)
    .replace(/[()[\]"'`´]/g, " ")
    .split(/[\s-]+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(es|s)$/, "") : w));

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// A typo, not a different word: prefixes flip meaning in chemistry (polar/apolar, endo/exo, cátion/ânion),
// so the first two letters must match and only 1 slip is allowed (2 in long words). Never on short keys like "K".
const typo = (a: string, b: string) =>
  b.length >= 4 && a.slice(0, 2) === b.slice(0, 2) && editDistance(a, b) <= (b.length >= 12 ? 2 : 1);

function textMatches(answer: string, expected: string): boolean {
  const a = words(answer);
  const c = words(expected);
  if (!a.length || !c.length) return false;
  const [as, cs] = [a.join(" "), c.join(" ")];
  if (as === cs || typo(as, cs)) return true;
  // every expected word present, answer not padded with much else: "ligação covalente polar" for "polar"
  return c.every((w) => a.some((x) => x === w || typo(x, w))) && a.length <= c.length + 2;
}

function matches(answer: string, expected: string): boolean {
  const a = norm(answer);
  const c = norm(expected);
  if (a === c) return true;
  const na = toNumber(a);
  const nc = toNumber(c);
  // percent and decimal are the same number ("7,46%" = "0,0746"); "7,46" for a "7,46%" key is fine too
  if (na && nc) return close(na.value, nc.value) || (na.pct !== nc.pct && close(na.raw, nc.raw));
  if (looksLikeCode(expected)) return squash(answer) === squash(expected); // no typo tolerance for code
  return textMatches(answer, expected);
}

export function checkAnswer(q: Question, answer: string): boolean {
  if (q.type === "multiple-choice" || q.type === "true-false") return answer.trim() === q.correctAnswer.trim();
  if (matches(answer, q.correctAnswer)) return true;
  // "X / Y", "X; Y" or "X ou Y" in the key means either is accepted ("mol/L" and "1/6" are not alternatives)
  const alts = q.correctAnswer.split(/\s+\/\s+|\s*(?:;|\bou\b)\s*/i);
  return alts.length > 1 && alts.some((alt) => matches(answer, alt));
}

export function recordAnswer(p: Progress, q: Question, answer: string, correct: boolean, now = Date.now()): Progress {
  const t = p.topics[q.topicId] ?? { seen: 0, correct: 0, mastery: 0, lastSeen: 0 };
  // hard questions move mastery more when right, easy ones more when wrong
  const alpha = 0.3 * (correct ? 0.8 + 0.1 * q.difficulty : 1.2 - 0.1 * q.difficulty);
  const prev = p.questions[q.id];
  const interval = correct && prev?.lastCorrect ? Math.max(5 * MIN, (prev.due - prev.lastSeen) * 2) : correct ? 5 * MIN : 10 * MIN;
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
  /** repeat: allow already-answered questions (explicit "treinar de novo"); otherwise only never-answered ones */
  opts: { mode: StudyMode; topicId?: string; exclude?: string[]; now?: number; repeat?: boolean },
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
  const notInSession = inScope.filter((q) => !ex.has(q.id));
  let pool: Question[];
  if (!opts.repeat) {
    // answered questions never come back here; mistakes are retried in "mistakes" mode
    pool = notInSession.filter((q) => !p.questions[q.id]);
    if (!pool.length) return null;
  } else {
    const unrepeated = notInSession.length ? notInSession : inScope;
    const ready = unrepeated.filter((q) => {
      const s = p.questions[q.id];
      return !s || (!s.lastCorrect && s.due <= now);
    });
    pool = ready.length ? ready : unrepeated;
  }
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

export function overallMastery(data: { topics: Pick<Topic, "id" | "examImportance">[] }, p: Progress): number {
  const total = data.topics.reduce((s, t) => s + t.examImportance, 0);
  return total ? data.topics.reduce((s, t) => s + t.examImportance * topicMastery(p, t.id), 0) / total : 0;
}
