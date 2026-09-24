import { describe, expect, it } from "vitest";
import { safeHttpUrl, safeNextPath } from "./url";

describe("safeNextPath", () => {
  it("keeps a same-origin path", () => {
    expect(safeNextPath("/brews/abc?x=1")).toBe("/brews/abc?x=1");
  });

  it("refuses anything that could leave the origin", () => {
    for (const value of ["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "", null, 3]) {
      expect(safeNextPath(value), String(value)).toBe("/");
    }
  });
});

describe("safeHttpUrl", () => {
  it("accepts http and https", () => {
    expect(safeHttpUrl("https://roaster.example/coffee")).toBe("https://roaster.example/coffee");
    expect(safeHttpUrl(" http://a.test ")).toBe("http://a.test/");
  });

  it("rejects other schemes and garbage", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,x")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
  });
});
