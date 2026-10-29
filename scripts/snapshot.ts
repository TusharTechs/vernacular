// Saves real checks of the landing sample and the gallery scenarios to
// src/lib/vernacular/snapshots/data.json, which the site serves instantly.
// Usage: npm run snapshot                 (everything)
//        npm run snapshot -- tour radio   (only these ids; "sample" for the landing sample, "campaign" for /campaign)
import { readFileSync, writeFileSync } from "node:fs";
import { collectCampaign, SAMPLE_CAMPAIGN } from "../src/lib/vernacular/campaign";
import { AUDIENCE_PRESETS, SAMPLE_COPY } from "../src/lib/vernacular/presets";
import { runCheck } from "../src/lib/vernacular/run";
import { SCENARIOS } from "../src/lib/vernacular/scenarios";
import { slimResult } from "../src/lib/vernacular/slim";
import type { CheckInput, CheckResult } from "../src/lib/vernacular/types";

const FILE = "src/lib/vernacular/snapshots/data.json";
const data = JSON.parse(readFileSync(FILE, "utf8")) as { sample?: unknown; scenarios?: Record<string, unknown>; campaign?: unknown };
data.scenarios ??= {};

const jobs: { id: string; input: CheckInput }[] = [
  { id: "sample", input: { text: SAMPLE_COPY[0].text, audience: AUDIENCE_PRESETS[0].spec } },
  ...SCENARIOS.map((s) => ({ id: s.id, input: { text: s.text, audience: s.audience } })),
];
const only = process.argv.slice(2);
const todo = only.length ? jobs.filter((j) => only.includes(j.id)) : jobs;

function summary(r: CheckResult) {
  const lines = r.references.map((ref) => {
    const sw = r.swaps.find((s) => s.referenceId === ref.id);
    const kept = r.kept.find((k) => k.referenceId === ref.id);
    const head = `  ${ref.span}: ${ref.verdict}${ref.percentile !== null ? ` p${ref.percentile}` : ""}`;
    if (sw) return `${head} → ${sw.replacement.name} p${sw.replacement.percentile}${sw.shared?.length ? ` [${sw.shared.join(", ")}]` : ""}`;
    return kept ? `${head} (kept: ${kept.reason.slice(0, 90)})` : head;
  });
  return [...lines, `  rewritten: ${r.rewrittenText.replace(/\s+/g, " ").slice(0, 400)}`, `  ${r.stats.qlooCalls} Qloo calls, ${r.stats.llmCalls} model calls, ${(r.stats.ms / 1000).toFixed(1)} s`].join("\n");
}

(async () => {
  if (!only.length || only.includes("campaign")) {
    const c = await collectCampaign(SAMPLE_CAMPAIGN);
    data.campaign = c;
    writeFileSync(FILE, JSON.stringify(data) + "\n");
    console.log("campaign");
    for (const [v, variant] of c.input.variants.entries()) {
      const row = c.cells.filter((x) => x.variant === v).sort((a, b) => a.audience - b.audience);
      console.log(`  ${variant.name.padEnd(14)} ${row.map((x) => (x.fit === null ? "  –" : String(x.fit).padStart(3))).join("  ")}`);
    }
    console.log(`  ${c.stats.qlooCalls} Qloo calls, ${(c.stats.ms / 1000).toFixed(1)} s\n`);
  }
  for (const j of todo) {
    // One at a time, to stay inside Qloo's per-second limit.
    const result = await runCheck(j.input);
    const snap = { checkedAt: new Date().toISOString(), result: slimResult(result) };
    if (j.id === "sample") data.sample = snap;
    else data.scenarios![j.id] = snap;
    writeFileSync(FILE, JSON.stringify(data) + "\n");
    console.log(`${j.id}\n${summary(result)}\n`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
