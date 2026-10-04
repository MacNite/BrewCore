import { expect, test } from "@playwright/test";
import { addCoffee, registerAndOnboard } from "./helpers";

test("a coffee is shared, reused instead of duplicated, and its gaps filled", async ({ browser }) => {
  const name = `Sidama Bensa ${Date.now().toString(36)}`;
  const alice = await browser.newContext();
  const alicePage = await alice.newPage();
  await registerAndOnboard(alicePage);
  await addCoffee(alicePage, name);

  // Bob starts typing the same coffee and is offered Alice's entry.
  const bob = await browser.newContext();
  const bobPage = await bob.newPage();
  await registerAndOnboard(bobPage);
  await bobPage.goto("/coffees/new");
  await bobPage.getByLabel("Name", { exact: true }).fill(name.replace("Bensa", "Bensa "));
  await expect(bobPage.getByText("Already on this instance?")).toBeVisible();
  await bobPage.getByRole("listitem").filter({ hasText: name }).getByRole("link", { name: "Use this coffee" }).click();
  await bobPage.waitForURL(/\/coffees\/new\?shared=/);

  // Only his bag is asked for.
  await expect(bobPage.getByLabel("Name", { exact: true })).toHaveCount(0);
  await bobPage.getByLabel("Roast date").fill("2026-09-15");
  await bobPage.getByRole("button", { name: "Save" }).click();
  await bobPage.waitForURL(/\/coffees\/[^/]+$/);
  await expect(bobPage.getByRole("heading", { level: 1, name })).toBeVisible();

  // He fills a gap; Alice decides.
  await bobPage.getByRole("link", { name: "Shared coffee entry" }).click();
  await bobPage.getByRole("link", { name: "Fill in missing info" }).click();
  await bobPage.getByLabel("Country").fill("Ethiopia");
  await bobPage.getByRole("button", { name: "Send suggestion" }).click();
  await expect(bobPage.getByText("Your suggestion was sent")).toBeVisible();
  const sharedUrl = bobPage.url().split("?")[0];

  await alicePage.goto("/coffees");
  await alicePage.getByRole("link", { name: /1 suggestion to review/ }).click();
  const card = alicePage.getByRole("listitem").filter({ hasText: name });
  await expect(card.getByText("Ethiopia")).toBeVisible();
  await card.getByRole("button", { name: "Accept" }).click();
  await expect(alicePage.getByText("No suggestions waiting.")).toBeVisible();

  await bobPage.goto(sharedUrl);
  await expect(bobPage.getByText("Ethiopia")).toBeVisible();
  await expect(bobPage.getByRole("link", { name: "Fill in missing info" })).toBeVisible();

  await alice.close();
  await bob.close();
});
