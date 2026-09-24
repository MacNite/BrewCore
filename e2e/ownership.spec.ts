import { expect, test } from "@playwright/test";
import { addCoffee, registerAndOnboard, selectByText } from "./helpers";

test("one user cannot see or complete another user's records", async ({ browser }) => {
  const alice = await browser.newContext();
  const alicePage = await alice.newPage();
  await registerAndOnboard(alicePage);
  const coffeeId = await addCoffee(alicePage, "Alice's Secret Coffee");
  await alicePage.goto("/brew/new");
  await selectByText(alicePage, "Recipe", "V60 Two-Pour");
  await alicePage.getByRole("button", { name: "Start brew" }).click();
  await alicePage.waitForURL(/\/brew\/live\//);
  const brewId = alicePage.url().split("/").pop()!;

  const bob = await browser.newContext();
  const bobPage = await bob.newPage();
  await registerAndOnboard(bobPage);
  for (const path of [`/coffees/${coffeeId}`, `/coffees/${coffeeId}/edit`, `/brews/${brewId}`, `/brew/live/${brewId}`]) {
    const response = await bobPage.goto(path);
    expect(response?.status(), path).toBe(404);
  }
  const complete = await bobPage.request.post(`/api/brews/${brewId}/complete`, {
    data: { startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), actualDurationSeconds: 1, waterActualG: null, beverageWeightG: null, notes: null, steps: [] },
  });
  expect(complete.status()).toBe(404);
  const image = await bobPage.request.get(`/api/coffees/${coffeeId}/image`);
  expect(image.status()).toBe(404);
  await bobPage.goto("/coffees");
  await expect(bobPage.getByText("Alice's Secret Coffee")).toHaveCount(0);

  await alice.close();
  await bob.close();
});
