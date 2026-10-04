import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { optionalNumber } from "@/lib/brewing/recipe";
import { GOOD_RATING } from "@/lib/brewing/tasting";
import { splitList } from "@/lib/format";
import { NotFoundError } from "./errors";
import { canEditShared, contains, notArchived, ownedBy, type Actor } from "./ownership";
import { sharedCoffeeData, text, updateSharedCoffee, type SharedCoffeeInput } from "./shared-coffees";

/**
 * A member's own bag of a shared coffee (§7): the roast date, weights, own
 * tags and notes - private to its owner. What is printed on the bag lives on
 * the `SharedCoffee` (`shared-coffees.ts`), visible to everyone.
 */

export { COMMON_PROCESSES, ROAST_LEVELS } from "./shared-coffees";

const date = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
      ctx.addIssue({ code: "custom", message: "date" });
      return z.NEVER;
    }
    return new Date(`${value}T00:00:00.000Z`);
  });

export const bagInput = z.object({
  roastDate: date,
  purchaseDate: date,
  openedDate: date,
  bagWeightG: optionalNumber(100_000),
  remainingWeightG: optionalNumber(100_000),
  userTags: z.unknown().transform((value) => splitList(value)),
  notes: text(4000),
});
export type BagInput = z.infer<typeof bagInput>;

/** The shared columns a bag list or detail shows. */
const sharedSummary = {
  id: true,
  name: true,
  roasterNameSnapshot: true,
  country: true,
  process: true,
  roastLevel: true,
  imageUpdatedAt: true,
} satisfies Prisma.SharedCoffeeSelect;

export async function listCoffees(userId: string, options: { q?: string; includeArchived?: boolean } = {}) {
  const q = options.q;
  return prisma.coffee.findMany({
    where: {
      ...ownedBy(userId),
      ...(options.includeArchived ? {} : notArchived),
      ...(q
        ? {
            OR: [
              { sharedCoffee: { OR: [{ name: contains(q) }, { roasterNameSnapshot: contains(q) }, { country: contains(q) }, { region: contains(q) }, { process: contains(q) }] } },
              { userTags: { has: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { updatedAt: "desc" }],
    select: {
      id: true,
      roastDate: true,
      remainingWeightG: true,
      archivedAt: true,
      sharedCoffee: { select: sharedSummary },
      _count: { select: { brews: true } },
    },
  });
}

/**
 * What a coffee form saves. `shared` is the bag's coffee: new values (a new
 * shared coffee, or an edit of the bag's one) or the id of an existing shared
 * coffee to add a bag of. Leaving it out on an edit changes only the bag.
 */
export type SaveCoffee = { bag: BagInput; shared?: { input: SharedCoffeeInput } | { id: string } };

/**
 * Creates or updates a bag, and with it the shared coffee where asked.
 *
 * A new shared coffee is created by the caller; editing an existing one goes
 * through `updateSharedCoffee`, so only its creator or an administrator can.
 */
export async function saveCoffee(actor: Actor, save: SaveCoffee, id?: string) {
  return prisma.$transaction(async (tx) => {
    if (!id) {
      let sharedCoffeeId: string;
      if (!save.shared) throw new NotFoundError("coffee");
      if ("id" in save.shared) {
        const existing = await tx.sharedCoffee.findUnique({ where: { id: save.shared.id }, select: { id: true } });
        if (!existing) throw new NotFoundError("coffee");
        sharedCoffeeId = existing.id;
      } else {
        const created = await tx.sharedCoffee.create({ data: { ...(await sharedCoffeeData(tx, actor.id, save.shared.input)), createdById: actor.id }, select: { id: true } });
        sharedCoffeeId = created.id;
      }
      return tx.coffee.create({ data: { ...save.bag, ownerId: actor.id, sharedCoffeeId } });
    }

    const bag = await tx.coffee.findFirst({ where: { id, ...ownedBy(actor.id) }, select: { sharedCoffeeId: true } });
    if (!bag) throw new NotFoundError("coffee");
    if (save.shared && "input" in save.shared) await updateSharedCoffee(tx, actor, bag.sharedCoffeeId, save.shared.input);
    return tx.coffee.update({ where: { id }, data: save.bag });
  });
}

export async function setCoffeeArchived(userId: string, id: string, archived: boolean) {
  const updated = await prisma.coffee.updateMany({ where: { id, ...ownedBy(userId) }, data: { archivedAt: archived ? new Date() : null } });
  if (updated.count !== 1) throw new NotFoundError("coffee");
}

/** A bag with its shared coffee, and whether the caller may edit the latter. */
export async function getCoffee(actor: Actor, id: string) {
  const coffee = await prisma.coffee.findFirst({ where: { id, ...ownedBy(actor.id) }, include: { sharedCoffee: { omit: { imageData: true } } } });
  if (!coffee) throw new NotFoundError("coffee");
  return { ...coffee, canEditShared: canEditShared(actor, coffee.sharedCoffee) };
}

/** Everything the coffee detail screen shows (§34). */
export async function getCoffeeDetail(actor: Actor, id: string) {
  const userId = actor.id;
  const coffee = await prisma.coffee.findFirst({
    where: { id, ...ownedBy(userId) },
    include: { sharedCoffee: { omit: { imageData: true }, include: { roaster: { select: { id: true, name: true, archivedAt: true } } } } },
  });
  if (!coffee) throw new NotFoundError("coffee");

  const brewWhere = { ownerId: userId, coffeeId: id, status: "COMPLETED" as const };
  const [count, rating, recent, best, favorite] = await Promise.all([
    prisma.brew.count({ where: brewWhere }),
    prisma.tasting.aggregate({ where: { brew: brewWhere }, _avg: { rating: true }, _count: { rating: true } }),
    prisma.brew.findMany({
      where: brewWhere,
      orderBy: { completedAt: "desc" },
      take: 8,
      select: brewListSelect,
    }),
    prisma.brew.findMany({
      where: { ...brewWhere, tasting: { rating: { gte: GOOD_RATING } } },
      orderBy: [{ tasting: { rating: "desc" } }, { completedAt: "desc" }],
      take: 3,
      select: brewListSelect,
    }),
    prisma.favorite.findUnique({ where: { ownerId_coffeeId: { ownerId: userId, coffeeId: id } }, select: { id: true } }),
  ]);

  // The recipe brewed most often with this coffee.
  const topRecipe = await prisma.brew.groupBy({
    by: ["recipeId"],
    where: { ...brewWhere, recipeId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { recipeId: "desc" } },
    take: 1,
  });
  const favoriteRecipe = topRecipe[0]?.recipeId
    ? await prisma.recipe.findFirst({ where: { id: topRecipe[0].recipeId, OR: [{ ownerId: null }, { ownerId: userId }] }, select: { id: true, name: true } })
    : null;

  const lastWithGrind = recent.find((brew) => brew.grindSettingText);

  return {
    coffee,
    canEditShared: canEditShared(actor, coffee.sharedCoffee),
    stats: { brewCount: count, averageRating: rating._avg.rating, ratedCount: rating._count.rating },
    recent,
    best,
    favoriteRecipe,
    lastGrind: lastWithGrind ? { text: lastWithGrind.grindSettingText, grinder: lastWithGrind.grinderSnapshot } : null,
    isFavorite: Boolean(favorite),
  };
}

/** The columns a brew list row needs. */
export const brewListSelect = {
  id: true,
  status: true,
  createdAt: true,
  completedAt: true,
  coffeeDoseG: true,
  waterTargetG: true,
  ratio: true,
  grindSettingText: true,
  actualDurationSeconds: true,
  recipeNameSnapshot: true,
  coffeeNameSnapshot: true,
  grinderSnapshot: true,
  tasting: { select: { rating: true, tags: true } },
} satisfies Prisma.BrewSelect;
