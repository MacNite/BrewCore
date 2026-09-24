import { describe, expect, it } from "vitest";
import { displayGrams, roundToTenth, scaleRecipe, stepAdditions } from "./scaling";
import { formatRatio, persistedRatio, ratioOf, waterForRatio } from "./ratio";

const recipe = {
  defaultCoffeeDoseG: 20,
  defaultWaterG: 320,
  steps: [{ waterTargetG: null }, { waterTargetG: 60 }, { waterTargetG: 180 }, { waterTargetG: 320 }, { waterTargetG: null }],
};

describe("recipe scaling (§76)", () => {
  it("scales 20 g → 320 g up to 25 g → 400 g", () => {
    const scaled = scaleRecipe(recipe, { doseG: 25 });
    expect(scaled.coffeeDoseG).toBe(25);
    expect(scaled.waterG).toBe(400);
    expect(scaled.factor).toBe(1.25);
  });

  it("scales step targets by the same factor", () => {
    const scaled = scaleRecipe(recipe, { doseG: 25 });
    expect(scaled.steps.map((s) => s.waterTargetG)).toEqual([null, 75, 225, 400, null]);
  });

  it("preserves the ratio", () => {
    for (const dose of [12, 15.5, 18, 22.3, 30]) {
      const scaled = scaleRecipe(recipe, { doseG: dose });
      expect(ratioOf(scaled.waterG, scaled.coffeeDoseG)).toBeCloseTo(16, 2);
    }
  });

  it("rounds to 0.1 g internally", () => {
    const scaled = scaleRecipe(recipe, { doseG: 18.3 });
    expect(scaled.waterG).toBe(292.8);
    expect(scaled.steps[1].waterTargetG).toBe(54.9);
    for (const s of scaled.steps) {
      if (s.waterTargetG !== null) expect(Number.isInteger(Math.round(s.waterTargetG * 10))).toBe(true);
    }
  });

  it("ends the final step exactly on the scaled total, without drift", () => {
    const awkward = { defaultCoffeeDoseG: 15, defaultWaterG: 250, steps: [{ waterTargetG: 50 }, { waterTargetG: 150 }, { waterTargetG: 250 }] };
    for (const dose of [13.7, 16.1, 17.3, 21.9]) {
      const scaled = scaleRecipe(awkward, { doseG: dose });
      expect(scaled.steps.at(-1)!.waterTargetG).toBe(scaled.waterG);
    }
  });

  it("honours a custom water override and scales steps to it", () => {
    const scaled = scaleRecipe(recipe, { doseG: 20, waterOverrideG: 300 });
    expect(scaled.waterG).toBe(300);
    expect(scaled.steps.map((s) => s.waterTargetG)).toEqual([null, 56.3, 168.8, 300, null]);
  });

  it("never lets a step exceed the total or go backwards", () => {
    const odd = { defaultCoffeeDoseG: 20, defaultWaterG: 300, steps: [{ waterTargetG: 200 }, { waterTargetG: 150 }, { waterTargetG: 320 }] };
    const scaled = scaleRecipe(odd, { doseG: 20 });
    expect(scaled.steps.map((s) => s.waterTargetG)).toEqual([200, 200, 300]);
  });

  it("does not mutate the original recipe", () => {
    const copy = JSON.parse(JSON.stringify(recipe));
    scaleRecipe(recipe, { doseG: 25 });
    expect(recipe).toEqual(copy);
  });

  it("scales an espresso yield with the dose", () => {
    const espresso = { defaultCoffeeDoseG: 18, defaultWaterG: 36, targetYieldG: 36, steps: [] };
    expect(scaleRecipe(espresso, { doseG: 20 }).targetYieldG).toBe(40);
  });

  it("rejects non-positive values", () => {
    expect(() => scaleRecipe(recipe, { doseG: 0 })).toThrow();
    expect(() => scaleRecipe(recipe, { doseG: 20, waterOverrideG: 0 })).toThrow();
    expect(() => scaleRecipe({ ...recipe, defaultCoffeeDoseG: 0 }, { doseG: 20 })).toThrow();
  });

  it("displays water targets in whole grams", () => {
    expect(displayGrams(56.3)).toBe(56);
    expect(displayGrams(168.8)).toBe(169);
    expect(roundToTenth(0.1 + 0.2)).toBe(0.3);
  });
});

describe("step additions (§15)", () => {
  it("derives the amount to add from cumulative targets", () => {
    expect(stepAdditions(recipe.steps)).toEqual([null, 60, 120, 140, null]);
  });
});

describe("ratio", () => {
  it("derives and formats the ratio", () => {
    expect(ratioOf(320, 20)).toBe(16);
    expect(formatRatio(16)).toBe("1:16");
    expect(formatRatio(15.54)).toBe("1:15.5");
    expect(formatRatio(15.54, ",")).toBe("1:15,5");
    expect(formatRatio(null)).toBe("–");
  });

  it("has no ratio without a positive dose", () => {
    expect(ratioOf(320, 0)).toBeNull();
    expect(ratioOf(null, 20)).toBeNull();
    expect(() => persistedRatio(320, 0)).toThrow();
  });

  it("rounds the persisted ratio to four decimals", () => {
    expect(persistedRatio(250, 15)).toBe(16.6667);
  });

  it("computes water for a dose at a ratio", () => {
    expect(waterForRatio(18.5, 16)).toBe(296);
  });
});
