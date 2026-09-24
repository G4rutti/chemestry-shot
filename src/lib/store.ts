import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_SUBJECT, type MaterialChunk, type OneShot, type StudyData, type Subject } from "@/lib/types";

// every subject has its own folder: data/<subject>/study.json, one-shots.json, cache/
// turbopackIgnore: files ship via outputFileTracingIncludes (next.config.ts), not the whole folders (PDFs, datasets)
const DATA = path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
const DOCS = path.join(/*turbopackIgnore: true*/ process.cwd(), "docs");
const file = (subject: string, name: string) => path.join(DATA, subject, name);

const SLUG = /^[a-z0-9-]+$/;

/** `?subject=` of an API request (default: quimica). null when invalid: it becomes a path, so no "../" tricks. */
export function subjectOf(request: Request): string | null {
  const s = new URL(request.url).searchParams.get("subject") ?? DEFAULT_SUBJECT;
  return SLUG.test(s) ? s : null;
}

export const badSubject = () => Response.json({ error: "Matéria inválida." }, { status: 400 });

async function readJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(p, "utf8")) as T;
  } catch {
    return null;
  }
}

const read = <T>(subject: string, name: string) => readJson<T>(file(subject, name));

async function write(subject: string, name: string, value: unknown) {
  if (process.env.VERCEL) return; // read-only FS on Vercel: content is generated locally and committed
  await mkdir(path.dirname(file(subject, name)), { recursive: true });
  await writeFile(file(subject, name), JSON.stringify(value));
}

export const getStudy = (subject: string) => read<StudyData>(subject, "study.json");
export const getCachedStudy = (subject: string, version: string) => read<StudyData>(subject, `cache/study-${version}.json`);

/** Saves as current data and in the per-version cache. */
export async function saveStudy(subject: string, data: StudyData) {
  await write(subject, `cache/study-${data.version}.json`, data);
  await write(subject, "study.json", data);
}

export const getChunks = (subject: string, version: string) => read<MaterialChunk[]>(subject, `cache/chunks-${version}.json`);
export const saveChunks = (subject: string, version: string, chunks: MaterialChunk[]) => write(subject, `cache/chunks-${version}.json`, chunks);

export async function getOneShot(subject: string, version: string, topicId: string) {
  return (await read<Record<string, OneShot>>(subject, "one-shots.json"))?.[`${version}:${topicId}`] ?? null;
}

// ponytail: read-modify-write without lock; concurrent one-shot generations may drop one entry (it just regenerates).
export async function saveOneShot(subject: string, version: string, oneShot: OneShot) {
  const all = (await read<Record<string, OneShot>>(subject, "one-shots.json")) ?? {};
  all[`${version}:${oneShot.topicId}`] = oneShot;
  await write(subject, "one-shots.json", all);
}

/** Current data only (no version cache): used for partial results while processing. */
export const saveCurrent = (subject: string, data: StudyData) => write(subject, "study.json", data);

/** What was saved with the data (AI-made profile), overridden by the folder config docs/<id>/subject.json. */
export async function getSubject(id: string, study?: StudyData | null): Promise<Subject> {
  const json = await readJson<Omit<Subject, "id">>(path.join(DOCS, id, "subject.json"));
  return { name: id, exam: "prova", ...study?.subject, ...json, id };
}

export async function listSubjects(): Promise<string[]> {
  const dirs = async (root: string) =>
    (await readdir(root, { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory() && SLUG.test(e.name)).map((e) => e.name);
  return [...new Set([...(await dirs(DOCS)), ...(await dirs(DATA))])].sort();
}
