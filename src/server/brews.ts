import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { num } from "@/lib/decimal";
import { persistedRatio } from "@/lib/brewing/ratio";
import {
  MAX_GRAMS,
  STEP_TYPES,
  buildRecipeSnapshot,
  estimateDurationSeconds,
  optionalNumber,
  recipeSnapshotSchema,
  requiredNumber,
  type RecipeSnapshot,
} from "@/lib/brewing/recipe";
import { tastingInput, type TastingInput } from "@/lib/brewing/tasting";
import { ConflictError, NotFoundError } from "./errors";
import { notArchived, ownedBy, visibleTo } from "./ownership";
import { brewListSelect } from "./coffees";
import { grinderLabel } from "./grinders";
import { brewerLabel } from "./brewers";
import { getRecipe, recipeToPlain } from "./recipes";
import { localizeBundledRecipe } from "@/lib/catalogue/recipes";
import type { Locale } from "@/i18n/locales";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

const optionalId = z
  .string()
  .max(40)
  .optional()
  .nullable()
  .transform((value) => value || null);

// ---------------------------------------------------------------------------
// Starting a brew (§56)
// ---------------------------------------------------------------------------

export const startBrewInput = z.object({
  recipeId: z.string().min(1).max(40),
  coffeeId: optionalId,
  userGrinderId: optionalId,
  brewerId: optionalId,
  parentBrewId: optionalId,
  coffeeDoseG: requiredNumber(1000),
  waterTargetG: requiredNumber(MAX_GRAMS),
  waterTemperatureC: optionalNumber(100),
  grindSettingText: text(120),
  grindSettingNumeric: optionalNumber(100_000),
  grindSettingUnit: text(40),
  grindSettingNote: text(500),
});
export type StartBrewInput = z.infer<typeof startBrewInput>;

/**
 * Creates the IN_PROGRESS Brew and all of its snapshots in one transaction.
 * Every referenced record is checked against the caller: their own coffee,
 * grinder and parent brew; a bundled or own recipe and brewer (§45).
 */
export async function startBrew(userId: string, input: StartBrewInput, fallbackInstruction: string, locale: Locale) {
  const recipe = recipeToPlain(await getRecipe(userId, input.recipeId, locale));

  return prisma.$transaction(async (tx) => {
    const coffee = input.coffeeId
      ? await tx.coffee.findFirst({ where: { id: input.coffeeId, ...ownedBy(userId) }, select: { id: true, name: true, roasterNameSnapshot: true, roastDate: true } })
      : null;
    if (input.coffeeId && !coffee) throw new NotFoundError("coffee");

    const grinder = input.userGrinderId
      ? await tx.userGrinder.findFirst({ where: { id: input.userGrinderId, ...ownedBy(userId) }, include: { grinderModel: true } })
      : null;
    if (input.userGrinderId && !grinder) throw new NotFoundError("grinder");

    const brewerId = input.brewerId ?? recipe.brewerId;
    const brewer = brewerId ? await tx.brewer.findFirst({ where: { id: brewerId, ...visibleTo(userId) } }) : null;
    if (brewerId && !brewer) throw new NotFoundError("brewer");

    if (input.parentBrewId) {
      const parent = await tx.brew.findFirst({ where: { id: input.parentBrewId, ...ownedBy(userId) }, select: { id: true } });
      if (!parent) throw new NotFoundError("brew");
    }

    const snapshot = buildRecipeSnapshot(
      { ...recipe, brewerName: brewer ? brewerLabel(brewer) : recipe.brewerName },
      { doseG: input.coffeeDoseG, waterG: input.waterTargetG, waterTemperatureC: input.waterTemperatureC, fallbackInstruction },
    );

    return tx.brew.create({
      data: {
        ownerId: userId,
        recipeId: recipe.id,
        coffeeId: coffee?.id ?? null,
        userGrinderId: grinder?.id ?? null,
        brewerId: brewer?.id ?? null,
        parentBrewId: input.parentBrewId,
        status: "IN_PROGRESS",
        coffeeDoseG: snapshot.coffeeDoseG,
        waterTargetG: snapshot.waterG,
        ratio: persistedRatio(snapshot.waterG, snapshot.coffeeDoseG),
        waterTemperatureC: input.waterTemperatureC,
        grindSettingText: input.grindSettingText,
        grindSettingNumeric: input.grindSettingNumeric,
        grindSettingUnit: input.grindSettingUnit,
        grindSettingNote: input.grindSettingNote,
        targetDurationSeconds: estimateDurationSeconds(snapshot.steps, recipe.targetBrewTimeSeconds),
        recipeNameSnapshot: recipe.name,
        coffeeNameSnapshot: coffee?.name ?? null,
        roasterSnapshot: coffee?.roasterNameSnapshot ?? null,
        roastDateSnapshot: coffee?.roastDate ?? null,
        grinderSnapshot: grinder ? grinderLabel(grinder) : null,
        brewerSnapshot: brewer ? brewerLabel(brewer) : null,
        recipeSnapshot: snapshot as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
  });
}

// ---------------------------------------------------------------------------
// Completing, aborting (§57–58)
// ---------------------------------------------------------------------------

const isoDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

export const completionInput = z
  .object({
    startedAt: isoDate,
    completedAt: isoDate,
    actualDurationSeconds: z.number().int().min(0).max(86_400),
    waterActualG: optionalNumber(MAX_GRAMS),
    beverageWeightG: optionalNumber(MAX_GRAMS),
    notes: text(4000),
    steps: z
      .array(
        z.object({
          id: z.uuid(),
          recipeStepId: z.string().max(40).nullable(),
          position: z.number().int().min(0).max(1000),
          type: z.enum(STEP_TYPES),
          startedAt: isoDate.nullable(),
          completedAt: isoDate.nullable(),
          targetWeightG: optionalNumber(MAX_GRAMS),
          targetDurationSeconds: z.number().int().min(0).max(86_400).nullable(),
          actualDurationSeconds: z.number().int().min(0).max(86_400).nullable(),
          skipped: z.boolean(),
        }),
      )
      .max(60),
  })
  .refine((c) => c.completedAt >= c.startedAt, { message: "order", path: ["completedAt"] });
export type CompletionInput = z.infer<typeof completionInput>;

export type CompletionResult = "completed" | "alreadyCompleted";

/**
 * Persists step results and marks the brew COMPLETED, in one transaction.
 *
 * Idempotent (§57): the status change is conditional on IN_PROGRESS, so a
 * re-sent completion — or two racing ones — finds nothing to update and is a
 * no-op. Step results carry client-generated ids and are inserted with
 * `skipDuplicates`. Timestamps are the client's recorded values.
 */
export async function completeBrew(userId: string, brewId: string, input: CompletionInput): Promise<CompletionResult> {
  return prisma.$transaction(async (tx) => {
    const brew = await tx.brew.findFirst({ where: { id: brewId, ...ownedBy(userId) }, select: { id: true, status: true, recipeId: true } });
    if (!brew) throw new NotFoundError("brew");
    if (brew.status === "COMPLETED") return "alreadyCompleted";
    if (brew.status === "ABORTED") throw new ConflictError("aborted");

    const claimed = await tx.brew.updateMany({
      where: { id: brewId, ownerId: userId, status: "IN_PROGRESS" },
      data: {
        status: "COMPLETED",
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        actualDurationSeconds: input.actualDurationSeconds,
        waterActualG: input.waterActualG,
        beverageWeightG: input.beverageWeightG,
        ...(input.notes ? { notes: input.notes } : {}),
      },
    });
    // Another request completed it between the read and the update.
    if (claimed.count === 0) return "alreadyCompleted";

    // A step may have been deleted from the recipe since the brew started; the
    // result keeps its snapshot values and simply loses the link.
    const referenced = input.steps.map((step) => step.recipeStepId).filter((id): id is string => Boolean(id));
    const existing = new Set(
      brew.recipeId && referenced.length
        ? (await tx.recipeStep.findMany({ where: { id: { in: referenced }, recipeId: brew.recipeId }, select: { id: true } })).map((s) => s.id)
        : [],
    );

    await tx.brewStepResult.createMany({
      data: input.steps.map((step) => ({
        id: step.id,
        brewId,
        recipeStepId: step.recipeStepId && existing.has(step.recipeStepId) ? step.recipeStepId : null,
        position: step.position,
        type: step.type,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        targetWeightG: step.targetWeightG,
        targetDurationSeconds: step.targetDurationSeconds,
        actualDurationSeconds: step.actualDurationSeconds,
        skipped: step.skipped,
      })),
      skipDuplicates: true,
    });
    return "completed";
  });
}

/** Idempotent abort. The brew is kept (§58); deleting it is a separate action. */
export async function abortBrew(userId: string, brewId: string, abortedAt = new Date()) {
  const updated = await prisma.brew.updateMany({
    where: { id: brewId, ownerId: userId, status: "IN_PROGRESS" },
    data: { status: "ABORTED", abortedAt },
  });
  if (updated.count === 1) return "aborted" as const;
  const brew = await prisma.brew.findFirst({ where: { id: brewId, ...ownedBy(userId) }, select: { status: true } });
  if (!brew) throw new NotFoundError("brew");
  if (brew.status === "ABORTED") return "alreadyAborted" as const;
  throw new ConflictError("completed");
}

/** Only aborted brews can be deleted; completed brews are history. */
export async function deleteAbortedBrew(userId: string, brewId: string) {
  const deleted = await prisma.brew.deleteMany({ where: { id: brewId, ownerId: userId, status: "ABORTED" } });
  if (deleted.count !== 1) throw new NotFoundError("brew");
}

export async function updateBrewNotes(userId: string, brewId: string, notes: string | null) {
  const updated = await prisma.brew.updateMany({ where: { id: brewId, ...ownedBy(userId) }, data: { notes } });
  if (updated.count !== 1) throw new NotFoundError("brew");
}

// ---------------------------------------------------------------------------
// Tasting (§30)
// ---------------------------------------------------------------------------

export { tastingInput };

/** One tasting per brew, upserted. Only completed brews can be rated. */
export async function saveTasting(userId: string, brewId: string, input: TastingInput) {
  const brew = await prisma.brew.findFirst({ where: { id: brewId, ...ownedBy(userId) }, select: { status: true } });
  if (!brew) throw new NotFoundError("brew");
  if (brew.status !== "COMPLETED") throw new ConflictError("notCompleted");
  return prisma.tasting.upsert({ where: { brewId }, create: { brewId, ...input }, update: input });
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export function parseSnapshot(value: Prisma.JsonValue): RecipeSnapshot | null {
  const parsed = recipeSnapshotSchema.safeParse(value);
  return parsed.success ? (parsed.data as RecipeSnapshot) : null;
}

export async function getLiveBrew(userId: string, id: string) {
  const brew = await prisma.brew.findFirst({ where: { id, ...ownedBy(userId) } });
  if (!brew) throw new NotFoundError("brew");
  const snapshot = parseSnapshot(brew.recipeSnapshot);
  if (!snapshot) throw new NotFoundError("brew");
  return {
    id: brew.id,
    status: brew.status,
    recipeId: brew.recipeId,
    coffeeName: brew.coffeeNameSnapshot,
    grinderName: brew.grinderSnapshot,
    brewerName: brew.brewerSnapshot,
    grindSettingText: brew.grindSettingText,
    coffeeDoseG: num(brew.coffeeDoseG)!,
    waterTargetG: num(brew.waterTargetG)!,
    waterTemperatureC: num(brew.waterTemperatureC),
    ratio: num(brew.ratio)!,
    snapshot,
  };
}
export type LiveBrew = Awaited<ReturnType<typeof getLiveBrew>>;

export async function getBrewDetail(userId: string, id: string) {
  const brew = await prisma.brew.findFirst({
    where: { id, ...ownedBy(userId) },
    include: {
      stepResults: { orderBy: { position: "asc" } },
      tasting: true,
      parentBrew: { select: { id: true, createdAt: true, recipeNameSnapshot: true } },
      coffee: { select: { id: true, archivedAt: true } },
      recipe: { select: { id: true, archivedAt: true } },
      userGrinder: { select: { id: true, archivedAt: true } },
      favorites: { where: { ownerId: userId }, select: { id: true } },
    },
  });
  if (!brew) throw new NotFoundError("brew");
  return { brew, snapshot: parseSnapshot(brew.recipeSnapshot) };
}

const PAGE_SIZE = 30;

export async function listBrews(
  userId: string,
  options: { status?: "COMPLETED" | "ABORTED" | "IN_PROGRESS"; coffeeId?: string; recipeId?: string; page?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const where: Prisma.BrewWhereInput = {
    ...ownedBy(userId),
    ...(options.status ? { status: options.status } : {}),
    ...(options.coffeeId ? { coffeeId: options.coffeeId } : {}),
    ...(options.recipeId ? { recipeId: options.recipeId } : {}),
  };
  const [brews, total] = await Promise.all([
    prisma.brew.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: brewListSelect }),
    prisma.brew.count({ where }),
  ]);
  return { brews, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// ---------------------------------------------------------------------------
// Brew setup (§20, §62)
// ---------------------------------------------------------------------------

export interface SetupPrefill {
  coffeeId: string | null;
  recipeId: string | null;
  userGrinderId: string | null;
  brewerId: string | null;
  parentBrewId: string | null;
  coffeeDoseG: number | null;
  waterTargetG: number | null;
  waterTemperatureC: number | null;
  grindSettingText: string | null;
  grindSettingNumeric: number | null;
  grindSettingUnit: string | null;
}

/** Everything `/brew/new` needs: selectable records and the pre-filled values. */
export async function brewSetup(userId: string, locale: Locale, params: { coffeeId?: string; recipeId?: string; fromBrewId?: string }) {
  const [coffees, recipeRows, grinders, brewers, recentGrinds, parent] = await Promise.all([
    prisma.coffee.findMany({
      where: { ...ownedBy(userId), ...notArchived },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, roasterNameSnapshot: true, roastDate: true },
    }),
    prisma.recipe.findMany({
      where: { ...visibleTo(userId), ...notArchived },
      orderBy: [{ ownerId: { sort: "desc", nulls: "last" } }, { name: "asc" }],
      include: { steps: { orderBy: { position: "asc" } }, brewer: true, forkedFrom: { select: { id: true, name: true, ownerId: true } } },
    }),
    prisma.userGrinder.findMany({ where: { ...ownedBy(userId), ...notArchived }, include: { grinderModel: true }, orderBy: { createdAt: "asc" } }),
    prisma.brewer.findMany({ where: { ...visibleTo(userId), ...notArchived }, orderBy: { model: "asc" } }),
    // Most recent grind per recipe + grinder, to pre-fill the setting (§17).
    prisma.brew.findMany({
      where: { ownerId: userId, grindSettingText: { not: null }, recipeId: { not: null }, userGrinderId: { not: null } },
      orderBy: { createdAt: "desc" },
      distinct: ["recipeId", "userGrinderId"],
      select: { recipeId: true, userGrinderId: true, grindSettingText: true, grindSettingNumeric: true, grindSettingUnit: true },
      take: 200,
    }),
    params.fromBrewId ? prisma.brew.findFirst({ where: { id: params.fromBrewId, ...ownedBy(userId) } }) : null,
  ]);

  const recipes = recipeRows.map((recipe) => recipeToPlain(localizeBundledRecipe(recipe, locale)));
  const pick = <T extends { id: string }>(list: T[], id: string | null | undefined) => (id && list.some((item) => item.id === id) ? id : null);

  const prefill: SetupPrefill = parent
    ? {
        coffeeId: pick(coffees, parent.coffeeId),
        recipeId: pick(recipes, parent.recipeId),
        userGrinderId: pick(grinders, parent.userGrinderId),
        brewerId: pick(brewers, parent.brewerId),
        parentBrewId: parent.id,
        coffeeDoseG: num(parent.coffeeDoseG),
        waterTargetG: num(parent.waterTargetG),
        waterTemperatureC: num(parent.waterTemperatureC),
        grindSettingText: parent.grindSettingText,
        grindSettingNumeric: num(parent.grindSettingNumeric),
        grindSettingUnit: parent.grindSettingUnit,
      }
    : {
        coffeeId: pick(coffees, params.coffeeId),
        recipeId: pick(recipes, params.recipeId),
        userGrinderId: grinders.find((g) => g.defaultForFilter)?.id ?? (grinders.length === 1 ? grinders[0].id : null),
        brewerId: null,
        parentBrewId: null,
        coffeeDoseG: null,
        waterTargetG: null,
        waterTemperatureC: null,
        grindSettingText: null,
        grindSettingNumeric: null,
        grindSettingUnit: null,
      };

  return {
    coffees: coffees.map((c) => ({ id: c.id, name: c.name, roaster: c.roasterNameSnapshot, roastDate: c.roastDate?.toISOString() ?? null })),
    recipes,
    grinders: grinders.map((g) => ({
      id: g.id,
      label: grinderLabel(g),
      settingUnit: g.grinderModel.settingUnit,
      defaultForFilter: g.defaultForFilter,
      defaultForEspresso: g.defaultForEspresso,
    })),
    brewers: brewers.map((b) => ({ id: b.id, label: brewerLabel(b), methodType: b.methodType })),
    recentGrinds: recentGrinds.map((g) => ({
      recipeId: g.recipeId!,
      userGrinderId: g.userGrinderId!,
      grindSettingText: g.grindSettingText!,
      grindSettingNumeric: num(g.grindSettingNumeric),
      grindSettingUnit: g.grindSettingUnit,
    })),
    prefill,
  };
}
export type BrewSetupData = Awaited<ReturnType<typeof brewSetup>>;

// ---------------------------------------------------------------------------
// Home (§37)
// ---------------------------------------------------------------------------

export async function homeData(userId: string) {
  const [active, recentBrews, recentCoffees, favoriteRecipes, lastCompleted] = await Promise.all([
    prisma.brew.findMany({
      where: { ownerId: userId, status: "IN_PROGRESS" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, createdAt: true, recipeNameSnapshot: true, coffeeNameSnapshot: true },
    }),
    prisma.brew.findMany({ where: { ownerId: userId, status: "COMPLETED" }, orderBy: { completedAt: "desc" }, take: 5, select: brewListSelect }),
    prisma.coffee.findMany({
      where: { ...ownedBy(userId), ...notArchived },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, name: true, roasterNameSnapshot: true, roastDate: true, remainingWeightG: true },
    }),
    prisma.favorite.findMany({
      where: { ownerId: userId, recipeId: { not: null }, recipe: { archivedAt: null } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { recipe: { select: { id: true, name: true, methodType: true } } },
    }),
    prisma.brew.findFirst({
      where: { ownerId: userId, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { id: true, recipeNameSnapshot: true, coffeeNameSnapshot: true, coffeeDoseG: true, waterTargetG: true, grindSettingText: true },
    }),
  ]);
  return { active, recentBrews, recentCoffees, favoriteRecipes: favoriteRecipes.map((f) => f.recipe!).filter(Boolean), lastCompleted };
}
