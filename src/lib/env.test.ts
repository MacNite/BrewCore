import { afterEach, describe, expect, it } from "vitest";
import { env, registrationMode, resetEnvCache } from "./env";

describe("registration mode", () => {
  it("defaults to bootstrap", () => {
    expect(registrationMode(undefined)).toBe("bootstrap");
    expect(registrationMode("")).toBe("bootstrap");
  });

  it("reads the supported modes case-insensitively", () => {
    expect(registrationMode("OPEN")).toBe("open");
    expect(registrationMode(" disabled ")).toBe("disabled");
    expect(registrationMode("bootstrap")).toBe("bootstrap");
  });

  it("treats invite as an alias for bootstrap", () => {
    expect(registrationMode("invite")).toBe("bootstrap");
  });

  it("falls back to the safest mode for an unknown value", () => {
    expect(registrationMode("everyone")).toBe("bootstrap");
  });
});

describe("env()", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    resetEnvCache();
  });

  it("applies defaults when nothing is configured", () => {
    delete process.env.DEFAULT_LOCALE;
    delete process.env.TRUSTED_PROXY_HOPS;
    resetEnvCache();
    expect(env()).toMatchObject({ DEFAULT_LOCALE: "de", TRUSTED_PROXY_HOPS: 0, REGISTRATION_MODE: "bootstrap" });
  });

  it("rejects an invalid value with a readable message", () => {
    process.env.TRUSTED_PROXY_HOPS = "-1";
    resetEnvCache();
    expect(() => env()).toThrow(/TRUSTED_PROXY_HOPS/);
  });

  it("needs no signing secret", () => {
    delete process.env.APP_SECRET;
    resetEnvCache();
    expect(() => env()).not.toThrow();
  });
});
