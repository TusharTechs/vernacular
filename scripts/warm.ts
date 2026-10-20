// Fills the server caches after a deploy: the landing sample and every gallery
// scenario, so the first visitor never waits for a live check.
// Usage: npm run warm -- [base-url]   (default https://vernacular-lime.vercel.app)
import { SCENARIOS } from "../src/lib/vernacular/scenarios";

const base = (process.argv[2] ?? "https://vernacular-lime.vercel.app").replace(/\/$/, "");

async function hit(path: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(base + path, { signal: AbortSignal.timeout(180_000) });
    return `${res.ok ? "ok  " : `${res.status} `} ${path} ${((Date.now() - t0) / 1000).toFixed(1)}s`;
  } catch (e) {
    return `fail ${path} ${(e as Error).message}`;
  }
}

(async () => {
  console.log(await hit("/api/sample"));
  // One at a time, to stay well inside Qloo's per-second limit.
  for (const s of SCENARIOS) console.log(await hit(`/api/scenario/${s.id}`));
})();
