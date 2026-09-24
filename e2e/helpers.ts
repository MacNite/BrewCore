import { expect, type Page } from "@playwright/test";

let counter = 0;

export function uniqueUser() {
  counter += 1;
  const id = `${Date.now().toString(36)}${counter}`;
  return {
    displayName: `Tester ${id}`,
    username: `user${id}`,
    email: `user${id}@example.test`,
    password: "a-long-enough-passphrase",
  };
}

export type TestUser = ReturnType<typeof uniqueUser>;

/** Registers a fresh account and finishes onboarding in English. */
export async function registerAndOnboard(page: Page, user: TestUser = uniqueUser()) {
  await page.goto("/register");
  await page.getByLabel(/display name|anzeigename/i).fill(user.displayName);
  await page.getByLabel(/username|benutzername/i).fill(user.username);
  await page.getByLabel(/^email$|^e-mail$/i).fill(user.email);
  await page.getByLabel(/password|passwort/i).fill(user.password);
  await page.getByRole("button", { name: /create account|konto erstellen/i }).click();
  await page.waitForURL("**/onboarding");
  await page.getByLabel(/language|sprache/i).selectOption("en");
  await page.getByRole("button", { name: /let's brew|los geht's/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("onboarding"));
  return user;
}

export async function signIn(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByLabel(/^email$|^e-mail$/i).fill(user.email);
  await page.getByLabel(/password|passwort/i).fill(user.password);
  await page.getByRole("button", { name: /sign in|anmelden/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"));
}

export async function addCoffee(page: Page, name = "Ethiopia Guji Natural") {
  await page.goto("/coffees/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Roaster", { exact: true }).fill("Test Roastery");
  await page.getByLabel("Roast date").fill("2026-09-01");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/coffees\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.url().split("/").pop()!;
}

export async function addGrinder(page: Page, model = /Comandante C40 MK4/) {
  await page.goto("/grinders/new");
  const select = page.getByLabel("Model", { exact: true });
  const value = await select.locator("option", { hasText: model }).first().getAttribute("value");
  await select.selectOption(value!);
  await page.getByLabel("Nickname").fill("My C40");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/grinders\/[^/]+$/);
  return page.url().split("/").pop()!;
}

/** Selects an option of a <select> by its visible text. */
export async function selectByText(page: Page, label: string | RegExp, text: string | RegExp) {
  const select = page.getByLabel(label, { exact: typeof label === "string" });
  const value = await select.locator("option", { hasText: text }).first().getAttribute("value");
  await select.selectOption(value!);
}
