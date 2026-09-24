/**
 * Local persistence for the active brew (§23) and the completion outbox (§57),
 * in IndexedDB. Browser-only; every function resolves to a harmless default
 * when IndexedDB is unavailable (private mode, old browser), so brewing never
 * breaks because storage does.
 */
import type { LiveBrewState } from "../brewing/state-machine";

const DB_NAME = "brewcore";
const DB_VERSION = 1;
const LIVE = "live";
const OUTBOX = "outbox";

export type OutboxKind = "complete" | "abort" | "tasting";

export interface OutboxEntry {
  /** `${kind}:${brewId}` — one pending request of each kind per brew. */
  key: string;
  kind: OutboxKind;
  brewId: string;
  url: string;
  body: unknown;
  createdAt: number;
  attempts: number;
  lastError: string | null;
}

/** What the live screen needs to render without the server (§24). */
export interface LocalLiveBrew {
  brewId: string;
  state: LiveBrewState;
  /** Display context captured from the server when the brew was opened. */
  context: Record<string, unknown>;
  savedAt: number;
}

let opening: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (opening) return opening;
  opening = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LIVE)) db.createObjectStore(LIVE, { keyPath: "brewId" });
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  const result = opening;
  // A failed open may succeed later (e.g. after the user leaves private mode).
  result.then((db) => {
    if (!db) opening = null;
  });
  return result;
}

function run<T>(store: string, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        let result: T | undefined;
        try {
          const tx = db.transaction(store, mode);
          const request = work(tx.objectStore(store));
          if (request) request.onsuccess = () => (result = request.result);
          tx.oncomplete = () => resolve(result);
          tx.onerror = () => resolve(undefined);
          tx.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

// Active brew state -----------------------------------------------------------

export const getLocalBrew = (brewId: string) => run<LocalLiveBrew>(LIVE, "readonly", (s) => s.get(brewId));

export const putLocalBrew = (entry: LocalLiveBrew) => run(LIVE, "readwrite", (s) => s.put(entry)).then(() => undefined);

export const deleteLocalBrew = (brewId: string) => run(LIVE, "readwrite", (s) => s.delete(brewId)).then(() => undefined);

export const listLocalBrews = () => run<LocalLiveBrew[]>(LIVE, "readonly", (s) => s.getAll()).then((rows) => rows ?? []);

// Outbox -----------------------------------------------------------------------

export async function enqueue(entry: Omit<OutboxEntry, "key" | "createdAt" | "attempts" | "lastError">) {
  const full: OutboxEntry = { ...entry, key: `${entry.kind}:${entry.brewId}`, createdAt: Date.now(), attempts: 0, lastError: null };
  await run(OUTBOX, "readwrite", (s) => s.put(full));
  return full;
}

export const listOutbox = () =>
  run<OutboxEntry[]>(OUTBOX, "readonly", (s) => s.getAll()).then((rows) => (rows ?? []).sort((a, b) => a.createdAt - b.createdAt));

export const removeOutbox = (key: string) => run(OUTBOX, "readwrite", (s) => s.delete(key)).then(() => undefined);

export const updateOutbox = (entry: OutboxEntry) => run(OUTBOX, "readwrite", (s) => s.put(entry)).then(() => undefined);

/** For tests. */
export function resetConnection() {
  opening = null;
}
