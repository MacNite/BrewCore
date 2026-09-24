// Renders public/icon.svg to the PNG sizes the manifest and iOS need, using
// Playwright's Chromium. Run after changing the icon: node scripts/generate-icons.mjs
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "@playwright/test";

const svg = readFileSync("public/icon.svg", "utf8");
// Maskable: full-bleed background, artwork inside the 80% safe zone.
const maskable = svg
  .replace('<rect width="512" height="512" rx="112" fill="#0b6e6a"/>', '<rect width="512" height="512" fill="#0b6e6a"/><g transform="translate(51.2 51.2) scale(0.8)">')
  .replace("</svg>", "</g></svg>");

const executablePath = ["/opt/pw-browsers/chromium", process.env.PLAYWRIGHT_CHROMIUM_PATH].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
const targets = [
  ["public/icon-192.png", svg, 192],
  ["public/icon-512.png", svg, 512],
  ["public/icon-maskable-512.png", maskable, 512],
  ["public/apple-icon.png", maskable, 180],
];
for (const [file, source, size] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${source.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.locator("svg").screenshot({ path: file, omitBackground: true });
  console.log(`wrote ${file}`);
}
await browser.close();
