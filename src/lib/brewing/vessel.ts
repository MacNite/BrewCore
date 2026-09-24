import type { LiveStatus, LiveStep } from "./state-machine";

/**
 * What the Live Brew "vessel" shows (§21): how full the cup is and where the
 * current pour should stop, both as a fraction of the brew's total water.
 *
 * The fill follows the recipe's cumulative targets, not a measurement: it shows
 * the water the plan says is in by now. A pour step counts as poured once it is
 * underway; before the timer starts only earlier steps count.
 */
export interface VesselLevel {
  /** 0–1: planned water in the brewer so far. */
  level: number;
  /** 0–1: where the current pour should stop; null when this step pours nothing. */
  marker: number | null;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function vesselLevel(
  steps: Pick<LiveStep, "waterTargetG">[],
  stepIndex: number,
  status: LiveStatus,
  totalWaterG: number,
): VesselLevel {
  const targets = steps.map((step) => step.waterTargetG).filter((g): g is number => g !== null);
  const total = Math.max(totalWaterG, ...targets, 0);
  if (total <= 0) return { level: 0, marker: null };

  let before = 0;
  for (let i = stepIndex - 1; i >= 0; i--) {
    const target = steps[i]?.waterTargetG ?? null;
    if (target !== null) {
      before = target;
      break;
    }
  }
  const target = steps[stepIndex]?.waterTargetG ?? null;
  if (target === null) return { level: clamp(before / total), marker: null };

  const poured = status === "READY" ? before : target;
  return { level: clamp(poured / total), marker: clamp(target / total) };
}
