import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { elapsedMs, formatClock, formatSeconds, parseClock } from "./timer";

describe("elapsed time", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("is zero before the clock starts", () => {
    expect(elapsedMs({ startedAt: null, totalPausedMs: 0, pausedAt: null }, Date.now())).toBe(0);
  });

  it("follows the wall clock, not a tick count", () => {
    vi.setSystemTime(1_000_000);
    const clock = { startedAt: Date.now(), totalPausedMs: 0, pausedAt: null };
    // A throttled tab gets no ticks for 90 s; the elapsed time is still right.
    vi.advanceTimersByTime(90_000);
    expect(elapsedMs(clock, Date.now())).toBe(90_000);
  });

  it("subtracts completed pauses and freezes during a pause", () => {
    expect(elapsedMs({ startedAt: 0, totalPausedMs: 5_000, pausedAt: null }, 20_000)).toBe(15_000);
    expect(elapsedMs({ startedAt: 0, totalPausedMs: 5_000, pausedAt: 12_000 }, 99_000)).toBe(7_000);
  });

  it("freezes once stopped", () => {
    expect(elapsedMs({ startedAt: 0, totalPausedMs: 0, pausedAt: null, stoppedAt: 30_000 }, 99_000)).toBe(30_000);
  });

  it("never goes negative when the device clock moves backwards", () => {
    expect(elapsedMs({ startedAt: 10_000, totalPausedMs: 0, pausedAt: null }, 5_000)).toBe(0);
  });
});

describe("clock formatting", () => {
  it("formats mm:ss and h:mm:ss", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(222_999)).toBe("03:42");
    expect(formatClock(3_725_000)).toBe("1:02:05");
    expect(formatSeconds(165)).toBe("02:45");
    expect(formatSeconds(null)).toBe("–");
  });

  it("parses clock input", () => {
    expect(parseClock("2:45")).toBe(165);
    expect(parseClock("02:45")).toBe(165);
    expect(parseClock("165")).toBe(165);
    expect(parseClock("1:02:05")).toBe(3725);
    expect(parseClock("")).toBeNull();
    expect(parseClock("2:75")).toBeNull();
    expect(parseClock("abc")).toBeNull();
  });
});
