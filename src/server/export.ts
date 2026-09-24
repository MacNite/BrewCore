import { prisma } from "@/lib/db";

/**
 * Bump when the shape changes so a later importer can branch on it (§68).
 */
export const EXPORT_FORMAT_VERSION = 1;

/**
 * Everything the signed-in user owns, in one documented envelope. Password
 * hashes, sessions and invitations are deliberately excluded; bag photos are
 * exported as base64 so the file is complete on its own.
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      username: true,
      createdAt: true,
      profile: { select: { displayName: true, language: true, theme: true, cueSound: true, cueVibration: true } },
    },
  });

  const [roasters, coffees, grinderModels, grinders, brewers, recipes, brews, favorites] = await Promise.all([
    prisma.roaster.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.coffee.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.grinderModel.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.userGrinder.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      include: { grinderModel: { select: { slug: true, manufacturer: true, model: true } } },
    }),
    prisma.brewer.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } }),
    prisma.recipe.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      include: { steps: { orderBy: { position: "asc" } } },
    }),
    prisma.brew.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      include: { stepResults: { orderBy: { position: "asc" } }, tasting: true },
    }),
    prisma.favorite.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    format: "brewcore-export",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    user,
    roasters,
    coffees: coffees.map(({ imageData, ...coffee }) => ({
      ...coffee,
      image: imageData ? { mime: coffee.imageMime, base64: Buffer.from(imageData).toString("base64") } : null,
    })),
    grinderModels,
    grinders,
    brewers,
    recipes,
    brews,
    tastings: brews.flatMap((brew) => (brew.tasting ? [brew.tasting] : [])),
    favorites,
  };
}
