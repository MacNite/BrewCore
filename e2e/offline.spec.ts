import { expect, test } from "@playwright/test";
import { registerAndOnboard, selectByText } from "./helpers";

/**
 * Phase 6 manual acceptance, automated (§103):
 * start Brew → disable network → continue → finish locally → restore network
 * → the final Brew is persisted exactly once.
 */
test("a brew started online survives going offline and syncs exactly once", async ({ page, context }) => {
  await registerAndOnboard(page);
  await page.goto("/brew/new");
  await selectByText(page, "Recipe", "Espresso 1:2");
  await page.getByRole("button", { name: "Start brew" }).click();
  await page.waitForURL(/\/brew\/live\//);
  const brewId = page.url().split("/").pop()!;

  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Start timer", exact: true }).click();

  await context.setOffline(true);
  // Reload while offline: state comes back from IndexedDB, the page from cache.
  await page.reload();
  await expect(page.getByText("Your brew was restored")).toBeVisible();
  await expect(page.locator(".live-status")).toHaveText(/brewing|step done/i);

  await page.locator(".live-controls .primary").click();
  await page.locator(".live-controls .primary").click();
  await page.getByLabel("Beverage weight (g)").fill("37.5");
  await page.getByRole("button", { name: "Complete brew" }).click();
  await page.locator(".stars label").nth(4).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Saved on this device" })).toBeVisible();

  // Back online: the outbox delivers completion and tasting.
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect
    .poll(async () => (await page.request.get(`/brews/${brewId}`)).status() === 200 && (await (await page.request.get(`/brews/${brewId}`)).text()).includes("Completed"), { timeout: 20_000 })
    .toBe(true);

  // Re-sending the same completion is a no-op, never a duplicate.
  const again = await page.request.post(`/api/brews/${brewId}/complete`, {
    data: {
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      completedAt: new Date().toISOString(),
      actualDurationSeconds: 60,
      waterActualG: null,
      beverageWeightG: null,
      notes: null,
      steps: [],
    },
  });
  expect(await again.json()).toEqual({ result: "alreadyCompleted" });

  await page.goto(`/brews/${brewId}`);
  await expect(page.getByText("37.5 g")).toBeVisible();
  await expect(page.getByText("5 of 5 stars").first()).toBeAttached();
  await expect(page.locator("tbody tr")).toHaveCount(4);
});
