// Rebuilds the home-page ticker (src/lib/vernacular/showcase.ts) from the saved
// snapshots, so every swap it shows is one a visitor can open in the gallery.
// Usage: npm run showcase   (npm run snapshot runs it at the end)
import { readFileSync, writeFileSync } from "node:fs";
import type { Snapshot } from "../src/lib/vernacular/snapshots";

const data = JSON.parse(readFileSync("src/lib/vernacular/snapshots/data.json", "utf8")) as { sample?: Snapshot; scenarios?: Record<string, Snapshot> };
const runs = [data.sample, ...Object.values(data.scenarios ?? {})].filter((x): x is Snapshot => !!x);

const rows: string[] = [];
const seen = new Set<string>();
for (const { result, checkedAt } of runs) {
  let taken = 0;
  const swapped = result.swaps.map((x) => result.references.find((r) => r.id === x.referenceId)?.span ?? "");
  for (const sw of result.swaps) {
    if (taken >= 2) break;
    const ref = result.references.find((r) => r.id === sw.referenceId);
    if (!ref || ref.percentile === null || sw.replacement.percentile === null || sw.replacement.percentile < 65) continue;
    if (seen.has(sw.replacement.name)) continue;
    // Only swaps where the edit is the reference itself, so the ticker shows exactly
    // what the agent wrote. The swap's change is relative to the sentence as it stood.
    const { prefix, suffix } = sw.change;
    let from = sw.change.before;
    let to = sw.change.after;
    while (from && to && from.at(-1) === to.at(-1) && /[^\p{L}\p{N}]/u.test(from.at(-1)!)) {
      from = from.slice(0, -1);
      to = to.slice(0, -1);
    }
    for (const tail of ["'s", "’s"]) if (from.endsWith(tail) && to.endsWith(tail)) [from, to] = [from.slice(0, -2), to.slice(0, -2)];
    if (from !== ref.span || !to.trim()) continue;
    const sentence = prefix + sw.change.before + suffix;
    const at = prefix.length;
    const written = to;
    // The clause around the reference keeps the ticker to one line.
    const clauses = sentence.split(/(?<=[,;:—])\s+/);
    let pos = 0;
    const clause = clauses.find((c) => {
      const start = sentence.indexOf(c, pos);
      pos = start + c.length;
      return start <= at && at < start + c.length;
    }) ?? sentence;
    const raw = clause.replace(/[,;:—]$/, "").replace(/^(and|but|or) /i, "").replace(ref.span, "{ref}");
    const line = raw.charAt(0).toUpperCase() + raw.slice(1);
    // Skip a clause that still shows another reference the copy swapped.
    if (line.length > 80 || swapped.some((x) => x && x !== ref.span && line.includes(x))) continue;
    seen.add(sw.replacement.name);
    rows.push(
      `  { audience: ${JSON.stringify(result.audience.label)}, line: ${JSON.stringify(line)}, before: { name: ${JSON.stringify(ref.span)}, p: ${ref.percentile} }, after: { name: ${JSON.stringify(written)}, p: ${sw.replacement.percentile} }, checkedAt: ${JSON.stringify(checkedAt.slice(0, 10))} },`,
    );
    taken++; // at most two per run keeps the ticker varied
  }
}

writeFileSync(
  "src/lib/vernacular/showcase.ts",
  `// Real swaps from the saved gallery checks (written by scripts/showcase.ts), used by
// the home-page ticker. Each line is from our own sample copy; scores are Qloo percentiles.

export interface ShowcaseSwap {
  audience: string;
  line: string; // "{ref}" marks the reference
  before: { name: string; p: number };
  after: { name: string; p: number };
  checkedAt: string;
}

export const SHOWCASE: ShowcaseSwap[] = [
${rows.join("\n")}
];
`,
);
console.log(`showcase: ${rows.length} swaps`);
