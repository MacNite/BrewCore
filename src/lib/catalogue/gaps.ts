/**
 * "Fill the gaps" for shared catalogue entries (§7a).
 *
 * A suggestion from someone who did not create an entry may only fill fields
 * that are empty, and a merge only fills the kept entry's empty fields from
 * the one that goes away. Both use this one definition of "empty", so what a
 * suggestion form offers and what accepting it writes cannot drift apart.
 */

export type GapValue = string | number | string[] | null | undefined;

/** Null, blank text, an empty list, or the explicit "unknown" roast level. */
export function isEmptyValue(value: GapValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "" || value === "UNKNOWN";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** The fields of `current` that are empty, in the order given. */
export function emptyFields<K extends string>(current: Partial<Record<K, GapValue>>, fields: readonly K[]): K[] {
  return fields.filter((field) => isEmptyValue(current[field]));
}

/**
 * The values from `proposed` that may be written into `current`: only for
 * fields listed in `fields`, only where `current` is empty and `proposed` is
 * not. Everything else is dropped, never overwritten.
 */
export function fillGaps<K extends string>(
  current: Partial<Record<K, GapValue>>,
  proposed: Partial<Record<K, GapValue>>,
  fields: readonly K[],
): Partial<Record<K, GapValue>> {
  const result: Partial<Record<K, GapValue>> = {};
  for (const field of fields) {
    if (isEmptyValue(current[field]) && !isEmptyValue(proposed[field])) result[field] = proposed[field];
  }
  return result;
}
