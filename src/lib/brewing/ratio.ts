/**
 * Brew ratio (§13). The ratio is always derived from dose and water, never
 * stored as an independent input on a recipe: `16` means 1:16.
 */

/** water / dose, or null when either side is missing or the dose is zero. */
export function ratioOf(waterG: number | null | undefined, doseG: number | null | undefined): number | null {
  if (waterG == null || doseG == null || !Number.isFinite(waterG) || !Number.isFinite(doseG) || doseG <= 0) return null;
  return waterG / doseG;
}

/** Rounded to 4 decimals, matching the Decimal(8,4) column on Brew. */
export function persistedRatio(waterG: number, doseG: number): number {
  const ratio = ratioOf(waterG, doseG);
  if (ratio === null) throw new RangeError("A ratio needs a positive dose");
  return Math.round(ratio * 10_000) / 10_000;
}

/**
 * `1:16`, `1:15.5`, `1:2.1`. One decimal at most, trailing zero dropped.
 * Number formatting beyond this (the decimal separator) is left to the caller,
 * which knows the locale.
 */
export function formatRatio(ratio: number | null, decimalSeparator = "."): string {
  if (ratio === null || !Number.isFinite(ratio)) return "–";
  const rounded = Math.round(ratio * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `1:${text.replace(".", decimalSeparator)}`;
}

/** Water for a dose at a ratio, rounded to the internal 0.1 g precision. */
export function waterForRatio(doseG: number, ratio: number): number {
  return Math.round(doseG * ratio * 10) / 10;
}
