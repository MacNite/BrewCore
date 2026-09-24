/**
 * Bundled catalogue seed (§82). Safe to run in production and on every
 * deployment: it upserts by stable key and only ever touches rows with
 * `ownerId = null`. User grinders, brewers and recipes are never modified.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { BUNDLED_BREWERS } from "../src/lib/catalogue/brewers";
import { BUNDLED_GRINDERS } from "../src/lib/catalogue/grinders";
import { BUNDLED_RECIPES, BUNDLED_SOURCE_NAME } from "../src/lib/catalogue/recipes";

export async function seedCatalogue(prisma: PrismaClient) {
  for (const grinder of BUNDLED_GRINDERS) {
    // Recommendations are catalogue data looked up by slug, not persisted.
    const { slug, recommendations: _recommendations, recommendationSource: _source, ...data } = grinder;
    const existing = await prisma.grinderModel.findUnique({ where: { slug } });
    if (existing && existing.ownerId !== null) continue;
    await prisma.grinderModel.upsert({ where: { slug }, create: { slug, ownerId: null, ...data }, update: data });
  }

  const brewerIds = new Map<string, string>();
  for (const brewer of BUNDLED_BREWERS) {
    const { slug, ...data } = brewer;
    const existing = await prisma.brewer.findUnique({ where: { slug } });
    if (existing && existing.ownerId !== null) continue;
    const row = await prisma.brewer.upsert({ where: { slug }, create: { slug, ownerId: null, ...data }, update: data });
    brewerIds.set(slug, row.id);
  }

  for (const recipe of BUNDLED_RECIPES) {
    const data = {
      name: recipe.name.en,
      description: recipe.description.en,
      brewerId: recipe.brewerSlug ? (brewerIds.get(recipe.brewerSlug) ?? null) : null,
      methodType: recipe.methodType,
      defaultCoffeeDoseG: recipe.doseG,
      defaultWaterG: recipe.waterG,
      targetYieldG: recipe.targetYieldG ?? null,
      waterTemperatureC: recipe.temperatureC,
      grindDescription: recipe.grind,
      targetBrewTimeSeconds: recipe.targetBrewTimeSeconds,
      servings: 1,
      tags: recipe.tags,
      sourceName: BUNDLED_SOURCE_NAME,
      sourceUrl: null,
      authorName: null,
      archivedAt: null,
    };
    const steps = recipe.steps.map((step, index) => ({
      position: index + 1,
      type: step.type,
      title: null,
      instruction: step.instruction.en,
      durationSeconds: step.durationSeconds ?? null,
      targetElapsedSeconds: step.targetElapsedSeconds ?? null,
      targetElapsedMaxSeconds: step.targetElapsedMaxSeconds ?? null,
      waterTargetG: step.waterTargetG ?? null,
      temperatureC: null,
      requiresConfirmation: step.requiresConfirmation ?? false,
      autoAdvance: step.autoAdvance ?? false,
    }));

    await prisma.$transaction(async (tx) => {
      // Only bundled rows are ever matched: the key is unique, and a user copy
      // always has `bundledKey = null` (§42).
      const existing = await tx.recipe.findFirst({ where: { bundledKey: recipe.key, ownerId: null }, select: { id: true } });
      if (!existing) {
        await tx.recipe.create({ data: { ...data, ownerId: null, bundledKey: recipe.key, steps: { create: steps } } });
        return;
      }
      await tx.recipeStep.deleteMany({ where: { recipeId: existing.id } });
      await tx.recipe.update({ where: { id: existing.id }, data: { ...data, steps: { create: steps } } });
    });
  }

  return { grinders: BUNDLED_GRINDERS.length, brewers: BUNDLED_BREWERS.length, recipes: BUNDLED_RECIPES.length };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const counts = await seedCatalogue(prisma);
    console.log(`Bundled catalogue seeded: ${counts.grinders} grinder models, ${counts.brewers} brewers, ${counts.recipes} recipes.`);
  } finally {
    await prisma.$disconnect();
  }
}

// Run when executed directly (`tsx prisma/seed-catalogue.ts`), not when imported.
if (process.argv[1] && /seed-catalogue\.ts$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
