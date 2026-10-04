import { expect, test } from "@playwright/test";
import { addCoffee, registerAndOnboard, selectByText } from "./helpers";

test("one user cannot see or complete another user's private records", async ({ browser }) => {
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
  const sharedLink = await alicePage.goto(`/coffees/${coffeeId}`).then(() => alicePage.getByRole("link", { name: "Shared coffee entry" }).getAttribute("href"));
  // The coffee itself is shared (§7); Alice's bag of it - roast date, notes - is not.
  await bobPage.goto("/coffees");
  await expect(bobPage.getByText("Alice's Secret Coffee")).toHaveCount(0);
  const shared = await bobPage.goto(sharedLink!);
  expect(shared?.status()).toBe(200);
  await expect(bobPage.getByRole("heading", { level: 1, name: "Alice's Secret Coffee" })).toBeVisible();
  await expect(bobPage.getByText("You have no bag of this coffee yet.")).toBeVisible();
  expect((await bobPage.request.get(`/api/shared-coffees/${sharedLink!.split("/").pop()}/image`)).status()).toBe(404);
  // Only its creator may edit it.
  expect((await bobPage.goto(`${sharedLink}/edit`))?.status()).toBe(404);

  await alice.close();
  await bob.close();
});
