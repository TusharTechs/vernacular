// Run a check from the terminal. Usage: npm run check -- [sample-name]
import { runCheck } from "../src/lib/vernacular/run";
import { SAMPLES } from "../src/lib/vernacular/samples";

const name = process.argv[2] ?? "tour";
const input = SAMPLES[name];
if (!input) {
  console.error(`Unknown sample "${name}". Options: ${Object.keys(SAMPLES).join(", ")}`);
  process.exit(1);
}

runCheck(input, (e) => {
  if (e.type === "audience") console.log(`Audience anchors: ${e.anchors.map((a) => a.name).join(", ")}`);
  if (e.type === "extracted") console.log(`Found ${e.references.length} references: ${e.references.map((r) => `${r.span} (${r.type})`).join(", ")}`);
  if (e.type === "scored") console.log(`  ${e.reference.verdict.padEnd(10)} ${e.reference.span} → ${e.reference.entity?.name ?? "not found"} · p${e.reference.percentile ?? "–"} · ${e.reference.notes.join(" ")}`);
  if (e.type === "agent_step") console.log(`    · ${e.message}`);
  if (e.type === "swap") console.log(`  SWAP ${e.swap.referenceId} → ${e.swap.replacement.name} (p${e.swap.replacement.percentile}): ${e.swap.rationale}`);
  if (e.type === "kept") console.log(`  KEEP ${e.kept.referenceId}: ${e.kept.reason}`);
})
  .then((r) => {
    console.log(`\nOriginal:  ${r.input.text}\nRewritten: ${r.rewrittenText}`);
    console.log(`\n${r.stats.qlooCalls} Qloo calls · ${r.stats.llmCalls} Claude calls · ${(r.stats.ms / 1000).toFixed(1)}s`);
  })
  .catch((e) => {
    console.error("\nCheck failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
