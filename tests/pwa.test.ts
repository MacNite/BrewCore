import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../src/app/manifest";

/** Width and height from a PNG's IHDR chunk, without an image library. */
function pngSize(path: string) {
  const data = readFileSync(path);
  expect(data.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

describe("PWA manifest (§69)", () => {
  const m = manifest();

  it("describes an installable standalone BrewCore", () => {
    expect(m).toMatchObject({ name: "BrewCore", short_name: "BrewCore", display: "standalone", orientation: "portrait", start_url: "/" });
    expect(m.categories).toEqual(["food", "lifestyle", "utilities"]);
  });

  it("ships every icon it names, at the size it claims", () => {
    for (const icon of m.icons ?? []) {
      const [w, h] = icon.sizes!.split("x").map(Number);
      expect(pngSize(`public${icon.src}`), icon.src).toEqual({ width: w, height: h });
    }
    expect(m.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
    expect(pngSize("public/apple-icon.png")).toEqual({ width: 180, height: 180 });
  });
});

describe("service worker", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  const cache = readFileSync("src/lib/offline/offline-cache.ts", "utf8");

  it("uses the same cache names as the page-side warm-up", () => {
    const version = (text: string) => text.match(/const VERSION = "(v\d+)"/)?.[1];
    expect(version(sw)).toBeDefined();
    expect(version(sw)).toBe(version(cache));
  });

  it("never caches API responses", () => {
    expect(sw).toContain('url.pathname.startsWith("/api/")) return;');
  });
});
