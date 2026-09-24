import { z } from "zod";
import type { GrinderAdjustmentType, GrinderType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { optionalNumber } from "@/lib/brewing/recipe";
import { GOOD_RATING } from "@/lib/brewing/tasting";
import { NotFoundError } from "./errors";
import { contains, notArchived, ownedBy, visibleTo } from "./ownership";
import { brewListSelect } from "./coffees";

export const GRINDER_TYPES = ["HAND", "ELECTRIC", "BUILT_IN"] as const satisfies readonly GrinderType[];
export const ADJUSTMENT_TYPES = ["CLICK", "NUMBER", "STEPLESS", "MICRON", "CUSTOM"] as const satisfies readonly GrinderAdjustmentType[];

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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      ctx.addIssue({ code: "custom", message: "date" });
      return z.NEVER;
    }
    return new Date(`${value}T00:00:00.000Z`);
  });

const checkbox = z.preprocess((value) => value === "on" || value === "true" || value === true, z.boolean());

export const grinderModelInput = z.object({
  manufacturer: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  type: z.enum(GRINDER_TYPES),
  burrType: text(80),
  burrDiameterMm: z.preprocess((v) => (v === "" || v === undefined ? null : Number(v)), z.number().int().min(1).max(200).nullable()),
  adjustmentType: z.enum(ADJUSTMENT_TYPES),
  settingUnit: text(40),
  minSetting: optionalNumber(100_000),
  maxSetting: optionalNumber(100_000),
  notes: text(2000),
});
export type GrinderModelInput = z.infer<typeof grinderModelInput>;

export const userGrinderInput = z.object({
  grinderModelId: z.string().min(1),
  nickname: text(80),
  burrDescription: text(200),
  burrInstallDate: date,
  zeroPoint: text(120),
  calibrationNotes: text(2000),
  defaultForFilter: checkbox,
  defaultForEspresso: checkbox,
});
export type UserGrinderInput = z.infer<typeof userGrinderInput>;

export async function listGrinderModels(userId: string, q?: string) {
  return prisma.grinderModel.findMany({
    where: { ...visibleTo(userId), ...notArchived, ...(q ? { OR: [{ manufacturer: contains(q) }, { model: contains(q) }] } : {}) },
    orderBy: [{ manufacturer: "asc" }, { model: "asc" }],
  });
}

export async function createGrinderModel(userId: string, input: GrinderModelInput) {
  return prisma.grinderModel.create({ data: { ...input, ownerId: userId, slug: null } });
}

export const grinderLabel = (grinder: { nickname: string | null; grinderModel: { manufacturer: string; model: string } }) =>
  grinder.nickname
    ? `${grinder.nickname} (${grinder.grinderModel.manufacturer} ${grinder.grinderModel.model})`
    : `${grinder.grinderModel.manufacturer} ${grinder.grinderModel.model}`;

export async function listUserGrinders(userId: string, options: { includeArchived?: boolean } = {}) {
  return prisma.userGrinder.findMany({
    where: { ...ownedBy(userId), ...(options.includeArchived ? {} : notArchived) },
    orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    include: { grinderModel: true, _count: { select: { brews: true } } },
  });
}

export async function saveUserGrinder(userId: string, input: UserGrinderInput, id?: string) {
  return prisma.$transaction(async (tx) => {
    // The model must be bundled or the caller's own custom model (§45).
    const model = await tx.grinderModel.findFirst({ where: { id: input.grinderModelId, ...visibleTo(userId) } });
    if (!model) throw new NotFoundError("grinderModel");

    // At most one default per purpose.
    if (input.defaultForFilter) await tx.userGrinder.updateMany({ where: { ownerId: userId, NOT: id ? { id } : undefined }, data: { defaultForFilter: false } });
    if (input.defaultForEspresso) await tx.userGrinder.updateMany({ where: { ownerId: userId, NOT: id ? { id } : undefined }, data: { defaultForEspresso: false } });

    if (!id) return tx.userGrinder.create({ data: { ...input, ownerId: userId } });
    const updated = await tx.userGrinder.updateMany({ where: { id, ...ownedBy(userId) }, data: input });
    if (updated.count !== 1) throw new NotFoundError("grinder");
    return tx.userGrinder.findUniqueOrThrow({ where: { id } });
  });
}

export async function setUserGrinderArchived(userId: string, id: string, archived: boolean) {
  const updated = await prisma.userGrinder.updateMany({ where: { id, ...ownedBy(userId) }, data: { archivedAt: archived ? new Date() : null } });
  if (updated.count !== 1) throw new NotFoundError("grinder");
}

export async function getUserGrinder(userId: string, id: string) {
  const grinder = await prisma.userGrinder.findFirst({ where: { id, ...ownedBy(userId) }, include: { grinderModel: true } });
  if (!grinder) throw new NotFoundError("grinder");
  return grinder;
}

/** The grinder detail screen (§35). */
export async function getUserGrinderDetail(userId: string, id: string) {
  const grinder = await getUserGrinder(userId, id);
  const where = { ownerId: userId, userGrinderId: id, status: "COMPLETED" as const };
  const [recent, best, combinations] = await Promise.all([
    prisma.brew.findMany({ where, orderBy: { completedAt: "desc" }, take: 10, select: brewListSelect }),
    prisma.brew.findMany({
      where: { ...where, tasting: { rating: { gte: GOOD_RATING } }, grindSettingText: { not: null } },
      orderBy: [{ tasting: { rating: "desc" } }, { completedAt: "desc" }],
      take: 5,
      select: brewListSelect,
    }),
    prisma.brew.groupBy({
      by: ["coffeeNameSnapshot", "recipeNameSnapshot"],
      where,
      _count: { _all: true },
      _max: { completedAt: true },
      orderBy: { _max: { completedAt: "desc" } },
      take: 10,
    }),
  ]);
  return { grinder, recent, best, combinations };
}
