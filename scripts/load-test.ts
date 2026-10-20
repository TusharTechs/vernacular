// Fires N checks at once against a running server and reports time to first
// score, total time and errors. Usage: npx tsx scripts/load-test.ts [base-url] [n]
import { AUDIENCE_PRESETS } from "../src/lib/vernacular/presets";

const base = process.argv[2] ?? "http://localhost:3000";
const n = Number(process.argv[3] ?? 5);
const shift = Number(process.argv[4] ?? 0); // rotate audiences to avoid cached pairs
const COPY = [
  "Our sparkling water is crisper than a Billie Eilish whisper and cooler than a Stranger Things finale.",
  "This hoodie is cozier than a Gilmore Girls rewatch and tougher than a Rocky training montage.",
  "Our pizza night hits harder than a Drake album drop and lasts longer than a Lord of the Rings marathon.",
  "Fresher than a Beyoncé surprise release, smoother than a Norah Jones record on a Sunday morning.",
  "More dramatic than a Real Housewives reunion, more iconic than a Super Bowl halftime show.",
  "Brighter than a Times Square New Year's Eve and catchier than a Dua Lipa chorus.",
];

async function one(i: number) {
  const t0 = Date.now();
  let first: number | null = null;
  let done: number | null = null;
  let error: string | null = null;
  let bytes = 0;
  const res = await fetch(`${base}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": `198.51.100.${i + 10}` }, // a distinct visitor each (local server only)
    body: JSON.stringify({ text: COPY[i % COPY.length], audience: AUDIENCE_PRESETS[(i + shift) % AUDIENCE_PRESETS.length].spec }),
  });
  if (!res.ok || !res.body) return { i, status: res.status, error: (await res.json().catch(() => ({}))).error ?? "request failed" };
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += value;
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        bytes = Math.max(bytes, line.length);
        const e = JSON.parse(line.slice(6));
        if (e.type === "scored" && first === null) first = Date.now() - t0;
        if (e.type === "done") done = Date.now() - t0;
        if (e.type === "error") error = e.message;
      }
    }
  }
  return { i, status: res.status, firstScore: first && `${(first / 1000).toFixed(1)}s`, done: done && `${(done / 1000).toFixed(1)}s`, largestEventKB: Math.round(bytes / 1024), error };
}

Promise.all(Array.from({ length: n }, (_, i) => one(i))).then((r) => console.table(r));
