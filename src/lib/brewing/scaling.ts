/**
 * Deterministic recipe scaling (§16, §76).
 *
 * Rules:
 *  - Internal precision is 0.1 g. All arithmetic happens in integer tenths of
 *    a gram, so float noise can never leak into a stored value.
 *  - Water is scaled with the dose so the ratio is preserved, unless the user
 *    overrides the total water explicitly.
 *  - Step water targets scale by the same factor as the total water.
 *  - A step whose target was the recipe's total water ends at the scaled total
 *    *exactly* — no rounding drift across steps.
 *  - No scaled step target exceeds the scaled total, and cumulative targets
 *    never decrease.
 *  - For display, water targets are rounded to whole grams (`displayGrams`).
 *  - Espresso yield scales with the dose (its ratio is yield / dose).
 *  - The original recipe is never mutated.
 */

export interface ScalableStep {
  waterTargetG: number | null;
}

export interface ScalableRecipe<S extends ScalableStep = ScalableStep> {
  defaultCoffeeDoseG: number;
  defaultWaterG: number;
  targetYieldG?: number | null;
  steps: S[];
}

export interface ScaleOptions {
  doseG: number;
  /** Explicit total water; when set the ratio follows it instead of the dose. */
  waterOverrideG?: number | null;
}

export type ScaledRecipe<S extends ScalableStep> = Omit<ScalableRecipe<S>, "steps"> & {
  coffeeDoseG: number;
  waterG: number;
  targetYieldG: number | null;
  /** Factor applied to water targets. */
  factor: number;
  steps: S[];
};

const toTenths = (grams: number) => Math.round(grams * 10);
const fromTenths = (tenths: number) => tenths / 10;

/** Rounds to the internal precision of 0.1 g. */
export const roundToTenth = (grams: number) => fromTenths(toTenths(grams));

/** Whole grams for display (§76). */
export const displayGrams = (grams: number) => Math.round(grams);

export function scaleRecipe<S extends ScalableStep>(recipe: ScalableRecipe<S>, options: ScaleOptions): ScaledRecipe<S> {
  const baseDose = toTenths(recipe.defaultCoffeeDoseG);
  const baseWater = toTenths(recipe.defaultWaterG);
  const dose = toTenths(options.doseG);
  if (baseDose <= 0 || baseWater <= 0) throw new RangeError("A recipe needs a positive dose and water");
  if (dose <= 0) throw new RangeError("The dose must be positive");

  const override = options.waterOverrideG != null ? toTenths(options.waterOverrideG) : null;
  if (override !== null && override <= 0) throw new RangeError("The water must be positive");

  const water = override ?? Math.round((baseWater * dose) / baseDose);
  const factor = water / baseWater;

  let previous = 0;
  const steps = recipe.steps.map((step) => {
    if (step.waterTargetG == null) return { ...step };
    const original = toTenths(step.waterTargetG);
    let scaled = original === baseWater ? water : Math.round((original * water) / baseWater);
    scaled = Math.min(Math.max(scaled, previous), water);
    previous = scaled;
    return { ...step, waterTargetG: fromTenths(scaled) };
  });

  const yieldTenths = recipe.targetYieldG != null ? Math.round((toTenths(recipe.targetYieldG) * dose) / baseDose) : null;

  return {
    ...recipe,
    coffeeDoseG: fromTenths(dose),
    waterG: fromTenths(water),
    targetYieldG: yieldTenths === null ? null : fromTenths(yieldTenths),
    factor,
    steps,
  };
}

/**
 * The amount to add in each step, derived from the cumulative targets (§15).
 * A step without a water target adds nothing and does not reset the baseline.
 */
export function stepAdditions(steps: ScalableStep[]): (number | null)[] {
  let previous = 0;
  return steps.map((step) => {
    if (step.waterTargetG == null) return null;
    const add = fromTenths(toTenths(step.waterTargetG) - toTenths(previous));
    previous = step.waterTargetG;
    return add;
  });
}
