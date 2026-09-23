import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MaterialChunk, OneShot, StudyData } from "@/lib/types";

const DIR = path.join(process.cwd(), "data");
const file = (name: string) => path.join(DIR, name);

async function read<T>(name: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file(name), "utf8")) as T;
  } catch {
    return null;
  }
}

async function write(name: string, value: unknown) {
  if (process.env.VERCEL) return; // read-only FS on Vercel: content is generated locally and committed
  await mkdir(path.dirname(file(name)), { recursive: true });
  await writeFile(file(name), JSON.stringify(value));
}

export const getStudy = () => read<StudyData>("study.json");
export const getCachedStudy = (version: string) => read<StudyData>(`cache/study-${version}.json`);

/** Saves as current data and in the per-version cache. */
export async function saveStudy(data: StudyData) {
  await write(`cache/study-${data.version}.json`, data);
  await write("study.json", data);
}

export const getChunks = (version: string) => read<MaterialChunk[]>(`cache/chunks-${version}.json`);
export const saveChunks = (version: string, chunks: MaterialChunk[]) => write(`cache/chunks-${version}.json`, chunks);

export async function getOneShot(version: string, topicId: string) {
  return (await read<Record<string, OneShot>>("one-shots.json"))?.[`${version}:${topicId}`] ?? null;
}

// ponytail: read-modify-write without lock; concurrent one-shot generations may drop one entry (it just regenerates).
export async function saveOneShot(version: string, oneShot: OneShot) {
  const all = (await read<Record<string, OneShot>>("one-shots.json")) ?? {};
  all[`${version}:${oneShot.topicId}`] = oneShot;
  await write("one-shots.json", all);
}

/** Current data only (no version cache): used for partial results while processing. */
export const saveCurrent = (data: StudyData) => write("study.json", data);
