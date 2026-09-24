import { z } from "zod";
import { prisma } from "@/lib/db";
import { NotFoundError } from "./errors";
import { ownedBy, visibleTo } from "./ownership";

export const favoriteTarget = z.union([
  z.object({ kind: z.literal("coffee"), id: z.string().min(1).max(40) }),
  z.object({ kind: z.literal("recipe"), id: z.string().min(1).max(40) }),
  z.object({ kind: z.literal("brew"), id: z.string().min(1).max(40) }),
]);
export type FavoriteTarget = z.infer<typeof favoriteTarget>;

/**
 * Adds or removes a favorite (§64). The target must be the caller's own coffee
 * or brew, or a bundled or own recipe — favoriting a bundled recipe is allowed.
 * Returns whether the target is a favorite afterwards.
 */
export async function toggleFavorite(userId: string, target: FavoriteTarget): Promise<boolean> {
  const exists =
    target.kind === "coffee"
      ? await prisma.coffee.findFirst({ where: { id: target.id, ...ownedBy(userId) }, select: { id: true } })
      : target.kind === "recipe"
        ? await prisma.recipe.findFirst({ where: { id: target.id, ...visibleTo(userId) }, select: { id: true } })
        : await prisma.brew.findFirst({ where: { id: target.id, ...ownedBy(userId) }, select: { id: true } });
  if (!exists) throw new NotFoundError(target.kind);

  const column = `${target.kind}Id` as "coffeeId" | "recipeId" | "brewId";
  const removed = await prisma.favorite.deleteMany({ where: { ownerId: userId, [column]: target.id } });
  if (removed.count > 0) return false;
  await prisma.favorite.createMany({ data: [{ ownerId: userId, [column]: target.id }], skipDuplicates: true });
  return true;
}
