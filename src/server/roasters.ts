import { z } from "zod";
import { prisma } from "@/lib/db";
import { safeHttpUrl } from "@/lib/url";
import { NotFoundError } from "./errors";
import { contains, notArchived, ownedBy } from "./ownership";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

export const roasterInput = z.object({
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
});
export type RoasterInput = z.infer<typeof roasterInput>;

export async function listRoasters(userId: string, options: { q?: string; includeArchived?: boolean } = {}) {
  return prisma.roaster.findMany({
    where: {
      ...ownedBy(userId),
      ...(options.includeArchived ? {} : notArchived),
      ...(options.q ? { OR: [{ name: contains(options.q) }, { country: contains(options.q) }, { city: contains(options.q) }] } : {}),
    },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    include: { _count: { select: { coffees: true } } },
  });
}

export async function getRoaster(userId: string, id: string) {
  const roaster = await prisma.roaster.findFirst({
    where: { id, ...ownedBy(userId) },
    include: {
      coffees: { where: { ownerId: userId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, roastDate: true, archivedAt: true } },
    },
  });
  if (!roaster) throw new NotFoundError("roaster");
  return roaster;
}

export async function saveRoaster(userId: string, input: RoasterInput, id?: string) {
  if (!id) return prisma.roaster.create({ data: { ...input, ownerId: userId } });
  return prisma.$transaction(async (tx) => {
    const updated = await tx.roaster.updateMany({ where: { id, ...ownedBy(userId) }, data: input });
    if (updated.count !== 1) throw new NotFoundError("roaster");
    // Keep the name snapshot on this user's coffees in step with a rename.
    await tx.coffee.updateMany({ where: { roasterId: id, ownerId: userId }, data: { roasterNameSnapshot: input.name } });
    return tx.roaster.findUniqueOrThrow({ where: { id } });
  });
}

export async function setRoasterArchived(userId: string, id: string, archived: boolean) {
  const updated = await prisma.roaster.updateMany({ where: { id, ...ownedBy(userId) }, data: { archivedAt: archived ? new Date() : null } });
  if (updated.count !== 1) throw new NotFoundError("roaster");
}
