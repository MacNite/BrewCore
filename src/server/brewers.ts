import { z } from "zod";
import { prisma } from "@/lib/db";
import { METHOD_TYPES } from "@/lib/brewing/recipe";
import { NotFoundError } from "./errors";
import { localizeBundledRecipe } from "@/lib/catalogue/recipes";
import type { Locale } from "@/i18n/locales";
import { contains, notArchived, ownedBy, visibleTo } from "./ownership";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);

export const brewerInput = z.object({
  manufacturer: text(80),
  model: z.string().trim().min(1).max(120),
  methodType: z.enum(METHOD_TYPES),
  capacityMl: z.preprocess((v) => (v === "" || v === undefined ? null : Number(v)), z.number().int().min(1).max(20_000).nullable()),
  description: text(2000),
});
export type BrewerInput = z.infer<typeof brewerInput>;

export const brewerLabel = (brewer: { manufacturer: string | null; model: string }) =>
  brewer.manufacturer ? `${brewer.manufacturer} ${brewer.model}` : brewer.model;

export async function listBrewers(userId: string, q?: string) {
  return prisma.brewer.findMany({
    where: { ...visibleTo(userId), ...notArchived, ...(q ? { OR: [{ manufacturer: contains(q) }, { model: contains(q) }] } : {}) },
    orderBy: [{ ownerId: { sort: "asc", nulls: "first" } }, { model: "asc" }],
  });
}

export async function getBrewer(userId: string, id: string, locale: Locale) {
  const brewer = await prisma.brewer.findFirst({
    where: { id, ...visibleTo(userId) },
    include: {
      recipes: { where: { ...visibleTo(userId), ...notArchived }, orderBy: { name: "asc" }, select: { id: true, name: true, ownerId: true, bundledKey: true, description: true } },
    },
  });
  if (!brewer) throw new NotFoundError("brewer");
  const brewCount = await prisma.brew.count({ where: { ownerId: userId, brewerId: id, status: "COMPLETED" } });
  return { brewer: { ...brewer, recipes: brewer.recipes.map((recipe) => localizeBundledRecipe(recipe, locale)) }, brewCount };
}

export async function createBrewer(userId: string, input: BrewerInput) {
  return prisma.brewer.create({ data: { ...input, ownerId: userId, slug: null } });
}

/** Only custom brewers can be archived; bundled ones belong to nobody. */
export async function setBrewerArchived(userId: string, id: string, archived: boolean) {
  const updated = await prisma.brewer.updateMany({ where: { id, ...ownedBy(userId) }, data: { archivedAt: archived ? new Date() : null } });
  if (updated.count !== 1) throw new NotFoundError("brewer");
}
