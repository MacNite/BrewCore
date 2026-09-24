import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { safeHttpUrl } from "@/lib/url";
import { num } from "@/lib/decimal";
import { splitList } from "@/lib/format";
import {
  GRIND_LEVELS,
  MAX_GRAMS,
  MAX_STEPS,
  METHOD_TYPES,
  optionalNumber,
  recipeStepInput,
  requiredNumber,
  stepProblems,
} from "@/lib/brewing/recipe";
import { ConflictError, NotFoundError } from "./errors";
import { contains, notArchived, ownedBy, visibleTo } from "./ownership";
import { brewListSelect } from "./coffees";
import { localizeBundledRecipe } from "@/lib/catalogue/recipes";
import type { Locale } from "@/i18n/locales";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

export const recipeInput = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: text(4000),
    brewerId: text(40),
    methodType: z.enum(METHOD_TYPES),
    defaultCoffeeDoseG: requiredNumber(1000),
    defaultWaterG: requiredNumber(MAX_GRAMS),
    targetYieldG: optionalNumber(MAX_GRAMS),
    waterTemperatureC: optionalNumber(100),
    grindDescription: z
      .enum(GRIND_LEVELS)
      .or(z.literal(""))
      .optional()
      .transform((value) => value || null),
    targetBrewTimeSeconds: z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().int().min(0).max(86_400).nullable()),
    servings: z.preprocess((v) => (v === "" || v === undefined ? 1 : Number(v)), z.number().int().min(1).max(20)),
    tags: z.unknown().transform((value) => splitList(value, 20)),
    sourceName: text(160),
    sourceUrl: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((value) => (value ? safeHttpUrl(value) ?? "invalid" : null))
      .refine((value) => value !== "invalid", { message: "url" }),
    authorName: text(120),
    steps: z.array(recipeStepInput).min(1).max(MAX_STEPS),
  })
  .superRefine((recipe, ctx) => {
    for (const { index, problem } of stepProblems(recipe.steps, recipe.defaultWaterG)) {
      ctx.addIssue({ code: "custom", message: problem, path: ["steps", index] });
    }
  });
export type RecipeInput = z.infer<typeof recipeInput>;

const stepOrder = { orderBy: { position: "asc" as const } };

export async function listRecipes(userId: string, locale: Locale, options: { q?: string; methodType?: string; includeArchived?: boolean } = {}) {
  const q = options.q;
  const [recipes, favorites] = await Promise.all([
    prisma.recipe.findMany({
      where: {
        ...visibleTo(userId),
        ...(options.includeArchived ? {} : notArchived),
        ...(options.methodType && (METHOD_TYPES as readonly string[]).includes(options.methodType) ? { methodType: options.methodType as (typeof METHOD_TYPES)[number] } : {}),
        ...(q ? { OR: [{ name: contains(q) }, { description: contains(q) }, { tags: { has: q } }, { authorName: contains(q) }] } : {}),
      },
      orderBy: [{ ownerId: { sort: "desc", nulls: "last" } }, { name: "asc" }],
      include: { brewer: { select: { id: true, manufacturer: true, model: true } }, _count: { select: { steps: true } } },
    }),
    prisma.favorite.findMany({ where: { ownerId: userId, recipeId: { not: null } }, select: { recipeId: true } }),
  ]);
  const favoriteIds = new Set(favorites.map((f) => f.recipeId));
  return recipes.map((recipe) => ({ ...localizeBundledRecipe(recipe, locale), isFavorite: favoriteIds.has(recipe.id) }));
}

export async function getRecipe(userId: string, id: string, locale: Locale = "en") {
  const recipe = await prisma.recipe.findFirst({
    where: { id, ...visibleTo(userId) },
    include: {
      steps: stepOrder,
      brewer: true,
      forkedFrom: { select: { id: true, name: true, ownerId: true } },
    },
  });
  if (!recipe) throw new NotFoundError("recipe");
  return localizeBundledRecipe(recipe, locale);
}

/** The recipe detail screen (§36). */
export async function getRecipeDetail(userId: string, id: string, locale: Locale) {
  const recipe = await getRecipe(userId, id, locale);
  const where = { ownerId: userId, recipeId: id, status: "COMPLETED" as const };
  const [recent, rating, favorite] = await Promise.all([
    prisma.brew.findMany({ where, orderBy: { completedAt: "desc" }, take: 8, select: brewListSelect }),
    prisma.tasting.aggregate({ where: { brew: where }, _avg: { rating: true }, _count: { rating: true } }),
    prisma.favorite.findUnique({ where: { ownerId_recipeId: { ownerId: userId, recipeId: id } }, select: { id: true } }),
  ]);
  return { recipe, recent, averageRating: rating._avg.rating, ratedCount: rating._count.rating, isFavorite: Boolean(favorite) };
}

async function assertBrewerVisible(tx: Prisma.TransactionClient, userId: string, brewerId: string | null) {
  if (!brewerId) return;
  const brewer = await tx.brewer.findFirst({ where: { id: brewerId, ...visibleTo(userId) }, select: { id: true } });
  if (!brewer) throw new NotFoundError("brewer");
}

const stepData = (steps: RecipeInput["steps"]) =>
  steps.map((step, index) => ({ ...step, position: index + 1 }));

/**
 * Creates or updates one of the caller's own recipes. Steps are replaced as a
 * whole in the same transaction, which is what makes reordering trivial.
 * Bundled recipes are never written here: editing one goes through
 * `duplicateRecipe` first (§42).
 */
export async function saveRecipe(userId: string, input: RecipeInput, id?: string) {
  const { steps, ...fields } = input;
  return prisma.$transaction(async (tx) => {
    await assertBrewerVisible(tx, userId, fields.brewerId);
    if (!id) {
      return tx.recipe.create({ data: { ...fields, ownerId: userId, steps: { create: stepData(steps) } } });
    }
    const existing = await tx.recipe.findFirst({ where: { id, ...ownedBy(userId) }, select: { id: true } });
    if (!existing) throw new NotFoundError("recipe");
    await tx.recipeStep.deleteMany({ where: { recipeId: id } });
    return tx.recipe.update({ where: { id }, data: { ...fields, steps: { create: stepData(steps) } } });
  });
}

/**
 * Copies a bundled or own recipe into an independent user recipe, keeping the
 * provenance fields of the original (§42–43).
 */
export async function duplicateRecipe(userId: string, id: string, copySuffix: string, locale: Locale) {
  // The copy is made in the reader's language: it is their recipe from now on.
  const source = await getRecipe(userId, id, locale);
  return prisma.recipe.create({
    data: {
      ownerId: userId,
      bundledKey: null,
      forkedFromRecipeId: source.id,
      name: `${source.name} ${copySuffix}`.slice(0, 160),
      description: source.description,
      brewerId: source.brewerId,
      methodType: source.methodType,
      defaultCoffeeDoseG: source.defaultCoffeeDoseG,
      defaultWaterG: source.defaultWaterG,
      targetYieldG: source.targetYieldG,
      waterTemperatureC: source.waterTemperatureC,
      grindDescription: source.grindDescription,
      targetBrewTimeSeconds: source.targetBrewTimeSeconds,
      servings: source.servings,
      tags: source.tags,
      sourceName: source.sourceName,
      sourceUrl: source.sourceUrl,
      authorName: source.authorName,
      steps: {
        create: source.steps.map((step) => ({
          position: step.position,
          type: step.type,
          title: step.title,
          instruction: step.instruction,
          durationSeconds: step.durationSeconds,
          targetElapsedSeconds: step.targetElapsedSeconds,
          targetElapsedMaxSeconds: step.targetElapsedMaxSeconds,
          waterTargetG: step.waterTargetG,
          temperatureC: step.temperatureC,
          requiresConfirmation: step.requiresConfirmation,
          autoAdvance: step.autoAdvance,
          metadata: step.metadata ?? undefined,
        })),
      },
    },
  });
}

export async function setRecipeArchived(userId: string, id: string, archived: boolean) {
  const updated = await prisma.recipe.updateMany({ where: { id, ...ownedBy(userId) }, data: { archivedAt: archived ? new Date() : null } });
  if (updated.count !== 1) {
    const bundled = await prisma.recipe.findFirst({ where: { id, ownerId: null }, select: { id: true } });
    if (bundled) throw new ConflictError("bundledReadOnly");
    throw new NotFoundError("recipe");
  }
}

/** A recipe as plain numbers, for client components (editor, brew setup). */
export function recipeToPlain(recipe: Awaited<ReturnType<typeof getRecipe>>) {
  return {
    id: recipe.id,
    ownerId: recipe.ownerId,
    name: recipe.name,
    description: recipe.description,
    brewerId: recipe.brewerId,
    brewerName: recipe.brewer ? [recipe.brewer.manufacturer, recipe.brewer.model].filter(Boolean).join(" ") : null,
    methodType: recipe.methodType,
    defaultCoffeeDoseG: num(recipe.defaultCoffeeDoseG)!,
    defaultWaterG: num(recipe.defaultWaterG)!,
    targetYieldG: num(recipe.targetYieldG),
    waterTemperatureC: num(recipe.waterTemperatureC),
    grindDescription: recipe.grindDescription,
    targetBrewTimeSeconds: recipe.targetBrewTimeSeconds,
    servings: recipe.servings,
    tags: recipe.tags,
    sourceName: recipe.sourceName,
    sourceUrl: recipe.sourceUrl,
    authorName: recipe.authorName,
    steps: recipe.steps.map((step) => ({
      id: step.id,
      position: step.position,
      type: step.type,
      title: step.title,
      instruction: step.instruction,
      durationSeconds: step.durationSeconds,
      targetElapsedSeconds: step.targetElapsedSeconds,
      targetElapsedMaxSeconds: step.targetElapsedMaxSeconds,
      waterTargetG: num(step.waterTargetG),
      temperatureC: num(step.temperatureC),
      requiresConfirmation: step.requiresConfirmation,
      autoAdvance: step.autoAdvance,
    })),
  };
}
export type PlainRecipe = ReturnType<typeof recipeToPlain>;
