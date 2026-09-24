import { describe, expect, it } from "vitest";
import { BUNDLED_GRINDERS, GRIND_METHODS, formatGrindRange, grindRecommendations, recommendedGrind } from "./grinders";

describe("bundled grinder catalogue", () => {
  it("has unique slugs", () => {
    const slugs = BUNDLED_GRINDERS.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("includes the Porlex Mini and Tall", () => {
    const slugs = BUNDLED_GRINDERS.map((g) => g.slug);
    expect(slugs).toContain("porlex-mini-ii");
    expect(slugs).toContain("porlex-tall-ii");
  });

  for (const grinder of BUNDLED_GRINDERS) {
    describe(grinder.slug, () => {
      it("names each method at most once", () => {
        const methods = grinder.recommendations.map((r) => r.method);
        expect(new Set(methods).size).toBe(methods.length);
      });

      it("keeps recommendations inside the setting range", () => {
        for (const rec of grinder.recommendations) {
          expect(rec.min, rec.method).toBeLessThanOrEqual(rec.max);
          if (grinder.minSetting !== null) expect(rec.min, rec.method).toBeGreaterThanOrEqual(grinder.minSetting);
          if (grinder.maxSetting !== null) expect(rec.max, rec.method).toBeLessThanOrEqual(grinder.maxSetting);
        }
      });

      it("cites an https source for every recommendation", () => {
        for (const rec of grinder.recommendations) expect(rec.source.url, rec.method).toMatch(/^https:\/\//);
      });
    });
  }
});

describe("grind recommendation lookup", () => {
  const withEspresso = BUNDLED_GRINDERS.find((g) => g.recommendations.some((r) => r.method === "ESPRESSO"))!;
  const withPourOver = BUNDLED_GRINDERS.find((g) => g.recommendations.some((r) => r.method === "POUR_OVER"))!;

  it("maps a recipe's brew method to the chart row", () => {
    expect(recommendedGrind(withEspresso.slug, "ESPRESSO")?.method).toBe("ESPRESSO");
    expect(recommendedGrind(withPourOver.slug, "POUR_OVER")?.method).toBe("POUR_OVER");
    expect(recommendedGrind(withPourOver.slug, "HYBRID")?.method).toBe("POUR_OVER");
  });

  it("has no hint for unknown models, missing methods or unmapped brew methods", () => {
    expect(recommendedGrind(null, "ESPRESSO")).toBeNull();
    expect(recommendedGrind("not-a-grinder", "ESPRESSO")).toBeNull();
    expect(recommendedGrind(withPourOver.slug, null)).toBeNull();
    expect(recommendedGrind(withPourOver.slug, "OTHER")).toBeNull();
    expect(recommendedGrind(withPourOver.slug, "CUPPING")).toBeNull();
  });

  it("sorts recommendations fine to coarse", () => {
    const order = grindRecommendations(withPourOver.slug).map((r) => GRIND_METHODS.indexOf(r.method));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(grindRecommendations("not-a-grinder")).toEqual([]);
  });

  it("formats ranges with the setting unit", () => {
    expect(formatGrindRange({ min: 18, max: 24 }, "clicks")).toBe("18–24 clicks");
    expect(formatGrindRange({ min: 20, max: 20 }, "clicks")).toBe("20 clicks");
    expect(formatGrindRange({ min: 3, max: 5 }, null)).toBe("3–5");
  });
});
