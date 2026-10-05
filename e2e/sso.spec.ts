import { expect, test, type APIRequestContext } from "@playwright/test";
import { registerAndOnboard, uniqueUser } from "./helpers";

/* Runs against e2e/oidc-mock.mjs, which playwright.config.ts starts next to the
   app and points OIDC_ISSUER at. */
const MOCK = `http://127.0.0.1:${process.env.OIDC_MOCK_PORT ?? 3199}`;

// Signed-out pages follow DEFAULT_LOCALE, so either language may show.
const SSO_BUTTON = /sign in with authentik|mit authentik anmelden/i;

test.skip(Boolean(process.env.E2E_NO_SERVER), "needs the mock provider that playwright.config.ts starts");

async function asIdentity(request: APIRequestContext, identity: { sub: string; email: string; email_verified?: boolean }) {
  const response = await request.post(`${MOCK}/__identity`, { data: identity });
  expect(response.ok()).toBe(true);
}

test("single sign-on maps to the existing account by email and binds it", async ({ page, request }) => {
  const user = await registerAndOnboard(page, uniqueUser());
  await page.context().clearCookies();
  const sub = `sub-${user.username}`;

  // The provider spells the email differently; matching is case-insensitive.
  await asIdentity(request, { sub, email: user.email.toUpperCase() });
  await page.goto("/login");
  await page.getByRole("link", { name: SSO_BUTTON }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(user.displayName);

  // The settings page knows the account still has its own password.
  await page.goto("/settings");
  await expect(page.getByLabel("Current password")).toBeVisible();

  // Single logout goes through the provider and comes back to sign-in.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Bound to the subject now: a changed email at the provider still finds the account.
  await asIdentity(request, { sub, email: `renamed-${user.email}` });
  await page.getByRole("link", { name: SSO_BUTTON }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(user.displayName);
});

test("single sign-on keeps the page the visitor was going to", async ({ page, request }) => {
  const user = await registerAndOnboard(page, uniqueUser());
  await page.context().clearCookies();
  await asIdentity(request, { sub: `sub-${user.username}`, email: user.email });

  await page.goto("/login?next=/settings");
  await page.getByRole("link", { name: SSO_BUTTON }).click();
  await expect(page).toHaveURL(/\/settings$/);
});

test("single sign-on refuses an email with no account", async ({ page, request }) => {
  const stranger = uniqueUser();
  await asIdentity(request, { sub: `sub-${stranger.username}`, email: stranger.email });

  await page.goto("/login");
  await page.getByRole("link", { name: SSO_BUTTON }).click();
  await expect(page).toHaveURL(/\/login\?error=ssoNoAccount$/);
  await expect(page.getByText(/no account for your email address|für deine e-mail-adresse gibt es/i)).toBeVisible();
});

test("single sign-on refuses an email the provider has not verified", async ({ page, request }) => {
  const user = await registerAndOnboard(page, uniqueUser());
  await page.context().clearCookies();
  await asIdentity(request, { sub: `sub-${user.username}`, email: user.email, email_verified: false });

  await page.goto("/login");
  await page.getByRole("link", { name: SSO_BUTTON }).click();
  await expect(page).toHaveURL(/\/login\?error=ssoUnverified$/);
});
