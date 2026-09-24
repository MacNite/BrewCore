import { z } from "zod";
import type { Prisma, RoastLevel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { optionalNumber } from "@/lib/brewing/recipe";
import { GOOD_RATING } from "@/lib/brewing/tasting";
import { splitList } from "@/lib/format";
import { NotFoundError } from "./errors";
import { contains, notArchived, ownedBy } from "./ownership";

export const ROAST_LEVELS = ["LIGHT", "MEDIUM_LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK", "UNKNOWN"] as const satisfies readonly RoastLevel[];

/** Suggested in the UI; any free text is accepted (§7). */
export const COMMON_PROCESSES = ["Washed", "Natural", "Honey", "Anaerobic", "Carbonic Maceration", "Experimental", "Other"];

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

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

const altitude = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? null : Number(String(value).replace(",", "."))),
  z.number().int().min(0).max(9000).nullable(),
);

export const coffeeInput = z
  .object({
    name: z.string().trim().min(1).max(160),
    roasterName: text(120),
    country: text(80),
    region: text(120),
    farm: text(120),
    producer: text(120),
    varieties: z.unknown().transform((value) => splitList(value)),
    process: text(80),
    processingNotes: text(2000),
    altitudeMinMasl: altitude,
    altitudeMaxMasl: altitude,
    roastLevel: z.enum(ROAST_LEVELS).default("UNKNOWN"),
    roastDate: date,
    purchaseDate: date,
    openedDate: date,
    bagWeightG: optionalNumber(100_000),
    remainingWeightG: optionalNumber(100_000),
    roasterTastingNotes: z.unknown().transform((value) => splitList(value)),
    userTags: z.unknown().transform((value) => splitList(value)),
    description: text(4000),
    notes: text(4000),
  })
  .refine((c) => c.altitudeMinMasl === null || c.altitudeMaxMasl === null || c.altitudeMaxMasl >= c.altitudeMinMasl, {
    message: "altitudeRange",
    path: ["altitudeMaxMasl"],
  });
export type CoffeeInput = z.infer<typeof coffeeInput>;

export async function listCoffees(userId: string, options: { q?: string; includeArchived?: boolean } = {}) {
  const q = options.q;
  return prisma.coffee.findMany({
    where: {
      ...ownedBy(userId),
      ...(options.includeArchived ? {} : notArchived),
      ...(q
        ? { OR: [{ name: contains(q) }, { roasterNameSnapshot: contains(q) }, { country: contains(q) }, { region: contains(q) }, { process: contains(q) }] }
        : {}),
    },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      roasterNameSnapshot: true,
      country: true,
      process: true,
      roastLevel: true,
      roastDate: true,
      remainingWeightG: true,
      archivedAt: true,
      imageUpdatedAt: true,
      _count: { select: { brews: true } },
    },
  });
}

/** Finds the caller's roaster by name, or creates it; null for no roaster. */
async function resolveRoaster(tx: Prisma.TransactionClient, userId: string, name: string | null) {
  if (!name) return null;
  const existing = await tx.roaster.findFirst({ where: { ownerId: userId, name: { equals: name, mode: "insensitive" } } });
  if (existing) return existing;
  return tx.roaster.create({ data: { ownerId: userId, name } });
}

export async function saveCoffee(userId: string, input: CoffeeInput, id?: string) {
  const { roasterName, ...fields } = input;
  return prisma.$transaction(async (tx) => {
    const roaster = await resolveRoaster(tx, userId, roasterName);
    const data = { ...fields, roasterId: roaster?.id ?? null, roasterNameSnapshot: roaster?.name ?? null };
    if (!id) return tx.coffee.create({ data: { ...data, ownerId: userId } });
    const updated = await tx.coffee.updateMany({ where: { id, ...ownedBy(userId) }, data });
    if (updated.count !== 1) throw new NotFoundError("coffee");
    return tx.coffee.findUniqueOrThrow({ where: { id } });
  });
}

export async function setCoffeeArchived(userId: string, id: string, archived: boolean) {
  const updated = await prisma.coffee.updateMany({ where: { id, ...ownedBy(userId) }, data: { archivedAt: archived ? new Date() : null } });
  if (updated.count !== 1) throw new NotFoundError("coffee");
}

export async function setCoffeeImage(userId: string, id: string, image: { mime: string; data: Buffer } | null) {
  const updated = await prisma.coffee.updateMany({
    where: { id, ...ownedBy(userId) },
    data: image
      ? { imageData: new Uint8Array(image.data), imageMime: image.mime, imageUpdatedAt: new Date() }
      : { imageData: null, imageMime: null, imageUpdatedAt: null },
  });
  if (updated.count !== 1) throw new NotFoundError("coffee");
}

export async function getCoffeeImage(userId: string, id: string) {
  return prisma.coffee.findFirst({ where: { id, ...ownedBy(userId), imageData: { not: null } }, select: { imageData: true, imageMime: true, imageUpdatedAt: true } });
}

export async function getCoffee(userId: string, id: string) {
  const coffee = await prisma.coffee.findFirst({ where: { id, ...ownedBy(userId) }, omit: { imageData: true } });
  if (!coffee) throw new NotFoundError("coffee");
  return coffee;
}

/** Everything the coffee detail screen shows (§34). */
export async function getCoffeeDetail(userId: string, id: string) {
  const coffee = await prisma.coffee.findFirst({
    where: { id, ...ownedBy(userId) },
    omit: { imageData: true },
    include: { roaster: { select: { id: true, name: true, archivedAt: true } } },
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
