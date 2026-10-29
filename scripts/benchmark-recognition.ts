// Adds the outside recognition check to the published benchmark results: every
// reference in every version gets a 1–5 rating from a non-Claude model, blind to
// which version used it. Usage: npm run benchmark:recognition [-- results-file]
import { readFile, writeFile } from "node:fs/promises";
import { describeAudience } from "../src/lib/vernacular/baseline";
import { BENCHMARK_AUDIENCES } from "../src/lib/vernacular/benchmark/corpus";
import { RECOGNITION_MODEL, rateRecognition } from "../src/lib/vernacular/benchmark/recognition";
import { summarize } from "../src/lib/vernacular/benchmark/summarize";
import type { BenchmarkRun, GradedRef } from "../src/lib/vernacular/benchmark/types";

const OUT = process.argv[2] ?? "src/lib/vernacular/benchmark/results.json";
const label = (r: GradedRef) => r.name ?? r.span;
const keyOf = (r: GradedRef) => label(r).toLowerCase();

(async () => {
  const run = JSON.parse(await readFile(OUT, "utf8")) as BenchmarkRun;
  for (const preset of BENCHMARK_AUDIENCES) {
    const pairs = run.pairs.filter((p) => p.audienceId === preset.id);
    const refs = pairs.flatMap((p) => [...p.original.refs, ...p.claude.refs, ...p.vernacular.refs]);
    const unique = [...new Map(refs.map((r) => [keyOf(r), r])).values()];
    // Shuffle reproducibly so no version's names cluster together.
    const order = unique
      .map((r) => ({ r, h: [...keyOf(r)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 17) }))
      .sort((a, b) => a.h - b.h)
      .map((x) => x.r);
    const scores = new Map<string, number>();
    for (let i = 0; i < order.length; i += 40) {
      const chunk = order.slice(i, i + 40);
      const s = await rateRecognition(describeAudience(preset.spec), chunk.map((r) => ({ name: label(r), type: r.type })));
      chunk.forEach((r, j) => scores.set(keyOf(r), s[j]));
    }
    for (const p of pairs) for (const r of [...p.original.refs, ...p.claude.refs, ...p.vernacular.refs]) r.recognition = scores.get(keyOf(r));
    console.log(`${preset.id}: rated ${order.length} references`);
  }
  run.recognitionModel = RECOGNITION_MODEL;
  await writeFile(OUT, JSON.stringify(run, null, 2) + "\n");
  const s = summarize(run.pairs, run.audiences);
  for (const k of ["original", "claude", "vernacular"] as const) {
    console.log(`${k.padEnd(11)} recognition ${s.arms[k].recognition} (without echoes ${s.arms[k].recognitionWithoutEchoes}) · at p100 ${s.arms[k].topShare}`);
  }
  console.log(`Paired recognition, Vernacular − Claude: ${JSON.stringify(s.recognitionPaired)}`);
  console.log(`Without echoes: ${JSON.stringify(s.recognitionPairedWithoutEchoes)}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
