import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { deleteLocalBrew, enqueue, getLocalBrew, listOutbox, putLocalBrew, resetConnection } from "./db";
import { flushOutbox } from "./sync";
import { createLiveBrew } from "../brewing/state-machine";

beforeEach(() => {
  // A fresh database per test.
  globalThis.indexedDB = new IDBFactory();
  resetConnection();
});

const complete = (brewId: string) => enqueue({ kind: "complete", brewId, url: `/api/brews/${brewId}/complete`, body: { brewId } });
const tasting = (brewId: string) => enqueue({ kind: "tasting", brewId, url: `/api/brews/${brewId}/tasting`, body: { rating: 5 } });

const respond = (status: number) => new Response(JSON.stringify({}), { status });

describe("local active brew", () => {
  it("stores and restores the live state", async () => {
    const state = createLiveBrew({ brewId: "b1", steps: [{ recipeStepId: null, position: 1, type: "POUR", title: null, instruction: "Pour", durationSeconds: null, targetElapsedSeconds: null, targetElapsedMaxSeconds: null, waterTargetG: 300, temperatureC: null, requiresConfirmation: false, autoAdvance: false }], resultIds: ["r1"], now: 1 });
    await putLocalBrew({ brewId: "b1", state, context: { coffeeName: "Kenya" }, savedAt: 1 });
    expect((await getLocalBrew("b1"))?.state).toEqual(state);
    await deleteLocalBrew("b1");
    expect(await getLocalBrew("b1")).toBeUndefined();
  });
});

describe("outbox", () => {
  it("keeps one pending request per kind and brew", async () => {
    await complete("b1");
    await complete("b1");
    expect(await listOutbox()).toHaveLength(1);
  });

  it("delivers completion before tasting and empties the queue", async () => {
    await complete("b1");
    await new Promise((r) => setTimeout(r, 2));
    await tasting("b1");
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return respond(200);
    }) as unknown as typeof fetch;

    const result = await flushOutbox(fetchImpl);
    expect(calls).toEqual(["/api/brews/b1/complete", "/api/brews/b1/tasting"]);
    expect(result.remaining).toBe(0);
    expect(await listOutbox()).toHaveLength(0);
  });

  it("keeps everything while offline and delivers it on reconnect", async () => {
    await complete("b1");
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const first = await flushOutbox(offline);
    expect(first.stoppedBy).toBe("offline");
    const [pending] = await listOutbox();
    expect(pending.attempts).toBe(1);

    const online = vi.fn(async () => respond(200)) as unknown as typeof fetch;
    const second = await flushOutbox(online);
    expect(second.delivered).toHaveLength(1);
    expect(await listOutbox()).toHaveLength(0);
  });

  it("stops without dropping anything when signed out or the server fails", async () => {
    await complete("b1");
    expect((await flushOutbox(vi.fn(async () => respond(401)) as unknown as typeof fetch)).stoppedBy).toBe("unauthorized");
    expect((await flushOutbox(vi.fn(async () => respond(503)) as unknown as typeof fetch)).stoppedBy).toBe("server");
    expect(await listOutbox()).toHaveLength(1);
  });

  it("drops a request that can never succeed", async () => {
    await complete("gone");
    const result = await flushOutbox(vi.fn(async () => respond(404)) as unknown as typeof fetch);
    expect(result.dropped).toHaveLength(1);
    expect(await listOutbox()).toHaveLength(0);
  });

  it("shares one flush between concurrent callers", async () => {
    await complete("b1");
    const fetchImpl = vi.fn(async () => respond(200)) as unknown as typeof fetch;
    await Promise.all([flushOutbox(fetchImpl), flushOutbox(fetchImpl)]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
