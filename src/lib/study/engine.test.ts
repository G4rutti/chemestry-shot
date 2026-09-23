import { test } from "node:test";
import assert from "node:assert/strict";
import type { Question, StudyData } from "../types";
import { buildExam, checkAnswer, emptyProgress, getNextQuestion, recordAnswer } from "./engine";

const q = (id: string, topicId: string, extra: Partial<Question> = {}): Question => ({
  id,
  topicId,
  type: "multiple-choice",
  question: id,
  options: ["A", "B"],
  correctAnswer: "A",
  explanation: "",
  memoryTip: "",
  difficulty: 2,
  source: { document: "d" },
  ...extra,
});

const data: StudyData = {
  version: "1",
  createdAt: "",
  demo: true,
  documents: [],
  topics: [
    { id: "t1", name: "T1", summary: "", examImportance: 5, keyPoints: [], chunkIds: [] },
    { id: "t2", name: "T2", summary: "", examImportance: 1, keyPoints: [], chunkIds: [] },
  ],
  questions: [
    ...Array.from({ length: 20 }, (_, i) => q(`a${i}`, "t1", { difficulty: ((i % 5) + 1) as Question["difficulty"] })),
    ...Array.from({ length: 10 }, (_, i) => q(`b${i}`, "t2")),
  ],
  flashcards: [],
};

test("checkAnswer: numeric tolerance, comma decimal, units, accents", () => {
  const calc = q("c", "t1", { type: "calculation", correctAnswer: "0,25 mol/L" });
  assert.ok(checkAnswer(calc, "0.25"));
  assert.ok(checkAnswer(calc, " 0,252 M "));
  assert.ok(!checkAnswer(calc, "0.3"));
  assert.ok(checkAnswer(q("s", "t1", { type: "calculation", correctAnswer: "1,5 x 10^-3" }), "0.0015"));
  const fill = q("f", "t1", { type: "fill", correctAnswer: "Ligação iônica" });
  assert.ok(checkAnswer(fill, "  ligacao   IONICA. "));
  assert.ok(!checkAnswer(q("h", "t1", { type: "fill", correctAnswer: "H2O" }), "CO2"));
  assert.ok(checkAnswer(q("m", "t1"), "A") && !checkAnswer(q("m", "t1"), "B"));
});

test("checkAnswer: lenient text for fill (typos, plural, extra words, alternatives)", () => {
  const fill = (correctAnswer: string) => q("f", "t1", { type: "fill", correctAnswer });
  assert.ok(checkAnswer(fill("polares"), "polar"));
  assert.ok(checkAnswer(fill("polares"), "covalentes polares"));
  assert.ok(checkAnswer(fill("ebullioscopia"), "ebulioscopia"));
  assert.ok(checkAnswer(fill("reagente limitante"), "o reagente limitante"));
  assert.ok(checkAnswer(fill("Le Chatelier"), "le chatelie"));
  assert.ok(checkAnswer(fill("iônicas / eletrovalentes"), "eletrovalente"));
  assert.ok(!checkAnswer(fill("polares"), "apolares"));
  assert.ok(!checkAnswer(fill("K"), "L"));
  assert.ok(!checkAnswer(fill("crescente"), "decrescente"));
  assert.ok(!checkAnswer(fill("endotérmica"), "exotérmica") && !checkAnswer(fill("cátion"), "ânion"));
  assert.ok(!checkAnswer(fill("polares"), "nao sei o que e isso polares talvez"));
  assert.ok(checkAnswer(fill("4s2"), "4s2") && !checkAnswer(fill("4s2"), "4") && !checkAnswer(fill("3p6"), "3p5"));
});

test("getNextQuestion: prefers unseen questions from other topics over repeating answered ones", () => {
  let p = emptyProgress();
  for (const x of data.questions.filter((x) => x.topicId === "t1")) p = recordAnswer(p, x, "B", false, 0); // t1 all wrong
  for (let i = 0; i < 20; i++) {
    const next = getNextQuestion(data, p, { mode: "cram", now: 1000 }); // t1 mistakes not due yet
    assert.equal(next?.topicId, "t2");
  }
});

test("getNextQuestion: answered questions never come back unless repeat is asked", () => {
  let p = emptyProgress();
  for (const x of data.questions.filter((x) => x.topicId === "t2")) p = recordAnswer(p, x, "A", true, 0);
  assert.equal(getNextQuestion(data, p, { mode: "topic", topicId: "t2", now: 1e12 }), null);
  assert.equal(getNextQuestion(data, p, { mode: "topic", topicId: "t2", now: 1e12, repeat: true })?.topicId, "t2");
  for (let i = 0; i < 10; i++) assert.equal(getNextQuestion(data, p, { mode: "cram", now: 1e12 })?.topicId, "t1");
});

test("recordAnswer: xp, streak, mistake upsert and resolution", () => {
  const x = data.questions[0];
  let p = recordAnswer(emptyProgress(), x, "B", false, 1000);
  p = recordAnswer(p, x, "B", false, 2000);
  assert.equal(p.xp, 2);
  assert.equal(p.mistakes.length, 1);
  assert.equal(p.mistakes[0].resolved, false);
  assert.equal(p.questions[x.id].due, 2000 + 10 * 60_000);
  p = recordAnswer(p, x, "A", true, 3000);
  assert.equal(p.xp, 2 + 10 + 2 * x.difficulty);
  assert.equal(p.streak, 1);
  assert.equal(p.mistakes[0].resolved, true);
  assert.ok(p.topics.t1.mastery > 0 && p.topics.t1.mastery < 1);
  const p2 = recordAnswer(p, x, "A", true, 4000);
  assert.equal(p2.questions[x.id].due - 4000, 2 * 5 * 60_000);
});

test("getNextQuestion: mistakes mode only returns open mistakes, null when exhausted", () => {
  let p = recordAnswer(emptyProgress(), data.questions[3], "B", false, 0);
  p = recordAnswer(p, data.questions[25], "B", false, 0);
  p = recordAnswer(p, data.questions[25], "A", true, 0);
  assert.equal(getNextQuestion(data, p, { mode: "mistakes" })?.id, data.questions[3].id);
  assert.equal(getNextQuestion(data, p, { mode: "mistakes", exclude: [data.questions[3].id] }), null);
  assert.ok(getNextQuestion(data, p, { mode: "cram" }));
});

test("buildExam: size, no duplicates, weighted by importance", () => {
  const exam = buildExam(data, 12);
  assert.equal(exam.length, 12);
  assert.equal(new Set(exam.map((x) => x.id)).size, 12);
  assert.ok(exam.filter((x) => x.topicId === "t1").length > exam.filter((x) => x.topicId === "t2").length);
});
