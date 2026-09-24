/**
 * Timestamp-derived timing (§22). Elapsed time is always computed from the
 * moment the clock started minus the time spent paused, never by counting
 * ticks, so a throttled or backgrounded tab still shows the right time.
 */

export interface ClockState {
  /** Wall-clock ms when the timer started, or null before it has. */
  startedAt: number | null;
  /** Total ms spent paused in completed pauses. */
  totalPausedMs: number;
  /** Wall-clock ms when the current pause began, or null while running. */
  pausedAt: number | null;
  /** Wall-clock ms when the clock stopped for good (finish/abort), or null. */
  stoppedAt?: number | null;
}

/** `elapsed = now - startedAt - totalPausedMs`, frozen while paused or stopped. */
export function elapsedMs(clock: ClockState, now: number): number {
  if (clock.startedAt === null) return 0;
  const end = clock.stoppedAt ?? clock.pausedAt ?? now;
  // A clock that moved backwards (device time change) must not produce a
  // negative brew time.
  return Math.max(0, end - clock.startedAt - clock.totalPausedMs);
}

/** `mm:ss`, or `h:mm:ss` from one hour. Rounds down to the whole second. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Same as `formatClock`, for a value in seconds. */
export const formatSeconds = (seconds: number | null | undefined) =>
  seconds == null ? "–" : formatClock(seconds * 1000);

/** Parses `2:45`, `02:45`, `165` or `1:02:45` into seconds; null for anything else. */
export function parseClock(text: string): number | null {
  const value = text.trim();
  if (value === "") return null;
  if (/^\d+$/.test(value)) return Number(value);
  const parts = value.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const numbers = parts.map(Number);
  if (numbers.slice(1).some((part) => part >= 60)) return null;
  return numbers.reduce((total, part) => total * 60 + part, 0);
}

/** Seconds → editable `m:ss` text; empty for null. */
export const clockText = (seconds: number | null) => (seconds === null ? "" : formatSeconds(seconds).replace(/^0(\d:)/, "$1"));
