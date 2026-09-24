// Each person's generated podcasts live in their own browser (IndexedDB holds the MP3 blobs;
// localStorage is too small). Vercel can't store files, and this keeps episodes per person.

import { DEFAULT_SUBJECT } from "@/lib/types";

export type SavedLine = { speaker: string; text: string; emotion?: string };
export type SavedPodcast = { topicId: string; title: string; lines: SavedLine[]; seconds: number; audio: Blob | null; at: number };

const DB = "chemshot";
const STORE = "podcasts";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "topicId" }); // latest episode per topic
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = op(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

// stored under "<subject>:<topicId>"; chemistry episodes from before multi-subject were stored under the bare topicId
const key = (subject: string, topicId: string) => `${subject}:${topicId}`;
const get = (k: string) => run<SavedPodcast | undefined>("readonly", (s) => s.get(k)).catch(() => undefined);

export async function loadPodcast(subject: string, topicId: string) {
  const p = (await get(key(subject, topicId))) ?? (subject === DEFAULT_SUBJECT ? await get(topicId) : undefined);
  return p && { ...p, topicId };
}

export const savePodcast = (subject: string, p: SavedPodcast) =>
  run<IDBValidKey>("readwrite", (s) => s.put({ ...p, topicId: key(subject, p.topicId) })).catch(() => undefined);
