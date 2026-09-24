import { describe, expect, it } from "vitest";
import { assertSecureDeployment } from "./env";
import { securityCookieOptions } from "./auth";

/**
 * The check exists for one specific failure: a public HTTPS deployment whose
 * APP_URL was left at the plain-HTTP default. Everything works, and the session
 * cookie silently loses `Secure`.
 */
describe("secure deployment check", () => {
  const production = (extra: Record<string, string | undefined>) => ({ NODE_ENV: "production", ...extra });

  it("does nothing outside production", () => {
    expect(() => assertSecureDeployment({ NODE_ENV: "development", APP_URL: "http://brewcore.example.com" })).not.toThrow();
  });

  it("accepts an HTTPS deployment", () => {
    expect(() => assertSecureDeployment(production({ APP_URL: "https://brewcore.example.com" }))).not.toThrow();
  });

  it("refuses a public host over plain HTTP", () => {
    // The whole point: this deployment works, and hands out insecure cookies.
    expect(() => assertSecureDeployment(production({ APP_URL: "http://brewcore.example.com" }))).toThrow(/neither HTTPS nor a local address/);
  });

  it("refuses the default APP_URL only when it is not local", () => {
    // The default is localhost, which is exactly the case the plain-HTTP
    // allowance exists for, so an unset APP_URL must not break a LAN install.
    expect(() => assertSecureDeployment(production({}))).not.toThrow();
  });

  it("still allows the plain-HTTP LAN deployments this trade-off exists for", () => {
    for (const host of ["localhost", "127.0.0.1", "brewcore.local", "10.0.0.5", "192.168.1.20", "172.16.4.4"]) {
      expect(() => assertSecureDeployment(production({ APP_URL: `http://${host}:3000` }))).not.toThrow();
    }
  });

  it("does not mistake a public address for a private one", () => {
    // 172.32.x is outside the private 172.16-31 range, and 1.10.0.0 merely
    // starts with the digits of one.
    expect(() => assertSecureDeployment(production({ APP_URL: "http://172.32.0.1" }))).toThrow();
    expect(() => assertSecureDeployment(production({ APP_URL: "http://110.0.0.1" }))).toThrow();
  });

  it("can be overridden for TLS terminated out of sight", () => {
    expect(() =>
      assertSecureDeployment(production({ APP_URL: "http://brewcore.example.com", ALLOW_INSECURE_APP_URL: "true" })),
    ).not.toThrow();
  });
});

describe("security cookie options", () => {
  it("gives every security cookie the same shape", () => {
    const options = securityCookieOptions(new Date("2026-01-01"), "https://brewcore.example.com");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  });

  it("drops Secure only for a plain-HTTP deployment", () => {
    expect(securityCookieOptions(new Date(), "http://brewcore.local:3000").secure).toBe(false);
    expect(securityCookieOptions(new Date(), "https://brewcore.example.com").secure).toBe(true);
  });

  it("follows the browser's own origin over APP_URL", () => {
    // An https APP_URL opened directly on the LAN over plain HTTP: a Secure
    // cookie would be dropped and the next request would have no session.
    expect(securityCookieOptions(new Date(), "https://brewcore.example.com", "http://192.168.178.92:30035").secure).toBe(false);
    expect(securityCookieOptions(new Date(), "http://brewcore.local:3000", "https://brewcore.example.com").secure).toBe(true);
    expect(securityCookieOptions(new Date(), "https://brewcore.example.com", "https://brewcore.example.com").secure).toBe(true);
  });

  it("falls back to APP_URL without a usable Origin", () => {
    expect(securityCookieOptions(new Date(), "https://brewcore.example.com", null).secure).toBe(true);
    expect(securityCookieOptions(new Date(), "https://brewcore.example.com", "null").secure).toBe(true);
    expect(securityCookieOptions(new Date(), "http://brewcore.local:3000", undefined).secure).toBe(false);
  });
});
