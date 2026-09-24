import { expect, test } from "@playwright/test";
import { registerAndOnboard, signIn, uniqueUser } from "./helpers";

test("an anonymous visitor is sent to the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("a new user can register, onboard and reach the home screen", async ({ page }) => {
  const user = await registerAndOnboard(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(user.displayName);
  await expect(page.getByText("What do you want to brew now?")).toBeVisible();
});

test("sign-in rejects a wrong password and accepts the right one", async ({ page }) => {
  const user = await registerAndOnboard(page, uniqueUser());
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel(/^email$|^e-mail$/i).fill(user.email);
  await page.getByLabel(/password|passwort/i).fill("definitely-the-wrong-one");
  await page.getByRole("button", { name: /sign in|anmelden/i }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);

  await signIn(page, user);
  await expect(page).toHaveURL(/\/$/);
});

test("a signed-in user can sign out", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("the health endpoint and manifest are public", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", service: "brewcore", database: "ok" });
  const manifest = await request.get("/manifest.webmanifest");
  expect(await manifest.json()).toMatchObject({ name: "BrewCore", display: "standalone" });
});
