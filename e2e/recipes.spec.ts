import { expect, test } from "@playwright/test";
import { registerAndOnboard } from "./helpers";

test("a user creates a recipe, reorders steps and duplicates a bundled one", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill("My Test Recipe");
  await page.getByLabel("Coffee (g)").fill("15");
  await page.getByLabel("Water (g)").fill("250");
  await expect(page.locator("output")).toHaveText("1:16.7");

  const steps = page.locator(".step-card");
  await steps.nth(0).getByLabel("Instruction").fill("Prepare everything");
  await steps.nth(1).getByLabel("Instruction").fill("Bloom to 50");
  await steps.nth(1).getByLabel("Scale target (g)").fill("50");
  await steps.nth(2).getByLabel("Instruction").fill("Pour to 250");
  await steps.nth(2).getByLabel("Scale target (g)").fill("250");
  // Move the last step up, then back down.
  await page.getByRole("button", { name: "Move step 3 up" }).click();
  await expect(steps.nth(1).getByLabel("Instruction")).toHaveValue("Pour to 250");
  await page.getByRole("button", { name: "Move step 2 down" }).click();
  await expect(steps.nth(2).getByLabel("Instruction")).toHaveValue("Pour to 250");
  await page.getByRole("button", { name: "Save" }).click();

  await page.waitForURL(/\/recipes\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "My Test Recipe" })).toBeVisible();
  await expect(page.getByText("Target 50 g · add 50 g")).toBeVisible();
  await expect(page.getByText("Target 250 g · add 200 g")).toBeVisible();

  // A bundled recipe cannot be edited directly; "Edit a copy" forks it.
  await page.goto("/recipes");
  await page.getByRole("link", { name: /AeroPress Standard/ }).click();
  await page.getByRole("button", { name: "Edit a copy" }).click();
  await page.waitForURL(/\/recipes\/[^/]+\/edit$/);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("AeroPress Standard (copy)");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/recipes\/[^/]+$/);
  await expect(page.getByText("Copied from")).toBeVisible();
  await expect(page.getByText(/BrewCore bundled catalogue/)).toBeVisible();
});

test("a scale target above the total water is rejected", async ({ page }) => {
  await registerAndOnboard(page);
  await page.goto("/recipes/new");
  await page.getByLabel("Name", { exact: true }).fill("Broken");
  const steps = page.locator(".step-card");
  for (let i = 0; i < 3; i++) await steps.nth(i).getByLabel("Instruction").fill(`Step ${i}`);
  await steps.nth(2).getByLabel("Scale target (g)").fill("999");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("The scale target is higher than the recipe's total water.")).toBeVisible();
});
