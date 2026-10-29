// Accessibility and small-screen check of the main pages, with axe-core in a real
// browser. Usage: npm run a11y -- [base-url]   (default http://localhost:3000)
// Prints axe violations (WCAG 2 A/AA rules plus best practices) per page at desktop
// width in the light and the dark theme, and whether each page fits a 375 px screen
// without sideways scrolling.
import { createRequire } from "node:module";
import { chromium } from "playwright";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const PAGES = ["/", "/translate", "/anywhere", "/benchmark", "/how", "/pitch", "/campaign"];
const axeSource = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

type AxeResult = { violations: { id: string; impact: string | null; nodes: unknown[]; help: string }[] };

(async () => {
  const browser = await chromium.launch();
  let failures = 0;
  const { version } = createRequire(import.meta.url)("axe-core/package.json") as { version: string };
  console.log(`axe-core ${version} · ${base} · ${new Date().toISOString()}`);
  for (const scheme of ["light", "dark"] as const) {
    for (const path of PAGES) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
      const res = await page.goto(base + path, { waitUntil: "networkidle" });
      if (!res || res.status() === 404) {
        console.log(`${path} (${scheme}): skipped (${res?.status() ?? "no response"})`);
        await page.close();
        continue;
      }
      await page.waitForTimeout(1500); // let streamed and animated content settle
      await page.addScriptTag({ path: axeSource });
      const r = (await page.evaluate(() =>
        (window as unknown as { axe: { run: (o: unknown) => Promise<unknown> } }).axe.run({
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
        }),
      )) as AxeResult;
      await page.setViewportSize({ width: 375, height: 800 });
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const ok = r.violations.length === 0 && overflow <= 0;
      if (!ok) failures++;
      console.log(`${ok ? "pass" : "FAIL"} ${path} (${scheme}): ${r.violations.length} axe violations; 375 px ${overflow <= 0 ? "fits" : `overflows by ${overflow}px`}`);
      for (const v of r.violations) console.log(`     ${v.impact ?? ""} ${v.id} (${v.nodes.length}): ${v.help}`);
      await page.close();
    }
  }
  await browser.close();
  process.exit(failures ? 1 : 0);
})();
