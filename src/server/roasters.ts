import { z } from "zod";
import { prisma } from "@/lib/db";
import { safeHttpUrl } from "@/lib/url";
import { ForbiddenError, NotFoundError } from "./errors";
import { canEditShared, contains, notArchived, type Actor } from "./ownership";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

const roasterFields = {
  name: z.string().trim().min(1).max(120),
  country: text(80),
  city: text(80),
  website: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? safeHttpUrl(value) ?? "invalid" : null))
    .refine((value) => value !== "invalid", { message: "url" }),
  notes: text(4000),
};
export const roasterInput = z.object(roasterFields);
/** What a suggestion may propose for a roaster: everything but the name. */
export const roasterSuggestionInput = roasterInput.omit({ name: true });
export const SUGGESTIBLE_ROASTER_FIELDS = ["country", "city", "website", "notes"] as const;
export type RoasterInput = z.infer<typeof roasterInput>;

/** Every roaster on the instance; roasters are shared (§8). */
export async function listRoasters(options: { q?: string; includeArchived?: boolean } = {}) {
  return prisma.roaster.findMany({
    where: {
      ...(options.includeArchived ? {} : notArchived),
      ...(options.q ? { OR: [{ name: contains(options.q) }, { country: contains(options.q) }, { city: contains(options.q) }] } : {}),
    },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    include: { _count: { select: { coffees: true } } },
  });
}

/** A roaster's page: the roaster, its shared coffees with the caller's bags, and who may edit it. */
export async function getRoaster(actor: Actor, id: string) {
  const roaster = await prisma.roaster.findUnique({
    where: { id },
    include: {
      createdBy: { select: { username: true, profile: { select: { displayName: true } } } },
      coffees: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, country: true, process: true, bags: { where: { ownerId: actor.id }, select: { id: true }, take: 1 } },
      },
    },
  });
  if (!roaster) throw new NotFoundError("roaster");
  const { createdBy, coffees, ...rest } = roaster;
  return {
    roaster: rest,
    coffees: coffees.map(({ bags, ...coffee }) => ({ ...coffee, myBagId: bags[0]?.id ?? null })),
    createdByName: createdBy ? (createdBy.profile?.displayName ?? createdBy.username) : null,
    canEdit: canEditShared(actor, roaster),
  };
}

/**
 * Creates a roaster (anyone) or updates one (its creator or an administrator).
 * A new roaster whose name already exists is that roaster, not a second one.
 */
export async function saveRoaster(actor: Actor, input: RoasterInput, id?: string) {
  if (!id) {
    const existing = await prisma.roaster.findFirst({ where: { name: { equals: input.name, mode: "insensitive" } }, orderBy: { createdAt: "asc" } });
    if (existing) return existing;
    return prisma.roaster.create({ data: { ...input, createdById: actor.id } });
  }
  return prisma.$transaction(async (tx) => {
    const current = await tx.roaster.findUnique({ where: { id }, select: { createdById: true } });
    if (!current) throw new NotFoundError("roaster");
    if (!canEditShared(actor, current)) throw new ForbiddenError();
    const roaster = await tx.roaster.update({ where: { id }, data: input });
    // Keep the name snapshot on the shared coffees in step with a rename.
    await tx.sharedCoffee.updateMany({ where: { roasterId: id }, data: { roasterNameSnapshot: input.name } });
    return roaster;
  });
}

export async function setRoasterArchived(actor: Actor, id: string, archived: boolean) {
  const current = await prisma.roaster.findUnique({ where: { id }, select: { createdById: true } });
  if (!current) throw new NotFoundError("roaster");
  if (!canEditShared(actor, current)) throw new ForbiddenError();
  await prisma.roaster.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
}
