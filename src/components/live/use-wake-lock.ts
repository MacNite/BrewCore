"use client";

import { useEffect, useRef } from "react";

type Sentinel = { release(): Promise<void>; addEventListener(type: "release", cb: () => void): void };
type WakeLockNavigator = Navigator & { wakeLock?: { request(type: "screen"): Promise<Sentinel> } };

/**
 * Keeps the screen on while `active` (§73): requested when the brew starts,
 * re-acquired when the page becomes visible again (the browser releases it on
 * backgrounding), released on finish or abort. Failing to get a lock never
 * breaks brewing.
 */
export function useWakeLock(active: boolean) {
  const sentinel = useRef<Sentinel | null>(null);

  useEffect(() => {
    const nav = navigator as WakeLockNavigator;
    if (!nav.wakeLock) return;
    let cancelled = false;

    const acquire = async () => {
      if (!active || sentinel.current || document.visibilityState !== "visible") return;
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) {
          await lock.release().catch(() => undefined);
          return;
        }
        sentinel.current = lock;
        lock.addEventListener("release", () => {
          sentinel.current = null;
        });
      } catch {
        /* Denied or unsupported right now; brewing continues regardless. */
      }
    };
    const release = () => {
      const lock = sentinel.current;
      sentinel.current = null;
      lock?.release().catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    if (active) void acquire();
    else release();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (!active) release();
    };
  }, [active]);

  useEffect(() => () => {
    sentinel.current?.release().catch(() => undefined);
  }, []);
}
