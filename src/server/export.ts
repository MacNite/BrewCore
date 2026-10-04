import { prisma } from "@/lib/db";

/**
 * Bump when the shape changes so a later importer can branch on it (§68).
 */
export const EXPORT_FORMAT_VERSION = 2;

/**
 * Everything the signed-in user owns, in one documented envelope. Password
 * hashes, sessions and invitations are deliberately excluded; bag photos are
 * exported as base64 so the file is complete on its own.
 *
 * Version 2 (coffee sharing, §7): `coffees` are the user's bags, each with the
 * shared coffee it is a bag of under `sharedCoffee`; `roasters` are the
 * roasters the user created plus those their coffees name. Suggestions the
 * user filed are included without their photo bytes.
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

  const [roasters, coffees, grinderModels, grinders, brewers, recipes, brews, favorites, suggestions] = await Promise.all([
    prisma.roaster.findMany({
      where: { OR: [{ createdById: userId }, { coffees: { some: { bags: { some: { ownerId: userId } } } } }] },
      orderBy: { createdAt: "asc" },
    }),
    prisma.coffee.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" }, include: { sharedCoffee: true } }),
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
    prisma.catalogSuggestion.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" }, omit: { imageData: true } }),
  ]);

  return {
    format: "brewcore-export",
    version: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    user,
    roasters,
    coffees: coffees.map(({ sharedCoffee: { imageData, ...shared }, ...coffee }) => ({
      ...coffee,
      sharedCoffee: { ...shared, image: imageData ? { mime: shared.imageMime, base64: Buffer.from(imageData).toString("base64") } : null },
    })),
    grinderModels,
    grinders,
    brewers,
    recipes,
    brews,
    tastings: brews.flatMap((brew) => (brew.tasting ? [brew.tasting] : [])),
    favorites,
    suggestions,
  };
}
