/**
 * Integration tests against a real PostgreSQL (§105). Skipped automatically
 * when TEST_DATABASE_URL is not configured; CI always sets it.
 *
 * They call the server modules directly, exactly as the Server Actions and
 * route handlers do, so ownership, transactions and constraints are the real
 * ones.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;
if (url) process.env.DATABASE_URL = url;

describeDb("brewing against PostgreSQL", async () => {
  const { prisma } = await import("@/lib/db");
  const { seedCatalogue } = await import("../prisma/seed-catalogue");
  const { saveCoffee } = await import("@/server/coffees");
  const { saveUserGrinder } = await import("@/server/grinders");
  const { duplicateRecipe, saveRecipe, getRecipe, recipeToPlain, recipeInput } = await import("@/server/recipes");
  const { abortBrew, completeBrew, getBrewDetail, saveTasting, startBrew } = await import("@/server/brews");
  const { toggleFavorite } = await import("@/server/favorites");
  const { NotFoundError, ConflictError } = await import("@/server/errors");
  const { createLiveBrew, transition, completionPayload } = await import("@/lib/brewing/state-machine");
  const { completionInput } = await import("@/server/brews");

  const stamp = Date.now().toString(36);
  /** A recipe the way its form submits it: empty fields are absent, not null. */
  const asForm = (value: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(value).map(([key, v]) => [key, v === null && key !== "steps" ? undefined : v]));
  let alice: string;
  let bob: string;
  let v60: string;

  const makeUser = (name: string) =>
    prisma.user.create({
      data: { email: `${name}-${stamp}@example.test`, username: `${name}${stamp}`, passwordHash: "x", profile: { create: { displayName: name, onboardedAt: new Date() } } },
    });

  beforeAll(async () => {
    await seedCatalogue(prisma);
    alice = (await makeUser("alice")).id;
    bob = (await makeUser("bob")).id;
    v60 = (await prisma.recipe.findUniqueOrThrow({ where: { bundledKey: "v60-two-pour" } })).id;
  }, 60_000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } });
    await prisma.$disconnect();
  });

  const coffeeInput = (name: string) => ({
    name,
    roasterName: "Integration Roastery",
    country: null,
    region: null,
    farm: null,
    producer: null,
    varieties: [],
    process: "Washed",
    processingNotes: null,
    altitudeMinMasl: null,
    altitudeMaxMasl: null,
    roastLevel: "LIGHT" as const,
    roastDate: new Date("2026-09-01T00:00:00Z"),
    purchaseDate: null,
    openedDate: null,
    bagWeightG: 250,
    remainingWeightG: 250,
    roasterTastingNotes: [],
    userTags: [],
    description: null,
    notes: null,
  });

  const start = (userId: string, extra: Record<string, unknown> = {}) =>
    startBrew(
      userId,
      {
        recipeId: v60,
        coffeeId: null,
        userGrinderId: null,
        brewerId: null,
        parentBrewId: null,
        coffeeDoseG: 25,
        waterTargetG: 400,
        waterTemperatureC: 94,
        grindSettingText: "24 clicks",
        grindSettingNumeric: 24,
        grindSettingUnit: "clicks",
        grindSettingNote: null,
        ...extra,
      },
      "Brew",
      "en",
    );

  it("seeds the bundled catalogue idempotently", async () => {
    const before = await prisma.recipe.count({ where: { ownerId: null } });
    await seedCatalogue(prisma);
    expect(await prisma.recipe.count({ where: { ownerId: null } })).toBe(before);
    expect(await prisma.recipeStep.count({ where: { recipeId: v60 } })).toBe(8);
  });

  it("creates a brew with scaled snapshots in one go", async () => {
    const coffee = await saveCoffee(alice, coffeeInput("Snapshot Coffee"));
    const { id } = await start(alice, { coffeeId: coffee.id });
    const { brew, snapshot } = await getBrewDetail(alice, id);
    expect(brew.status).toBe("IN_PROGRESS");
    expect(brew.coffeeNameSnapshot).toBe("Snapshot Coffee");
    expect(brew.roasterSnapshot).toBe("Integration Roastery");
    expect(Number(brew.ratio)).toBe(16);
    expect(snapshot?.steps.map((s) => s.waterTargetG).filter((w) => w !== null)).toEqual([75, 250, 400]);
    expect(brew.brewerSnapshot).toBe("Hario V60 02");
  });

  it("keeps yesterday's brew when the coffee and recipe change today", async () => {
    const coffee = await saveCoffee(alice, coffeeInput("Before Rename"));
    const copy = await duplicateRecipe(alice, v60, "(copy)", "en");
    const { id } = await start(alice, { coffeeId: coffee.id, recipeId: copy.id });

    await saveCoffee(alice, { ...coffeeInput("After Rename") }, coffee.id);
    const plain = recipeToPlain(await getRecipe(alice, copy.id));
    await saveRecipe(
      alice,
      recipeInput.parse({
        ...asForm(plain),
        name: "Changed recipe",
        description: plain.description,
        brewerId: plain.brewerId,
        grindDescription: plain.grindDescription ?? undefined,
        methodType: "POUR_OVER",
        steps: [{ type: "POUR", title: null, instruction: "Just pour", durationSeconds: null, targetElapsedSeconds: null, targetElapsedMaxSeconds: null, waterTargetG: 320, temperatureC: null, requiresConfirmation: false, autoAdvance: false }],
      }),
      copy.id,
    );

    const { brew, snapshot } = await getBrewDetail(alice, id);
    expect(brew.coffeeNameSnapshot).toBe("Before Rename");
    expect(brew.recipeNameSnapshot).toBe("V60 Two-Pour (copy)");
    expect(snapshot?.steps).toHaveLength(8);
  });

  it("completes idempotently with client ids and client timestamps", async () => {
    const { id } = await start(alice);
    const { snapshot } = await getBrewDetail(alice, id);
    const t0 = Date.parse("2026-09-20T07:00:00Z");
    let state = createLiveBrew({ brewId: id, steps: snapshot!.steps, resultIds: snapshot!.steps.map(() => randomUUID()), now: t0 });
    state = transition(state, { type: "START", now: t0 });
    state = transition(state, { type: "FINISH", now: t0 + 180_000 });
    const payload = completionInput.parse(JSON.parse(JSON.stringify(completionPayload(state))));

    const results = await Promise.all([completeBrew(alice, id, payload), completeBrew(alice, id, payload)]);
    expect(results.sort()).toEqual(["alreadyCompleted", "completed"]);
    expect(await completeBrew(alice, id, payload)).toBe("alreadyCompleted");

    const { brew } = await getBrewDetail(alice, id);
    expect(brew.status).toBe("COMPLETED");
    expect(brew.startedAt?.toISOString()).toBe(new Date(t0).toISOString());
    expect(brew.actualDurationSeconds).toBe(180);
    expect(brew.stepResults).toHaveLength(8);
  });

  it("rates only completed brews, one tasting per brew", async () => {
    const { id } = await start(alice);
    await expect(saveTasting(alice, id, { rating: 4, wouldBrewAgain: true, tags: ["BALANCED"], acidity: null, sweetness: null, bitterness: null, body: null, clarity: null, aftertaste: null, notes: null })).rejects.toBeInstanceOf(ConflictError);
    const at = new Date().toISOString();
    await completeBrew(alice, id, completionInput.parse({ startedAt: at, completedAt: at, actualDurationSeconds: 0, waterActualG: null, beverageWeightG: null, notes: null, steps: [] }));
    await saveTasting(alice, id, { rating: 4, wouldBrewAgain: true, tags: ["BALANCED"], acidity: null, sweetness: null, bitterness: null, body: null, clarity: null, aftertaste: null, notes: null });
    await saveTasting(alice, id, { rating: 5, wouldBrewAgain: true, tags: [], acidity: 3, sweetness: null, bitterness: null, body: null, clarity: null, aftertaste: null, notes: "better" });
    expect(await prisma.tasting.count({ where: { brewId: id } })).toBe(1);
    expect((await prisma.tasting.findUniqueOrThrow({ where: { brewId: id } })).rating).toBe(5);
  });

  it("aborts idempotently and refuses to complete an aborted brew", async () => {
    const { id } = await start(alice);
    expect(await abortBrew(alice, id)).toBe("aborted");
    expect(await abortBrew(alice, id)).toBe("alreadyAborted");
    const at = new Date().toISOString();
    await expect(completeBrew(alice, id, completionInput.parse({ startedAt: at, completedAt: at, actualDurationSeconds: 0, waterActualG: null, beverageWeightG: null, notes: null, steps: [] }))).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses references to another user's records", async () => {
    const coffee = await saveCoffee(alice, coffeeInput("Alice only"));
    await expect(start(bob, { coffeeId: coffee.id })).rejects.toBeInstanceOf(NotFoundError);
    const aliceRecipe = await duplicateRecipe(alice, v60, "(copy)", "en");
    await expect(start(bob, { recipeId: aliceRecipe.id })).rejects.toBeInstanceOf(NotFoundError);
    const { id } = await start(alice);
    await expect(getBrewDetail(bob, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(start(bob, { parentBrewId: id })).rejects.toBeInstanceOf(NotFoundError);
    await expect(toggleFavorite(bob, { kind: "coffee", id: coffee.id })).rejects.toBeInstanceOf(NotFoundError);
    const aliceModel = await prisma.grinderModel.create({ data: { ownerId: alice, manufacturer: "Home", model: "Made", type: "HAND", adjustmentType: "CLICK" } });
    await expect(
      saveUserGrinder(bob, { grinderModelId: aliceModel.id, nickname: null, burrDescription: null, burrInstallDate: null, zeroPoint: null, calibrationNotes: null, defaultForFilter: false, defaultForEspresso: false }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("never lets a bundled recipe be written by a user", async () => {
    const plain = recipeToPlain(await getRecipe(alice, v60));
    await expect(
      saveRecipe(alice, recipeInput.parse({ ...asForm(plain), grindDescription: undefined, methodType: "POUR_OVER", steps: [{ type: "POUR", title: null, instruction: "x", durationSeconds: null, targetElapsedSeconds: null, targetElapsedMaxSeconds: null, waterTargetG: null, temperatureC: null, requiresConfirmation: false, autoAdvance: false }] }), v60),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await prisma.recipeStep.count({ where: { recipeId: v60 } })).toBe(8);
  });

  it("duplicates with provenance and favorites bundled recipes", async () => {
    const copy = await duplicateRecipe(alice, v60, "(copy)", "de");
    expect(copy.ownerId).toBe(alice);
    expect(copy.bundledKey).toBeNull();
    expect(copy.forkedFromRecipeId).toBe(v60);
    expect(copy.sourceName).toBe("BrewCore bundled catalogue");
    expect(copy.name).toBe("V60 mit zwei Aufgüssen (copy)");
    expect(await toggleFavorite(alice, { kind: "recipe", id: v60 })).toBe(true);
    expect(await toggleFavorite(alice, { kind: "recipe", id: v60 })).toBe(false);
  });

  it("enforces exactly one favorite target in the database", async () => {
    await expect(prisma.favorite.create({ data: { ownerId: alice } })).rejects.toThrow();
  });

  it("keeps brews when their coffee is deleted", async () => {
    const coffee = await saveCoffee(alice, coffeeInput("Short-lived"));
    const { id } = await start(alice, { coffeeId: coffee.id });
    await prisma.coffee.delete({ where: { id: coffee.id } });
    const { brew } = await getBrewDetail(alice, id);
    expect(brew.coffeeId).toBeNull();
    expect(brew.coffeeNameSnapshot).toBe("Short-lived");
  });
});
