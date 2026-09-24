import { expect, test } from "@playwright/test";
import { addGrinder, registerAndOnboard, selectByText } from "./helpers";

/** Published grind recommendations for bundled grinder models (§9). */
test("a bundled grinder shows its recommended settings and hints them in brew setup", async ({ page }) => {
  await registerAndOnboard(page);
  await addGrinder(page, /Porlex Mini II/);

  const card = page.getByRole("region", { name: "Recommended starting points" });
  await expect(card.getByRole("row", { name: /Pour-over \/ filter\s+9–11 clicks/ })).toBeVisible();
  await expect(card.getByRole("link", { name: "Manufacturer" })).toHaveAttribute("href", /porlexgrinders\.com/);

  await page.goto("/brew/new");
  await selectByText(page, "Recipe", "V60 Two-Pour");
  await expect(page.getByText("Recommended start for Pour-over / filter: 9–11 clicks")).toBeVisible();
});
