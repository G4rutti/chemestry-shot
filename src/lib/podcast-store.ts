// Each person's generated podcasts live in their own browser (IndexedDB holds the MP3 blobs;
// localStorage is too small). Vercel can't store files, and this keeps episodes per person.

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

export const loadPodcast = (topicId: string) => run<SavedPodcast | undefined>("readonly", (s) => s.get(topicId)).catch(() => undefined);
export const savePodcast = (p: SavedPodcast) => run<IDBValidKey>("readwrite", (s) => s.put(p)).catch(() => undefined);
