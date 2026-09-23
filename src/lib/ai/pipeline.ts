import { createHash } from "node:crypto";
import type { MaterialChunk, OneShot, Question, StudyData, Topic } from "@/lib/types";
import { getCachedStudy, getChunks, getOneShot, getStudy, saveChunks, saveCurrent, saveOneShot, saveStudy } from "@/lib/store";
import { generateJson } from "./client";
import { formatChunks, moreQuestionsPrompt, oneShotPrompt, topicContentPrompt, topicsPrompt } from "./prompts";
import {
  normalizeFlashcards,
  normalizeOneShot,
  normalizeQuestions,
  normalizeTopics,
  oneShotSchema,
  questionsSchema,
  topicContentSchema,
  topicsSchema,
} from "./schemas";

const TOPIC_CAP = 60_000;

const versionOf = (chunks: MaterialChunk[]) =>
  createHash("sha1").update([...new Set(chunks.map((c) => c.documentId))].sort().join("|")).digest("hex").slice(0, 12);

const topicChunks = (topic: Topic, chunks: MaterialChunk[]) => chunks.filter((c) => topic.chunkIds.includes(c.id));

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        console.error("[pipeline]", reason);
        out[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function processMaterials(chunks: MaterialChunk[]): Promise<StudyData> {
  if (!chunks.length) throw new Error("Nenhum conteúdo encontrado nos materiais.");
  const version = versionOf(chunks);
  const cached = await getCachedStudy(version);
  if (cached) {
    await saveStudy(cached);
    return cached;
  }
  await saveChunks(version, chunks);

  const rawTopics = await generateJson(topicsPrompt(formatChunks(chunks, 200_000)), topicsSchema);
  const topics = normalizeTopics(rawTopics, new Set(chunks.map((c) => c.id)));
  if (!topics.length) throw new Error("Não foi possível identificar tópicos no material.");

  const data: StudyData = {
    version,
    createdAt: new Date().toISOString(),
    demo: false,
    documents: [...new Map(chunks.map((c) => [c.documentId, { id: c.documentId, name: c.documentName }])).values()],
    topics,
    questions: [],
    flashcards: [],
  };
  // publish partial results so studying can start as soon as the first topic is ready
  let saving = saveCurrent(data);
  const results = await mapLimit(topics, 3, async (topic) => {
    const raw = await generateJson(topicContentPrompt(topic, formatChunks(topicChunks(topic, chunks), TOPIC_CAP)), topicContentSchema);
    data.questions.push(...normalizeQuestions(raw.questions, topic.id));
    data.flashcards.push(...normalizeFlashcards(raw.flashcards, topic.id));
    saving = saving.then(() => saveCurrent(data));
  });
  await saving;
  if (!results.some((r) => r.status === "fulfilled")) throw new Error("Falha ao gerar questões para todos os tópicos.");
  await saveStudy(data);
  return data;
}

async function currentTopic(topicId: string) {
  const data = await getStudy();
  const topic = data?.topics.find((t) => t.id === topicId);
  if (!data || !topic) throw new Error("Tópico não encontrado.");
  const chunks = await getChunks(data.version);
  if (!chunks) throw new Error("Trechos do material não encontrados; reprocesse os materiais.");
  return { data, topic, material: formatChunks(topicChunks(topic, chunks), TOPIC_CAP) };
}

export async function oneShot(topicId: string): Promise<OneShot> {
  // cache first: serving a saved one-shot must not depend on the material chunks
  const version = (await getStudy())?.version;
  const cached = version && (await getOneShot(version, topicId));
  if (cached) return cached;
  const { data, topic, material } = await currentTopic(topicId);
  const result = normalizeOneShot(await generateJson(oneShotPrompt(topic, material), oneShotSchema), topicId);
  await saveOneShot(data.version, result);
  return result;
}

export async function moreQuestions(topicId: string): Promise<Question[]> {
  const { data, topic, material } = await currentTopic(topicId);
  const existing = data.questions.filter((q) => q.topicId === topicId).map((q) => q.question);
  const raw = await generateJson(moreQuestionsPrompt(topic, material, existing), questionsSchema);
  const questions = normalizeQuestions(raw.questions, topicId);
  // re-read to reduce clobbering concurrent appends
  const latest = (await getStudy()) ?? data;
  await saveStudy({ ...latest, questions: [...latest.questions, ...questions] });
  return questions;
}
