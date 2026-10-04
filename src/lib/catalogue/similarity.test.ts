import { describe, expect, it } from "vitest";
import { DUPLICATE_THRESHOLD, SUGGEST_THRESHOLD, coffeeSimilarity, nameSimilarity, normalizeName, similarPairs } from "./similarity";
import { emptyFields, fillGaps, isEmptyValue } from "./gaps";

describe("normalizeName", () => {
  it("drops case, accents and punctuation", () => {
    expect(normalizeName("  Café  Ñuñoa – Lot #3 ")).toBe("cafe nunoa lot 3");
    expect(normalizeName("Großröstung")).toBe("grossrostung");
    expect(normalizeName(null)).toBe("");
  });
});

describe("nameSimilarity", () => {
  it("is 1 for the same name written differently", () => {
    expect(nameSimilarity("Ethiopia Guji", "ETHIOPIA  guji")).toBe(1);
    expect(nameSimilarity("Ethiopia Guji", "Guji, Ethiopia")).toBe(1);
  });

  it("is symmetric", () => {
    expect(nameSimilarity("Kenya Kiambu AA", "Kiambu")).toBe(nameSimilarity("Kiambu", "Kenya Kiambu AA"));
  });

  it("tolerates a typo and a plural", () => {
    expect(nameSimilarity("Yirgacheffe Natural", "Yirgachefe Natural")).toBeGreaterThan(DUPLICATE_THRESHOLD);
    expect(nameSimilarity("Finca La Esperanza", "Finca La Esperanzas")).toBeGreaterThan(DUPLICATE_THRESHOLD);
  });

  it("ignores words that do not identify a coffee", () => {
    expect(nameSimilarity("Guji Coffee", "Guji")).toBe(1);
  });

  it("keeps different coffees apart", () => {
    expect(nameSimilarity("Ethiopia Guji", "Colombia Huila")).toBeLessThan(SUGGEST_THRESHOLD);
    expect(nameSimilarity("", "Guji")).toBe(0);
  });
});

describe("coffeeSimilarity", () => {
  it("finds the same coffee entered twice", () => {
    expect(coffeeSimilarity({ name: "Ethiopia Guji Natural", roasterName: "Bonanza" }, { name: "Guji Natural", roasterName: "Bonanza Coffee" })).toBeGreaterThanOrEqual(
      SUGGEST_THRESHOLD,
    );
  });

  it("treats a missing roaster or country as neutral", () => {
    expect(coffeeSimilarity({ name: "Guji Natural", roasterName: "Bonanza" }, { name: "Guji Natural" })).toBe(1);
    expect(coffeeSimilarity({ name: "Guji Natural", country: "Ethiopia" }, { name: "Guji Natural", country: null })).toBe(1);
  });

  it("lets a different roaster or origin outweigh the name", () => {
    expect(coffeeSimilarity({ name: "House Blend", roasterName: "Bonanza" }, { name: "House Blend", roasterName: "The Barn" })).toBeLessThan(SUGGEST_THRESHOLD);
    expect(coffeeSimilarity({ name: "Espresso", country: "Brazil" }, { name: "Espresso", country: "Ethiopia" })).toBeLessThan(DUPLICATE_THRESHOLD);
  });
});

describe("similarPairs", () => {
  it("returns pairs above the threshold, best first", () => {
    const rows = [
      { id: "a", name: "Ethiopia Guji" },
      { id: "b", name: "Guji Ethiopia" },
      { id: "c", name: "Colombia Huila" },
      { id: "d", name: "Ethiopia Gujii" },
    ];
    const pairs = similarPairs(rows, (x, y) => nameSimilarity(x.name, y.name), DUPLICATE_THRESHOLD);
    expect(pairs[0]).toMatchObject({ a: { id: "a" }, b: { id: "b" }, score: 1 });
    expect(pairs.some((pair) => pair.a.id === "c" || pair.b.id === "c")).toBe(false);
    expect(pairs.map((pair) => pair.score)).toEqual([...pairs.map((pair) => pair.score)].sort((x, y) => y - x));
  });
});

describe("gap filling", () => {
  const fields = ["country", "varieties", "roastLevel", "altitudeMinMasl"] as const;

  it("counts null, blank, empty lists and UNKNOWN as empty", () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue("  ")).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue("UNKNOWN")).toBe(true);
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue("Kenya")).toBe(false);
  });

  it("lists the empty fields", () => {
    expect(emptyFields({ country: "Kenya", varieties: [], roastLevel: "UNKNOWN", altitudeMinMasl: 1800 }, fields)).toEqual(["varieties", "roastLevel"]);
  });

  it("only fills empty fields and never overwrites", () => {
    const filled = fillGaps(
      { country: "Kenya", varieties: [], roastLevel: "UNKNOWN", altitudeMinMasl: null },
      { country: "Ethiopia", varieties: ["SL28"], roastLevel: "LIGHT", altitudeMinMasl: null },
      fields,
    );
    expect(filled).toEqual({ varieties: ["SL28"], roastLevel: "LIGHT" });
  });

  it("ignores fields that are not offered", () => {
    expect(fillGaps<"country" | "name">({ country: null, name: null }, { country: "Kenya", name: "Other" }, ["country"])).toEqual({ country: "Kenya" });
  });
});
