/**
 * Finding and merging duplicate shared coffees and roasters (§7, §8).
 * Administrators only.
 *
 * A merge keeps one entry and folds the other into it: the kept entry's empty
 * fields are filled from the other (never overwritten, the same rule a
 * suggestion follows), every bag and open suggestion is moved over, and the
 * other entry is deleted. Brews are not touched - they point at bags, which
 * survive, and carry their own snapshots (§19).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fillGaps, type GapValue } from "@/lib/catalogue/gaps";
import { DUPLICATE_THRESHOLD, coffeeSimilarity, nameSimilarity, similarPairs } from "@/lib/catalogue/similarity";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors";
import type { Actor } from "./ownership";
import { SUGGESTIBLE_ROASTER_FIELDS } from "./roasters";
import { SUGGESTIBLE_COFFEE_FIELDS, suggestibleCoffeeValues } from "./shared-coffees";

const assertAdmin = (actor: Actor) => {
  if (actor.role !== "ADMIN") throw new ForbiddenError();
};

/** Likely duplicate coffees and roasters, best match first. */
export async function duplicateCandidates(actor: Actor) {
  assertAdmin(actor);
  const [coffees, roasters] = await Promise.all([
    prisma.sharedCoffee.findMany({
      select: { id: true, name: true, roasterNameSnapshot: true, country: true, createdAt: true, _count: { select: { bags: true } } },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
    prisma.roaster.findMany({
      select: { id: true, name: true, city: true, country: true, createdAt: true, _count: { select: { coffees: true } } },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
  ]);
  return {
    coffees: similarPairs(
      coffees,
      (a, b) => coffeeSimilarity({ name: a.name, roasterName: a.roasterNameSnapshot, country: a.country }, { name: b.name, roasterName: b.roasterNameSnapshot, country: b.country }),
      DUPLICATE_THRESHOLD,
    ),
    roasters: similarPairs(roasters, (a, b) => nameSimilarity(a.name, b.name), DUPLICATE_THRESHOLD),
  };
}

const assertDistinct = (keepId: string, dropId: string) => {
  if (keepId === dropId) throw new ConflictError("sameEntry");
};

/** Folds the shared coffee `dropId` into `keepId`. */
export async function mergeSharedCoffees(actor: Actor, keepId: string, dropId: string) {
  assertAdmin(actor);
  assertDistinct(keepId, dropId);
  await prisma.$transaction(async (tx) => {
    const [keep, drop] = await Promise.all([
      tx.sharedCoffee.findUnique({ where: { id: keepId }, omit: { imageData: true } }),
      tx.sharedCoffee.findUnique({ where: { id: dropId } }),
    ]);
    if (!keep || !drop) throw new NotFoundError("coffee");

    const keepValues = suggestibleCoffeeValues(keep);
    const { roasterName, ...fill } = fillGaps<string>(keepValues, suggestibleCoffeeValues(drop), SUGGESTIBLE_COFFEE_FIELDS);
    const altitude = { ...keepValues, ...fill } as Record<string, GapValue>;
    if (typeof altitude.altitudeMinMasl === "number" && typeof altitude.altitudeMaxMasl === "number" && altitude.altitudeMaxMasl < altitude.altitudeMinMasl) {
      delete fill.altitudeMinMasl;
      delete fill.altitudeMaxMasl;
    }
    await tx.sharedCoffee.update({
      where: { id: keepId },
      data: {
        ...(fill as Prisma.SharedCoffeeUpdateInput),
        ...(roasterName ? { roasterId: drop.roasterId, roasterNameSnapshot: drop.roasterNameSnapshot } : {}),
        ...(!keep.imageUpdatedAt && drop.imageData ? { imageData: drop.imageData, imageMime: drop.imageMime, imageUpdatedAt: new Date() } : {}),
        ...(keep.createdById ? {} : { createdById: drop.createdById }),
      } as Prisma.SharedCoffeeUncheckedUpdateInput,
    });
    await tx.coffee.updateMany({ where: { sharedCoffeeId: dropId }, data: { sharedCoffeeId: keepId } });
    await tx.catalogSuggestion.updateMany({ where: { sharedCoffeeId: dropId, status: "OPEN" }, data: { sharedCoffeeId: keepId } });
    await tx.sharedCoffee.delete({ where: { id: dropId } });
  });
}

/** Folds the roaster `dropId` into `keepId`. */
export async function mergeRoasters(actor: Actor, keepId: string, dropId: string) {
  assertAdmin(actor);
  assertDistinct(keepId, dropId);
  await prisma.$transaction(async (tx) => {
    const [keep, drop] = await Promise.all([tx.roaster.findUnique({ where: { id: keepId } }), tx.roaster.findUnique({ where: { id: dropId } })]);
    if (!keep || !drop) throw new NotFoundError("roaster");
    const fill = fillGaps(keep, drop, SUGGESTIBLE_ROASTER_FIELDS);
    await tx.roaster.update({
      where: { id: keepId },
      data: { ...(fill as Prisma.RoasterUncheckedUpdateInput), ...(keep.createdById ? {} : { createdById: drop.createdById }) },
    });
    await tx.sharedCoffee.updateMany({ where: { roasterId: dropId }, data: { roasterId: keepId, roasterNameSnapshot: keep.name } });
    await tx.catalogSuggestion.updateMany({ where: { roasterId: dropId, status: "OPEN" }, data: { roasterId: keepId } });
    await tx.roaster.delete({ where: { id: dropId } });
  });
}
