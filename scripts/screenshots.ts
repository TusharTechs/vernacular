// Captures the README and Devpost gallery screenshots from a running app.
// Usage: npm run screenshots -- [base-url]   (default http://localhost:3000)
// Saved checks make the pages deterministic; the Dial Test, comments and map
// call the live APIs, so the server needs its keys for those shots.
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const settle = (page: Page, ms = 1200) => page.waitForTimeout(ms);
async function seenTour(page: Page) {
  await page.addInitScript(() => localStorage.setItem("vernacular-tour-seen", "1"));
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 847 }, deviceScaleFactor: 1.25, colorScheme: "light" });
  const page = await ctx.newPage();
  await seenTour(page);

  // Home, then the check it opens on.
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.waitForSelector("#sec-copy");
  await settle(page, 2500);
  await page.screenshot({ path: `${OUT}/home.png` });
  await page.locator("#sec-copy").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -80));
  await settle(page);
  await page.screenshot({ path: `${OUT}/check.png` });

  // Element shots below shouldn't have the sticky results bar over them.
  await page.addStyleTag({ content: 'nav[aria-label="Results"] { visibility: hidden !important; }' });

  // A reference card with its swap.
  const card = page.locator('aside[aria-label="Audience and references"] article').filter({ has: page.locator('[data-tour="swap"]') }).first();
  await card.scrollIntoViewIfNeeded();
  await settle(page, 600);
  await card.screenshot({ path: `${OUT}/reference-card.png` });

  // Dial Test: play, wait for the swapped take to land.
  const play = page.locator('[data-tour="dial-play"]');
  if (await play.count()) {
    await play.scrollIntoViewIfNeeded();
    await play.click();
    // Original take, then the take with swaps; capture once both curves are drawn.
    await page.waitForTimeout(34000);
    await page.locator("#sec-dial").screenshot({ path: `${OUT}/dial-test.png` });
  }

  // Predicted comments.
  const comments = page.locator('[data-tour="comments"]');
  if (await comments.count()) {
    await comments.scrollIntoViewIfNeeded();
    await comments.click();
    await page.waitForTimeout(25000);
    await page.locator("#sec-feed").screenshot({ path: `${OUT}/comments.png` });
  }

  // Map.
  const map = page.locator('[data-tour="map"]');
  if (await map.count()) {
    await map.scrollIntoViewIfNeeded();
    const go = page.locator("#sec-map button").filter({ hasText: /map|show|where/i }).first();
    if (await go.count()) await go.click();
    await page.waitForTimeout(20000);
    await page.locator("#sec-map").screenshot({ path: `${OUT}/map.png` });
  }

  // Culture Translator, live for one reference.
  await page.goto(base + "/translate", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500); // opens on the saved Seinfeld run
  await page.screenshot({ path: `${OUT}/translator.png` });

  // Vernacular Anywhere: the extension's check on a chat box. Its pill lives in a
  // closed shadow root, so it's clicked by position, where the script places it.
  await page.goto(base + "/anywhere", { waitUntil: "networkidle" });
  const chat = page.locator('textarea[placeholder="Message #launch-video"]');
  await chat.scrollIntoViewIfNeeded();
  await page.locator('section:has(textarea[placeholder="Message #launch-video"]) button', { hasText: "Use an example" }).click();
  await page.waitForTimeout(25000);
  const r = (await chat.boundingBox())!;
  await page.mouse.click(Math.min(1280 - 90, r.x + r.width - 80), Math.min(847 - 20, r.y + r.height - 1));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/anywhere.png` });

  // Other pages.
  // Campaign check: the grid and its summary.
  await page.goto(base + "/campaign", { waitUntil: "networkidle" });
  await settle(page, 2000);
  await page.locator('section[aria-label="Campaign grid"]').screenshot({ path: `${OUT}/campaign.png` });

  for (const [path, name, wait] of [
    ["/benchmark", "benchmark", 1500],
    ["/how", "how", 1500],
  ] as const) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await settle(page, wait);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }

  // Dark mode home.
  const dark = await browser.newContext({ viewport: { width: 1280, height: 847 }, deviceScaleFactor: 1.25, colorScheme: "dark" });
  const dp = await dark.newPage();
  await seenTour(dp);
  await dp.goto(base + "/", { waitUntil: "networkidle" });
  await dp.waitForSelector("#sec-copy");
  await settle(dp, 2500);
  await dp.screenshot({ path: `${OUT}/home-dark.png` });

  await browser.close();
  console.log(`Screenshots in ${OUT}/`);
})();
