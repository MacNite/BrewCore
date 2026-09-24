import { expect, test } from "@playwright/test";
import { addCoffee, addGrinder, registerAndOnboard, selectByText } from "./helpers";

/**
 * The first milestone (§111): a fresh user adds one coffee and one grinder,
 * selects the bundled V60 recipe, completes a guided brew, rates it, and
 * repeats it from history.
 */
test("coffee → recipe → guided brew → rate → brew again", async ({ page }) => {
  await registerAndOnboard(page);
  const coffeeId = await addCoffee(page, "Kenya Nyeri Washed");
  await addGrinder(page);

  // Brew this coffee, with the bundled two-pour V60.
  await page.goto(`/coffees/${coffeeId}`);
  await page.getByRole("link", { name: "Brew this coffee" }).first().click();
  await page.waitForURL(/\/brew\/new\?coffeeId=/);
  await selectByText(page, "Recipe", "V60 Two-Pour");
  await page.getByLabel("Coffee (g)").fill("25");
  // Water follows the ratio: 25 g at 1:16 is 400 g.
  await expect(page.getByLabel("Water (g)")).toHaveValue("400");
  await page.getByLabel("Grind setting").fill("24 clicks");
  const review = page.getByRole("region", { name: "Review" });
  await expect(review.getByText("1:16")).toBeVisible();
  await page.getByRole("button", { name: "Start brew" }).click();

  // Live brew: confirm the three preparation steps, then start the timer.
  await page.waitForURL(/\/brew\/live\//);
  await expect(page.locator(".live-instruction", { hasText: "Rinse the filter and preheat the brewer" })).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator(".live-instruction", { hasText: "Bloom: pour to 60 g and let it degas" })).toBeVisible();
  // Scaled bloom target: 60 g × 1.25 = 75 g.
  await expect(page.locator(".live-target")).toHaveText("75 g");
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await expect(page.locator(".live-status")).toHaveText(/brewing/i);

  // Pause and resume, then advance manually through the remaining steps.
  await page.getByRole("button", { name: /pause/i }).click();
  await expect(page.locator(".live-status")).toHaveText(/paused/i);
  await page.getByRole("button", { name: /^▶ resume$/i }).click();
  for (let i = 0; i < 4; i++) await page.locator(".live-controls .primary").click();
  await expect(page.locator(".live-instruction", { hasText: "Swirl and serve" })).toBeVisible();

  // Finish with an actual water reading.
  await page.locator(".live-controls .primary").click();
  await page.getByLabel("Actual water (g)").fill("398");
  await page.getByRole("button", { name: "Complete brew" }).click();

  // Rate it.
  await expect(page.getByRole("heading", { name: "Brew complete" })).toBeVisible();
  await page.locator(".stars label").nth(3).click();
  await page.getByRole("checkbox", { name: "Balanced" }).check();
  await page.getByRole("button", { name: "Save" }).click();

  // The brew detail shows the snapshot and the rating.
  await page.waitForURL(/\/brews\/[^/]+$/);
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await expect(page.getByText("4 of 5 stars").first()).toBeAttached();
  await expect(page.getByText("24 clicks")).toBeVisible();
  await expect(page.getByText("398 g")).toBeVisible();

  // Brew again from history keeps every value.
  await page.goto("/brews");
  await page.getByRole("link", { name: /Kenya Nyeri Washed · V60 Two-Pour/ }).click();
  await page.getByRole("link", { name: "Brew again" }).first().click();
  await page.waitForURL(/fromBrewId=/);
  await expect(page.getByRole("heading", { level: 1, name: "Brew again" })).toBeVisible();
  await expect(page.getByLabel("Coffee (g)")).toHaveValue("25");
  await expect(page.getByLabel("Water (g)")).toHaveValue("400");
  await expect(page.getByLabel("Grind setting")).toHaveValue("24 clicks");
  await page.getByRole("button", { name: "Start brew" }).click();
  await page.waitForURL(/\/brew\/live\//);
  await expect(page.locator(".live-instruction", { hasText: "Rinse the filter and preheat the brewer" })).toBeVisible();
});

test("a timed step advances by itself, derived from the clock", async ({ page }) => {
  await page.clock.install();
  await registerAndOnboard(page);
  await page.goto("/brew/new");
  await selectByText(page, "Recipe", "V60 Two-Pour");
  await page.getByRole("button", { name: "Start brew" }).click();
  await page.waitForURL(/\/brew\/live\//);
  await page.getByRole("button", { name: "Start timer now" }).click();
  // The three preparation steps were skipped by starting straight away.
  await expect(page.locator(".live-instruction", { hasText: "Rinse the filter and preheat the brewer" })).toBeVisible();
  for (let i = 0; i < 3; i++) await page.locator(".live-controls .primary").click();
  await expect(page.locator(".live-instruction", { hasText: "Bloom: pour to 60 g and let it degas" })).toBeVisible();
  await page.clock.fastForward("00:50");
  await expect(page.locator(".live-instruction", { hasText: "Pour to 200 g" })).toBeVisible();
});
