/**
 * Delivers the outbox (§57, §95). Entries go out oldest first, so a brew's
 * completion always precedes its tasting. The server endpoints are idempotent,
 * so a request that reached the server but whose response was lost is simply
 * sent again.
 *
 * Outcomes per response:
 *  - 2xx                → delivered, removed
 *  - 404 / 409 / 400    → can never succeed (brew gone, already aborted,
 *                         malformed), removed and reported
 *  - 401 / 403          → signed out: stop, keep everything for later
 *  - 429 / 5xx / network → stop, keep everything, retry later
 */
import { listOutbox, removeOutbox, updateOutbox, type OutboxEntry } from "./db";

export interface FlushResult {
  delivered: OutboxEntry[];
  dropped: { entry: OutboxEntry; status: number }[];
  remaining: number;
  stoppedBy: "offline" | "unauthorized" | "server" | null;
}

let flushing: Promise<FlushResult> | null = null;

/** One flush at a time; concurrent callers share the running one. */
export function flushOutbox(fetchImpl: typeof fetch = fetch): Promise<FlushResult> {
  if (!flushing) {
    flushing = doFlush(fetchImpl).finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function doFlush(fetchImpl: typeof fetch): Promise<FlushResult> {
  const entries = await listOutbox();
  const result: FlushResult = { delivered: [], dropped: [], remaining: entries.length, stoppedBy: null };

  for (const entry of entries) {
    let response: Response;
    try {
      response = await fetchImpl(entry.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.body),
        credentials: "same-origin",
        cache: "no-store",
      });
    } catch (error) {
      await updateOutbox({ ...entry, attempts: entry.attempts + 1, lastError: error instanceof Error ? error.message : "network" });
      result.stoppedBy = "offline";
      break;
    }

    if (response.ok) {
      await removeOutbox(entry.key);
      result.delivered.push(entry);
      result.remaining -= 1;
      continue;
    }
    if (response.status === 404 || response.status === 409 || response.status === 400) {
      await removeOutbox(entry.key);
      result.dropped.push({ entry, status: response.status });
      result.remaining -= 1;
      continue;
    }
    await updateOutbox({ ...entry, attempts: entry.attempts + 1, lastError: `HTTP ${response.status}` });
    result.stoppedBy = response.status === 401 || response.status === 403 ? "unauthorized" : "server";
    break;
  }
  return result;
}
