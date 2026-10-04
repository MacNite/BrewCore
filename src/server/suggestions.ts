/**
 * Members filling gaps in shared coffees and roasters they did not create
 * (§7, §8), and the creator or an administrator deciding.
 *
 * Adapted from NutriCore's food reports (`src/server/food-reports.ts`): a
 * person proposes, someone responsible decides, and a second open proposal
 * from the same person on the same entry is refused as a duplicate. Two rules
 * differ, because here the point is completing an entry, not disputing it:
 *
 *  - **Only gaps.** A suggestion carries values only for fields that are empty
 *    when it is filed, and accepting it writes only those that are *still*
 *    empty - a value the creator filled in the meantime wins.
 *  - **The creator decides**, not only an administrator: they added the entry
 *    and know the bag. An entry whose creator's account is gone is decided by
 *    administrators.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { emptyFields, fillGaps, isEmptyValue, type GapValue } from "@/lib/catalogue/gaps";
import { ConflictError, NotFoundError } from "./errors";
import { canEditShared, type Actor } from "./ownership";
import { SUGGESTIBLE_ROASTER_FIELDS, type roasterSuggestionInput } from "./roasters";
import {
  SUGGESTIBLE_COFFEE_FIELDS,
  resolveRoaster,
  suggestibleCoffeeValues,
  type SharedCoffeeSuggestionInput,
  type SuggestibleCoffeeField,
} from "./shared-coffees";
import type { z } from "zod";

type RoasterSuggestionInput = z.infer<typeof roasterSuggestionInput>;
type SuggestibleRoasterField = (typeof SUGGESTIBLE_ROASTER_FIELDS)[number];
type Image = { mime: string; data: Buffer };

/** Why a suggestion could not be filed. Each one is something to tell the member. */
export type SuggestionRefusal = "notSuggestable" | "duplicateSuggestion" | "emptySuggestion" | "altitudeRange";

const altitudeOrdered = (values: Partial<Record<string, GapValue>>) => {
  const min = values.altitudeMinMasl;
  const max = values.altitudeMaxMasl;
  return typeof min !== "number" || typeof max !== "number" || max >= min;
};

/** The empty fields of a shared coffee: what a suggestion form offers. */
export const coffeeGaps = (coffee: Parameters<typeof suggestibleCoffeeValues>[0]) =>
  emptyFields<SuggestibleCoffeeField>(suggestibleCoffeeValues(coffee), SUGGESTIBLE_COFFEE_FIELDS);

export const roasterGaps = (roaster: Record<SuggestibleRoasterField, string | null>) => emptyFields<SuggestibleRoasterField>(roaster, SUGGESTIBLE_ROASTER_FIELDS);

async function assertNoOpenSuggestion(authorId: string, target: { sharedCoffeeId: string } | { roasterId: string }) {
  const open = await prisma.catalogSuggestion.findFirst({ where: { authorId, status: "OPEN", ...target }, select: { id: true } });
  // A second open suggestion on the same entry is a double click or a second
  // thought, and either way the reviewer should see one.
  if (open) throw new ConflictError("duplicateSuggestion" satisfies SuggestionRefusal);
}

/** Files a gap-filling suggestion for a shared coffee. */
export async function submitCoffeeSuggestion(actor: Actor, sharedCoffeeId: string, input: SharedCoffeeSuggestionInput, image: Image | null) {
  const coffee = await prisma.sharedCoffee.findUnique({ where: { id: sharedCoffeeId }, omit: { imageData: true } });
  if (!coffee) throw new NotFoundError("coffee");
  // The creator and administrators edit directly; a suggestion would only
  // queue a decision for themselves.
  if (canEditShared(actor, coffee)) throw new ConflictError("notSuggestable" satisfies SuggestionRefusal);
  await assertNoOpenSuggestion(actor.id, { sharedCoffeeId });

  const current = suggestibleCoffeeValues(coffee);
  const values = fillGaps<SuggestibleCoffeeField>(current, input, SUGGESTIBLE_COFFEE_FIELDS);
  if (!altitudeOrdered({ ...current, ...values })) throw new ConflictError("altitudeRange" satisfies SuggestionRefusal);
  const photo = coffee.imageUpdatedAt ? null : image;
  if (Object.keys(values).length === 0 && !photo) throw new ConflictError("emptySuggestion" satisfies SuggestionRefusal);

  return prisma.catalogSuggestion.create({
    data: {
      authorId: actor.id,
      sharedCoffeeId,
      values: values as Prisma.InputJsonObject,
      ...(photo ? { imageData: new Uint8Array(photo.data), imageMime: photo.mime } : {}),
    },
    select: { id: true },
  });
}

/** Files a gap-filling suggestion for a roaster. */
export async function submitRoasterSuggestion(actor: Actor, roasterId: string, input: RoasterSuggestionInput) {
  const roaster = await prisma.roaster.findUnique({ where: { id: roasterId } });
  if (!roaster) throw new NotFoundError("roaster");
  if (canEditShared(actor, roaster)) throw new ConflictError("notSuggestable" satisfies SuggestionRefusal);
  await assertNoOpenSuggestion(actor.id, { roasterId });

  const values = fillGaps<SuggestibleRoasterField>(roaster, input, SUGGESTIBLE_ROASTER_FIELDS);
  if (Object.keys(values).length === 0) throw new ConflictError("emptySuggestion" satisfies SuggestionRefusal);
  return prisma.catalogSuggestion.create({ data: { authorId: actor.id, roasterId, values: values as Prisma.InputJsonObject }, select: { id: true } });
}

/** Only the suggestions an actor may decide: on entries they created, or all of them for an administrator. */
const reviewableBy = (actor: Actor): Prisma.CatalogSuggestionWhereInput =>
  actor.role === "ADMIN" ? {} : { OR: [{ sharedCoffee: { createdById: actor.id } }, { roaster: { createdById: actor.id } }] };

const SUGGESTION_SELECT = {
  id: true,
  values: true,
  imageMime: true,
  createdAt: true,
  authorId: true,
  sharedCoffee: { select: { id: true, name: true } },
  roaster: { select: { id: true, name: true } },
  author: { select: { username: true, profile: { select: { displayName: true } } } },
} satisfies Prisma.CatalogSuggestionSelect;

type SuggestionRow = Prisma.CatalogSuggestionGetPayload<{ select: typeof SUGGESTION_SELECT }>;

export interface OpenSuggestion {
  id: string;
  kind: "coffee" | "roaster";
  targetId: string;
  targetName: string;
  authorName: string;
  mine: boolean;
  createdAt: Date;
  values: Record<string, GapValue>;
  hasImage: boolean;
}

const toOpen = (actor: Actor) => (row: SuggestionRow): OpenSuggestion => {
  const target = row.sharedCoffee ?? row.roaster!;
  return {
    id: row.id,
    kind: row.sharedCoffee ? "coffee" : "roaster",
    targetId: target.id,
    targetName: target.name,
    authorName: row.author.profile?.displayName ?? row.author.username,
    mine: row.authorId === actor.id,
    createdAt: row.createdAt,
    values: Object.fromEntries(Object.entries((row.values ?? {}) as Record<string, GapValue>).filter(([, value]) => !isEmptyValue(value))),
    hasImage: Boolean(row.imageMime),
  };
};

/** Every open suggestion the actor may decide, oldest first. */
export async function reviewQueue(actor: Actor): Promise<OpenSuggestion[]> {
  const rows = await prisma.catalogSuggestion.findMany({
    where: { status: "OPEN", ...reviewableBy(actor) },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: SUGGESTION_SELECT,
  });
  return rows.map(toOpen(actor));
}

export async function reviewQueueCount(actor: Actor) {
  return prisma.catalogSuggestion.count({ where: { status: "OPEN", ...reviewableBy(actor) } });
}

/**
 * The open suggestions on one entry the actor may see: all of them for whoever
 * may decide, otherwise only their own.
 */
export async function openSuggestionsFor(actor: Actor, target: { sharedCoffeeId: string } | { roasterId: string }, canDecide: boolean) {
  const rows = await prisma.catalogSuggestion.findMany({
    where: { status: "OPEN", ...target, ...(canDecide ? {} : { authorId: actor.id }) },
    orderBy: { createdAt: "asc" },
    select: SUGGESTION_SELECT,
  });
  return rows.map(toOpen(actor));
}

/**
 * Accepts or rejects one suggestion. Accepting writes only the proposed
 * values whose fields are still empty, and the photo only if there still is
 * none. Either way the proposed photo's bytes are dropped afterwards.
 */
export async function decideSuggestion(actor: Actor, id: string, accept: boolean) {
  await prisma.$transaction(async (tx) => {
    const suggestion = await tx.catalogSuggestion.findFirst({
      where: { id, status: "OPEN" },
      include: { sharedCoffee: { omit: { imageData: true } }, roaster: true },
    });
    const target = suggestion?.sharedCoffee ?? suggestion?.roaster;
    // Not open, or not the actor's to decide: indistinguishable on purpose.
    if (!suggestion || !target || !canEditShared(actor, target)) throw new NotFoundError("suggestion");

    if (accept && suggestion.sharedCoffee) {
      const coffee = suggestion.sharedCoffee;
      const current = suggestibleCoffeeValues(coffee);
      const { roasterName, ...fill } = fillGaps<SuggestibleCoffeeField>(current, suggestion.values as Record<string, GapValue>, SUGGESTIBLE_COFFEE_FIELDS);
      // Filled by someone else since: a range that no longer fits is left out.
      if (!altitudeOrdered({ ...current, ...fill })) {
        delete fill.altitudeMinMasl;
        delete fill.altitudeMaxMasl;
      }
      const roaster = typeof roasterName === "string" ? await resolveRoaster(tx, suggestion.authorId, roasterName) : null;
      await tx.sharedCoffee.update({
        where: { id: coffee.id },
        data: {
          ...(fill as Prisma.SharedCoffeeUpdateInput),
          ...(roaster ? { roaster: { connect: { id: roaster.id } }, roasterNameSnapshot: roaster.name } : {}),
          ...(suggestion.imageData && suggestion.imageMime && !coffee.imageUpdatedAt
            ? { imageData: suggestion.imageData, imageMime: suggestion.imageMime, imageUpdatedAt: new Date() }
            : {}),
        },
      });
    } else if (accept && suggestion.roaster) {
      const fill = fillGaps<SuggestibleRoasterField>(suggestion.roaster, suggestion.values as Record<string, GapValue>, SUGGESTIBLE_ROASTER_FIELDS);
      await tx.roaster.update({ where: { id: suggestion.roaster.id }, data: fill as Prisma.RoasterUpdateInput });
    }

    await tx.catalogSuggestion.update({
      where: { id },
      data: { status: accept ? "ACCEPTED" : "REJECTED", reviewedById: actor.id, reviewedAt: new Date(), imageData: null },
    });
  });
}

/** A proposed photo, for its author and whoever may decide on it. */
export async function getSuggestionImage(actor: Actor, id: string) {
  const suggestion = await prisma.catalogSuggestion.findFirst({
    where: { id, imageData: { not: null } },
    select: { imageData: true, imageMime: true, authorId: true, sharedCoffee: { select: { createdById: true } } },
  });
  if (!suggestion?.sharedCoffee) return null;
  if (suggestion.authorId !== actor.id && !canEditShared(actor, suggestion.sharedCoffee)) return null;
  return suggestion;
}
