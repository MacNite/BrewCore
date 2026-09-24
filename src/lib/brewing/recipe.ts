/**
 * Recipe structure shared by the editor, the brew setup and the snapshot a
 * Brew stores (§13–15, §19). Pure: no Prisma, no React.
 */
import { z } from "zod";
import { scaleRecipe } from "./scaling";
import type { LiveStep } from "./state-machine";

export const STEP_TYPES = [
  "PREPARE",
  "TARE",
  "ADD_COFFEE",
  "BLOOM",
  "POUR",
  "WAIT",
  "STIR",
  "SWIRL",
  "PRESS",
  "BREAK_CRUST",
  "DRAW_DOWN",
  "STOP",
  "SERVE",
  "CUSTOM",
] as const;
export type StepType = (typeof STEP_TYPES)[number];

export const METHOD_TYPES = [
  "POUR_OVER",
  "IMMERSION",
  "HYBRID",
  "AEROPRESS",
  "ESPRESSO",
  "MOKA",
  "FRENCH_PRESS",
  "COLD_BREW",
  "CUPPING",
  "OTHER",
] as const;
export type MethodType = (typeof METHOD_TYPES)[number];

export const GRIND_LEVELS = ["EXTRA_FINE", "FINE", "MEDIUM_FINE", "MEDIUM", "MEDIUM_COARSE", "COARSE"] as const;
export type GrindLevel = (typeof GRIND_LEVELS)[number];

export const MAX_STEPS = 40;
export const MAX_GRAMS = 5000;

/** Accepts `18,5` as well as `18.5`; empty means null. */
export const optionalNumber = (max: number, min = 0) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) return null;
      if (typeof value === "number") return value;
      const text = String(value).trim().replace(",", ".");
      return text === "" ? null : Number(text);
    },
    z.number().finite().min(min).max(max).nullable(),
  );

export const requiredNumber = (max: number, min = 0) =>
  z.preprocess(
    (value) => (typeof value === "string" ? Number(value.trim().replace(",", ".")) : value),
    z.number().finite().gt(min).max(max),
  );

const optionalInt = (max: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined ? null : value),
    z.number().int().min(0).max(max).nullable(),
  );

export const recipeStepInput = z
  .object({
    type: z.enum(STEP_TYPES),
    title: z.string().trim().max(120).nullable().default(null),
    instruction: z.string().trim().min(1).max(1000),
    durationSeconds: optionalInt(24 * 3600),
    targetElapsedSeconds: optionalInt(24 * 3600),
    targetElapsedMaxSeconds: optionalInt(24 * 3600),
    waterTargetG: optionalNumber(MAX_GRAMS),
    temperatureC: optionalNumber(100),
    requiresConfirmation: z.boolean().default(false),
    autoAdvance: z.boolean().default(false),
  })
  .refine(
    (step) =>
      step.targetElapsedMaxSeconds === null ||
      (step.targetElapsedSeconds !== null && step.targetElapsedMaxSeconds >= step.targetElapsedSeconds),
    { message: "rangeInvalid", path: ["targetElapsedMaxSeconds"] },
  );
export type RecipeStepInput = z.infer<typeof recipeStepInput>;

export type StepProblem = "waterDecreasing" | "waterAboveTotal" | "timeDecreasing";

/**
 * Cross-step rules the database cannot express: cumulative water targets never
 * decrease and never exceed the recipe's total; target times never go back.
 */
export function stepProblems(steps: Pick<RecipeStepInput, "waterTargetG" | "targetElapsedSeconds">[], totalWaterG: number) {
  const problems: { index: number; problem: StepProblem }[] = [];
  let water = 0;
  let time = 0;
  steps.forEach((step, index) => {
    if (step.waterTargetG !== null) {
      if (step.waterTargetG < water) problems.push({ index, problem: "waterDecreasing" });
      if (step.waterTargetG > totalWaterG + 0.05) problems.push({ index, problem: "waterAboveTotal" });
      water = Math.max(water, step.waterTargetG);
    }
    if (step.targetElapsedSeconds !== null) {
      if (step.targetElapsedSeconds < time) problems.push({ index, problem: "timeDecreasing" });
      time = Math.max(time, step.targetElapsedSeconds);
    }
  });
  return problems;
}

/**
 * Estimated total duration in seconds (§36): the last target time, or the sum
 * of durations, whichever is later. Null when the recipe carries no timing.
 */
export function estimateDurationSeconds(
  steps: Pick<RecipeStepInput, "durationSeconds" | "targetElapsedSeconds" | "targetElapsedMaxSeconds">[],
  targetBrewTimeSeconds: number | null = null,
): number | null {
  let clock = 0;
  let any = false;
  for (const step of steps) {
    if (step.durationSeconds !== null) {
      clock += step.durationSeconds;
      any = true;
    }
    const target = step.targetElapsedMaxSeconds ?? step.targetElapsedSeconds;
    if (target !== null) {
      clock = Math.max(clock, target);
      any = true;
    }
  }
  if (targetBrewTimeSeconds !== null) return Math.max(targetBrewTimeSeconds, any ? clock : 0);
  return any ? clock : null;
}

// ---------------------------------------------------------------------------
// Brew snapshot (§19)
// ---------------------------------------------------------------------------

export const RECIPE_SNAPSHOT_VERSION = 1;

export interface RecipeSnapshot {
  version: typeof RECIPE_SNAPSHOT_VERSION;
  recipeId: string | null;
  name: string;
  methodType: string;
  brewerName: string | null;
  coffeeDoseG: number;
  waterG: number;
  targetYieldG: number | null;
  waterTemperatureC: number | null;
  grindDescription: string | null;
  targetBrewTimeSeconds: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  authorName: string | null;
  steps: LiveStep[];
}

export interface SnapshotSource {
  id: string | null;
  name: string;
  methodType: string;
  brewerName: string | null;
  defaultCoffeeDoseG: number;
  defaultWaterG: number;
  targetYieldG: number | null;
  waterTemperatureC: number | null;
  grindDescription: string | null;
  targetBrewTimeSeconds: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  authorName: string | null;
  steps: (Omit<LiveStep, "recipeStepId"> & { id: string | null })[];
}

/**
 * The scaled recipe exactly as this brew uses it. A recipe without steps gets
 * one generic step so a guided brew is always possible.
 */
export function buildRecipeSnapshot(
  recipe: SnapshotSource,
  options: { doseG: number; waterG: number; waterTemperatureC: number | null; fallbackInstruction: string },
): RecipeSnapshot {
  const scaled = scaleRecipe(
    { defaultCoffeeDoseG: recipe.defaultCoffeeDoseG, defaultWaterG: recipe.defaultWaterG, targetYieldG: recipe.targetYieldG, steps: recipe.steps },
    { doseG: options.doseG, waterOverrideG: options.waterG },
  );
  const steps: LiveStep[] = scaled.steps.map(({ id, ...step }) => ({ ...step, recipeStepId: id }));
  if (steps.length === 0) {
    steps.push({
      recipeStepId: null,
      position: 1,
      type: "CUSTOM",
      title: null,
      instruction: options.fallbackInstruction,
      durationSeconds: null,
      targetElapsedSeconds: recipe.targetBrewTimeSeconds,
      targetElapsedMaxSeconds: null,
      waterTargetG: scaled.waterG,
      temperatureC: null,
      requiresConfirmation: false,
      autoAdvance: false,
    });
  }
  return {
    version: RECIPE_SNAPSHOT_VERSION,
    recipeId: recipe.id,
    name: recipe.name,
    methodType: recipe.methodType,
    brewerName: recipe.brewerName,
    coffeeDoseG: scaled.coffeeDoseG,
    waterG: scaled.waterG,
    targetYieldG: scaled.targetYieldG,
    waterTemperatureC: options.waterTemperatureC,
    grindDescription: recipe.grindDescription,
    targetBrewTimeSeconds: recipe.targetBrewTimeSeconds,
    sourceName: recipe.sourceName,
    sourceUrl: recipe.sourceUrl,
    authorName: recipe.authorName,
    steps,
  };
}

const liveStepSchema = z.object({
  recipeStepId: z.string().nullable(),
  position: z.number().int(),
  type: z.string(),
  title: z.string().nullable(),
  instruction: z.string(),
  durationSeconds: z.number().nullable(),
  targetElapsedSeconds: z.number().nullable(),
  targetElapsedMaxSeconds: z.number().nullable(),
  waterTargetG: z.number().nullable(),
  temperatureC: z.number().nullable(),
  requiresConfirmation: z.boolean(),
  autoAdvance: z.boolean(),
});

export const recipeSnapshotSchema = z.object({
  version: z.literal(RECIPE_SNAPSHOT_VERSION),
  recipeId: z.string().nullable(),
  name: z.string(),
  methodType: z.string(),
  brewerName: z.string().nullable(),
  coffeeDoseG: z.number(),
  waterG: z.number(),
  targetYieldG: z.number().nullable(),
  waterTemperatureC: z.number().nullable(),
  grindDescription: z.string().nullable(),
  targetBrewTimeSeconds: z.number().nullable(),
  sourceName: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  authorName: z.string().nullable(),
  steps: z.array(liveStepSchema).min(1),
});
