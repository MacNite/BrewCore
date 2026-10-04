import { z } from "zod";
import type { Prisma, RoastLevel } from "@prisma/client";
import { prisma } from "@/lib/db";
import { splitList } from "@/lib/format";
import { SUGGEST_THRESHOLD, coffeeSimilarity } from "@/lib/catalogue/similarity";
import { ForbiddenError, NotFoundError } from "./errors";
import { canEditShared, contains, type Actor } from "./ownership";

/**
 * The shared half of a coffee (§7): what is printed on the bag, visible to
 * every member. Its creator and administrators edit it; everyone else fills
 * gaps through a suggestion (`suggestions.ts`). A member's own bag of it -
 * roast date, weights, tags, notes - is a `Coffee` (`coffees.ts`).
 */

export const ROAST_LEVELS = ["LIGHT", "MEDIUM_LIGHT", "MEDIUM", "MEDIUM_DARK", "DARK", "UNKNOWN"] as const satisfies readonly RoastLevel[];

/** Suggested in the UI; any free text is accepted (§7). */
export const COMMON_PROCESSES = ["Washed", "Natural", "Honey", "Anaerobic", "Carbonic Maceration", "Experimental", "Other"];

export const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

const altitude = z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? null : Number(String(value).replace(",", "."))),
  z.number().int().min(0).max(9000).nullable(),
);

const altitudeOrdered = (c: { altitudeMinMasl: number | null; altitudeMaxMasl: number | null }) =>
  c.altitudeMinMasl === null || c.altitudeMaxMasl === null || c.altitudeMaxMasl >= c.altitudeMinMasl;

const sharedFields = {
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
  roasterTastingNotes: z.unknown().transform((value) => splitList(value)),
  description: text(4000),
};

export const sharedCoffeeInput = z
  .object({ name: z.string().trim().min(1).max(160), ...sharedFields })
  .refine(altitudeOrdered, { message: "altitudeRange", path: ["altitudeMaxMasl"] });
export type SharedCoffeeInput = z.infer<typeof sharedCoffeeInput>;

/** What a suggestion may propose: everything but the name, all optional. */
export const sharedCoffeeSuggestionInput = z.object(sharedFields);
export type SharedCoffeeSuggestionInput = z.infer<typeof sharedCoffeeSuggestionInput>;

/** The fields a suggestion may fill, in form order. `roasterName` stands for the roaster. */
export const SUGGESTIBLE_COFFEE_FIELDS = [
  "roasterName",
  "roastLevel",
  "country",
  "region",
  "farm",
  "producer",
  "varieties",
  "process",
  "processingNotes",
  "altitudeMinMasl",
  "altitudeMaxMasl",
  "roasterTastingNotes",
  "description",
] as const;
export type SuggestibleCoffeeField = (typeof SUGGESTIBLE_COFFEE_FIELDS)[number];

/** A shared coffee's current values, keyed like the suggestion fields. */
export const suggestibleCoffeeValues = (coffee: {
  roasterNameSnapshot: string | null;
  roastLevel: RoastLevel;
  country: string | null;
  region: string | null;
  farm: string | null;
  producer: string | null;
  varieties: string[];
  process: string | null;
  processingNotes: string | null;
  altitudeMinMasl: number | null;
  altitudeMaxMasl: number | null;
  roasterTastingNotes: string[];
  description: string | null;
}) => ({
  roasterName: coffee.roasterNameSnapshot,
  roastLevel: coffee.roastLevel,
  country: coffee.country,
  region: coffee.region,
  farm: coffee.farm,
  producer: coffee.producer,
  varieties: coffee.varieties,
  process: coffee.process,
  processingNotes: coffee.processingNotes,
  altitudeMinMasl: coffee.altitudeMinMasl,
  altitudeMaxMasl: coffee.altitudeMaxMasl,
  roasterTastingNotes: coffee.roasterTastingNotes,
  description: coffee.description,
});

/**
 * Finds a roaster by name across the instance, or creates it; null for no
 * roaster. Roasters are shared, so typing a name another member already
 * entered reuses theirs instead of adding a second one.
 */
export async function resolveRoaster(tx: Prisma.TransactionClient, userId: string, name: string | null) {
  if (!name) return null;
  const existing = await tx.roaster.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return tx.roaster.create({ data: { createdById: userId, name } });
}

/** The column values of a shared coffee for `input`, resolving the roaster. */
export async function sharedCoffeeData(tx: Prisma.TransactionClient, userId: string, input: SharedCoffeeInput) {
  const { roasterName, ...fields } = input;
  const roaster = await resolveRoaster(tx, userId, roasterName);
  return { ...fields, roasterId: roaster?.id ?? null, roasterNameSnapshot: roaster?.name ?? null };
}

/** Updates a shared coffee; only its creator or an administrator may. */
export async function updateSharedCoffee(tx: Prisma.TransactionClient, actor: Actor, id: string, input: SharedCoffeeInput) {
  const current = await tx.sharedCoffee.findUnique({ where: { id }, select: { createdById: true } });
  if (!current) throw new NotFoundError("coffee");
  if (!canEditShared(actor, current)) throw new ForbiddenError();
  return tx.sharedCoffee.update({ where: { id }, data: await sharedCoffeeData(tx, actor.id, input), omit: { imageData: true } });
}

export async function saveSharedCoffee(actor: Actor, id: string, input: SharedCoffeeInput) {
  return prisma.$transaction((tx) => updateSharedCoffee(tx, actor, id, input));
}

export async function setSharedCoffeeImage(actor: Actor, id: string, image: { mime: string; data: Buffer } | null) {
  const current = await prisma.sharedCoffee.findUnique({ where: { id }, select: { createdById: true } });
  if (!current) throw new NotFoundError("coffee");
  if (!canEditShared(actor, current)) throw new ForbiddenError();
  await prisma.sharedCoffee.update({
    where: { id },
    data: image
      ? { imageData: new Uint8Array(image.data), imageMime: image.mime, imageUpdatedAt: new Date() }
      : { imageData: null, imageMime: null, imageUpdatedAt: null },
  });
}

/** The photo of a shared coffee; every signed-in member may see it. */
export async function getSharedCoffeeImage(id: string) {
  return prisma.sharedCoffee.findFirst({ where: { id, imageData: { not: null } }, select: { imageData: true, imageMime: true, imageUpdatedAt: true } });
}

/** The catalogue every member browses, with whether the caller has a bag of each. */
export async function listSharedCoffees(userId: string, options: { q?: string } = {}) {
  const q = options.q;
  const rows = await prisma.sharedCoffee.findMany({
    where: q
      ? { OR: [{ name: contains(q) }, { roasterNameSnapshot: contains(q) }, { country: contains(q) }, { region: contains(q) }, { process: contains(q) }] }
      : {},
    orderBy: [{ name: "asc" }],
    take: 200,
    select: {
      id: true,
      name: true,
      roasterNameSnapshot: true,
      country: true,
      process: true,
      roastLevel: true,
      imageUpdatedAt: true,
      bags: { where: { ownerId: userId }, select: { id: true }, take: 1 },
    },
  });
  return rows.map(({ bags, ...row }) => ({ ...row, myBagId: bags[0]?.id ?? null }));
}

/** A shared coffee's page: the entry, who added it, and the caller's own bags of it. */
export async function getSharedCoffee(actor: Actor, id: string) {
  const coffee = await prisma.sharedCoffee.findUnique({
    where: { id },
    omit: { imageData: true },
    include: {
      roaster: { select: { id: true, name: true } },
      createdBy: { select: { username: true, profile: { select: { displayName: true } } } },
      bags: { where: { ownerId: actor.id }, orderBy: { createdAt: "desc" }, select: { id: true, roastDate: true, archivedAt: true } },
    },
  });
  if (!coffee) throw new NotFoundError("coffee");
  const { createdBy, bags, ...rest } = coffee;
  return {
    coffee: rest,
    createdByName: createdBy ? (createdBy.profile?.displayName ?? createdBy.username) : null,
    myBags: bags,
    canEdit: canEditShared(actor, coffee),
  };
}

export interface SimilarCoffee {
  id: string;
  name: string;
  roaster: string | null;
  country: string | null;
  hasImage: boolean;
  score: number;
}

/**
 * Shared coffees that may be the one being entered (§7), best first.
 *
 * Scored in memory with the pure `coffeeSimilarity`: a self-hosted catalogue
 * is small, and a fuzzy match is exactly what `ILIKE` cannot do.
 */
export async function findSimilarCoffees(query: { name: string; roasterName?: string | null; country?: string | null }, options: { excludeId?: string; limit?: number } = {}): Promise<SimilarCoffee[]> {
  if (query.name.trim().length < 3) return [];
  const rows = await prisma.sharedCoffee.findMany({
    where: options.excludeId ? { id: { not: options.excludeId } } : {},
    select: { id: true, name: true, roasterNameSnapshot: true, country: true, imageUpdatedAt: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      roaster: row.roasterNameSnapshot,
      country: row.country,
      hasImage: Boolean(row.imageUpdatedAt),
      score: coffeeSimilarity(query, { name: row.name, roasterName: row.roasterNameSnapshot, country: row.country }),
    }))
    .filter((row) => row.score >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, options.limit ?? 5);
}
