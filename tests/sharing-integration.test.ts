/**
 * Coffee sharing against a real PostgreSQL (§7, §8): shared coffees and
 * roasters, private bags, gap-filling suggestions and administrator merges.
 * Skipped automatically when TEST_DATABASE_URL is not configured.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;
if (url) process.env.DATABASE_URL = url;

describeDb("coffee sharing against PostgreSQL", async () => {
  const { prisma } = await import("@/lib/db");
  const { seedCatalogue } = await import("../prisma/seed-catalogue");
  const { getCoffee, listCoffees, saveCoffee } = await import("@/server/coffees");
  const { findSimilarCoffees, getSharedCoffee, listSharedCoffees, saveSharedCoffee, setSharedCoffeeImage } = await import("@/server/shared-coffees");
  const { getRoaster, saveRoaster } = await import("@/server/roasters");
  const { decideSuggestion, reviewQueue, submitCoffeeSuggestion, submitRoasterSuggestion } = await import("@/server/suggestions");
  const { duplicateCandidates, mergeRoasters, mergeSharedCoffees } = await import("@/server/catalogue-merge");
  const { startBrew, getBrewDetail } = await import("@/server/brews");
  const { ConflictError, ForbiddenError, NotFoundError } = await import("@/server/errors");

  const stamp = `s${Date.now().toString(36)}`;
  type Actor = { id: string; role: "USER" | "ADMIN" };
  let alice: Actor;
  let bob: Actor;
  let admin: Actor;
  let v60: string;

  const makeUser = async (name: string, role: "USER" | "ADMIN" = "USER") => {
    const user = await prisma.user.create({
      data: { email: `${name}-${stamp}@example.test`, username: `${name}${stamp}`, passwordHash: "x", role, profile: { create: { displayName: name, onboardedAt: new Date() } } },
    });
    return { id: user.id, role };
  };

  beforeAll(async () => {
    await seedCatalogue(prisma);
    alice = await makeUser("alice");
    bob = await makeUser("bob");
    admin = await makeUser("admin", "ADMIN");
    v60 = (await prisma.recipe.findUniqueOrThrow({ where: { bundledKey: "v60-two-pour" } })).id;
  }, 60_000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [alice.id, bob.id, admin.id] } } });
    await prisma.sharedCoffee.deleteMany({ where: { name: { endsWith: stamp } } });
    await prisma.roaster.deleteMany({ where: { name: { endsWith: stamp } } });
    await prisma.$disconnect();
  });

  const shared = (name: string, extra: Record<string, unknown> = {}) => ({
    name: `${name} ${stamp}`,
    roasterName: `Sharing Roastery ${stamp}`,
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
    roasterTastingNotes: [],
    description: null,
    ...extra,
  });
  const bag = (roastDate = "2026-09-01") => ({
    roastDate: new Date(`${roastDate}T00:00:00Z`),
    purchaseDate: null,
    openedDate: null,
    bagWeightG: 250,
    remainingWeightG: 200,
    userTags: [],
    notes: "private note",
  });
  const suggestion = (extra: Record<string, unknown>) => ({
    roasterName: null,
    country: null,
    region: null,
    farm: null,
    producer: null,
    varieties: [] as string[],
    process: null,
    processingNotes: null,
    altitudeMinMasl: null,
    altitudeMaxMasl: null,
    roastLevel: "UNKNOWN" as const,
    roasterTastingNotes: [] as string[],
    description: null,
    ...extra,
  });

  it("shares the coffee and keeps the bag private", async () => {
    const aliceBag = await saveCoffee(alice, { shared: { input: shared("Guji Natural") }, bag: bag() });

    const catalogue = await listSharedCoffees(bob.id, { q: stamp });
    expect(catalogue.map((c) => c.id)).toContain(aliceBag.sharedCoffeeId);
    expect(catalogue.find((c) => c.id === aliceBag.sharedCoffeeId)?.myBagId).toBeNull();

    // Bob sees the coffee, but never Alice's bag of it.
    await expect(getCoffee(bob, aliceBag.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listCoffees(bob.id, { q: stamp })).toHaveLength(0);

    // Bob adds his own bag of the same coffee, with his own roast date.
    const bobBag = await saveCoffee(bob, { shared: { id: aliceBag.sharedCoffeeId }, bag: bag("2026-09-20") });
    expect(bobBag.sharedCoffeeId).toBe(aliceBag.sharedCoffeeId);
    const { myBags } = await getSharedCoffee(bob, aliceBag.sharedCoffeeId);
    expect(myBags.map((b) => b.id)).toEqual([bobBag.id]);
    expect((await getCoffee(alice, aliceBag.id)).roastDate?.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("reuses a roaster another member already entered", async () => {
    const a = await saveCoffee(alice, { shared: { input: shared("Roaster A") }, bag: bag() });
    const b = await saveCoffee(bob, { shared: { input: shared("Roaster B", { roasterName: `sharing roastery ${stamp}` }) }, bag: bag() });
    const [sa, sb] = await Promise.all([getSharedCoffee(alice, a.sharedCoffeeId), getSharedCoffee(bob, b.sharedCoffeeId)]);
    expect(sb.coffee.roasterId).toBe(sa.coffee.roasterId);
  });

  it("lets only the creator or an administrator edit the shared coffee", async () => {
    const aliceBag = await saveCoffee(alice, { shared: { input: shared("Edit Rights") }, bag: bag() });
    const bobBag = await saveCoffee(bob, { shared: { id: aliceBag.sharedCoffeeId }, bag: bag() });

    await expect(saveSharedCoffee(bob, aliceBag.sharedCoffeeId, shared("Hijacked"))).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveCoffee(bob, { shared: { input: shared("Hijacked") }, bag: bag() }, bobBag.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setSharedCoffeeImage(bob, aliceBag.sharedCoffeeId, null)).rejects.toBeInstanceOf(ForbiddenError);
    // His own bag he may change.
    await saveCoffee(bob, { bag: { ...bag(), notes: "bob's" } }, bobBag.id);

    await saveSharedCoffee(alice, aliceBag.sharedCoffeeId, shared("Edit Rights", { country: "Kenya" }));
    await saveSharedCoffee(admin, aliceBag.sharedCoffeeId, shared("Edit Rights", { country: "Kenya", region: "Nyeri" }));
    const { coffee, canEdit } = await getSharedCoffee(bob, aliceBag.sharedCoffeeId);
    expect(canEdit).toBe(false);
    expect([coffee.country, coffee.region]).toEqual(["Kenya", "Nyeri"]);
  });

  it("keeps brew snapshots when the shared coffee is renamed", async () => {
    const aliceBag = await saveCoffee(alice, { shared: { input: shared("Snapshot Shared") }, bag: bag() });
    const brew = await startBrew(
      alice.id,
      { recipeId: v60, coffeeId: aliceBag.id, userGrinderId: null, brewerId: null, parentBrewId: null, coffeeDoseG: 15, waterTargetG: 250, waterTemperatureC: 94, grindSettingText: null, grindSettingNumeric: null, grindSettingUnit: null, grindSettingNote: null },
      "",
      "en",
    );
    await saveSharedCoffee(alice, aliceBag.sharedCoffeeId, shared("Renamed Shared"));
    const { brew: stored } = await getBrewDetail(alice.id, brew.id);
    expect(stored.coffeeNameSnapshot).toBe(`Snapshot Shared ${stamp}`);
  });

  it("suggests similar coffees while one is entered", async () => {
    await saveCoffee(alice, { shared: { input: shared("Yirgacheffe Kochere") }, bag: bag() });
    const similar = await findSimilarCoffees({ name: `Yirgachefe Kochere ${stamp}`, roasterName: `Sharing Roastery ${stamp}` });
    expect(similar[0]?.name).toBe(`Yirgacheffe Kochere ${stamp}`);
    expect(await findSimilarCoffees({ name: "Completely different thing" })).not.toContainEqual(expect.objectContaining({ name: `Yirgacheffe Kochere ${stamp}` }));
  });

  it("fills only gaps through suggestions the creator decides", async () => {
    const aliceBag = await saveCoffee(alice, { shared: { input: shared("Gap Filling") }, bag: bag() });
    const id = aliceBag.sharedCoffeeId;

    // The creator edits directly; a suggestion would only queue work for herself.
    await expect(submitCoffeeSuggestion(alice, id, suggestion({ country: "Ethiopia" }), null)).rejects.toBeInstanceOf(ConflictError);
    // Only filled fields: nothing to suggest.
    await expect(submitCoffeeSuggestion(bob, id, suggestion({ process: "Natural" }), null)).rejects.toBeInstanceOf(ConflictError);

    await submitCoffeeSuggestion(bob, id, suggestion({ country: "Ethiopia", region: "Sidama", process: "Natural" }), null);
    await expect(submitCoffeeSuggestion(bob, id, suggestion({ farm: "Another" }), null)).rejects.toBeInstanceOf(ConflictError);

    const queue = await reviewQueue(alice);
    const open = queue.find((s) => s.targetId === id)!;
    // The filled field was dropped when the suggestion was filed.
    expect(open.values).toEqual({ country: "Ethiopia", region: "Sidama" });
    expect((await reviewQueue(bob)).some((s) => s.id === open.id)).toBe(false);
    expect((await reviewQueue(admin)).some((s) => s.id === open.id)).toBe(true);

    // Bob cannot decide on his own suggestion.
    await expect(decideSuggestion(bob, open.id, true)).rejects.toBeInstanceOf(NotFoundError);

    // Alice fills the region herself before deciding: her value wins.
    await saveSharedCoffee(alice, id, shared("Gap Filling", { region: "Guji" }));
    await decideSuggestion(alice, open.id, true);
    const { coffee } = await getSharedCoffee(alice, id);
    expect([coffee.country, coffee.region, coffee.process]).toEqual(["Ethiopia", "Guji", "Washed"]);
    await expect(decideSuggestion(alice, open.id, false)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("lets a roaster's gaps be suggested and rejected", async () => {
    const roaster = await saveRoaster(alice, { name: `Gap Roaster ${stamp}`, country: null, city: "Berlin", website: null, notes: null });
    await expect(submitRoasterSuggestion(bob, roaster.id, { country: null, city: "Hamburg", website: null, notes: null })).rejects.toBeInstanceOf(ConflictError);
    const { id } = await submitRoasterSuggestion(bob, roaster.id, { country: "Germany", city: "Hamburg", website: null, notes: null });
    await decideSuggestion(alice, id, false);
    expect((await getRoaster(bob, roaster.id)).roaster.country).toBeNull();
    // Another member cannot edit the roaster directly.
    await expect(saveRoaster(bob, { name: `Gap Roaster ${stamp}`, country: "X", city: null, website: null, notes: null }, roaster.id)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("merges duplicates without losing bags or brews", async () => {
    const keep = await saveCoffee(alice, { shared: { input: shared("Merge Huila") }, bag: bag() });
    const drop = await saveCoffee(bob, { shared: { input: shared("Huila Merge", { country: "Colombia", roasterName: null }) }, bag: bag() });
    const brew = await startBrew(
      bob.id,
      { recipeId: v60, coffeeId: drop.id, userGrinderId: null, brewerId: null, parentBrewId: null, coffeeDoseG: 15, waterTargetG: 250, waterTemperatureC: 94, grindSettingText: null, grindSettingNumeric: null, grindSettingUnit: null, grindSettingNote: null },
      "",
      "en",
    );

    const { coffees } = await duplicateCandidates(admin);
    expect(coffees.some(({ a, b }) => [a.id, b.id].sort().join() === [keep.sharedCoffeeId, drop.sharedCoffeeId].sort().join())).toBe(true);

    await expect(mergeSharedCoffees(alice, keep.sharedCoffeeId, drop.sharedCoffeeId)).rejects.toBeInstanceOf(ForbiddenError);
    await mergeSharedCoffees(admin, keep.sharedCoffeeId, drop.sharedCoffeeId);

    expect(await prisma.sharedCoffee.findUnique({ where: { id: drop.sharedCoffeeId } })).toBeNull();
    expect((await getCoffee(bob, drop.id)).sharedCoffeeId).toBe(keep.sharedCoffeeId);
    const merged = await getSharedCoffee(alice, keep.sharedCoffeeId);
    expect(merged.coffee.name).toBe(`Merge Huila ${stamp}`);
    expect(merged.coffee.country).toBe("Colombia");
    const { brew: stored } = await getBrewDetail(bob.id, brew.id);
    expect(stored.coffeeId).toBe(drop.id);
    expect(stored.coffeeNameSnapshot).toBe(`Huila Merge ${stamp}`);
  });

  it("enforces exactly one suggestion target in the database", async () => {
    await expect(prisma.catalogSuggestion.create({ data: { authorId: bob.id, values: {} } })).rejects.toThrow();
  });

  it("merges duplicate roasters and re-points their coffees", async () => {
    const keep = await saveRoaster(alice, { name: `Merge Roasters ${stamp}`, country: null, city: null, website: null, notes: null });
    const drop = await prisma.roaster.create({ data: { name: `Merge Roaster ${stamp}`, createdById: bob.id, city: "Vienna" } });
    const coffee = await prisma.sharedCoffee.create({ data: { name: `Roaster Coffee ${stamp}`, roasterId: drop.id, roasterNameSnapshot: drop.name, createdById: bob.id } });
    await mergeRoasters(admin, keep.id, drop.id);
    const moved = await prisma.sharedCoffee.findUniqueOrThrow({ where: { id: coffee.id } });
    expect([moved.roasterId, moved.roasterNameSnapshot]).toEqual([keep.id, keep.name]);
    expect((await prisma.roaster.findUniqueOrThrow({ where: { id: keep.id } })).city).toBe("Vienna");
  });
});
