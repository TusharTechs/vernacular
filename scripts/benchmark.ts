// Runs the public benchmark: every corpus copy × every audience preset, three arms
// (original, Claude alone, Vernacular), each final text graded the same way.
//
// Usage: npm run benchmark -- [--limit N] [--only copyId] [--summary]
// Qloo responses are kept in .cache/benchmark/qloo, so reruns and resumes are free;
// finished pairs are kept in .cache/benchmark/pairs and skipped next time.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

process.env.QLOO_DISK_CACHE ??= ".cache/benchmark/qloo";

const PAIRS_DIR = ".cache/benchmark/pairs";
const OUT = "src/lib/vernacular/benchmark/results.json";

async function main() {
  const { qlooUsage } = await import("../src/lib/qloo/client");
  const { runCheck } = await import("../src/lib/vernacular/run");
  const { resolveAudience } = await import("../src/lib/vernacular/score");
  const { baselineRewrite, describeAudience } = await import("../src/lib/vernacular/baseline");
  const { MODEL } = await import("../src/lib/vernacular/llm");
  const { BENCHMARK_AUDIENCES, BENCHMARK_COPY, CORPUS_VERSION } = await import("../src/lib/vernacular/benchmark/corpus");
  const { gradeText, toGraded } = await import("../src/lib/vernacular/benchmark/grade");
  const { judgeFidelity } = await import("../src/lib/vernacular/benchmark/judge");
  const { summarize } = await import("../src/lib/vernacular/benchmark/summarize");
  type PairResult = import("../src/lib/vernacular/benchmark/types").PairResult;
  type BenchmarkRun = import("../src/lib/vernacular/benchmark/types").BenchmarkRun;

  const args = process.argv.slice(2);
  const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
  const summaryOnly = args.includes("--summary");

  await mkdir(PAIRS_DIR, { recursive: true });
  const fileOf = (c: string, a: string) => join(PAIRS_DIR, `v${CORPUS_VERSION}__${c}__${a}.json`);
  const done = new Set(await readdir(PAIRS_DIR));

  const todo = BENCHMARK_COPY.filter((c) => !only || c.id === only)
    .flatMap((c) => BENCHMARK_AUDIENCES.map((a) => ({ copy: c, preset: a })))
    .filter(({ copy, preset }) => !done.has(fileOf(copy.id, preset.id).split("/").pop()!))
    .slice(0, summaryOnly ? 0 : limit);
  console.log(`${todo.length} pair(s) to run.`);

  async function runPair({ copy, preset }: (typeof todo)[number]) {
    const key = `${copy.id} × ${preset.id}`;
    const started = Date.now();
    try {
      const spec = preset.spec;
      const [check, base, { audience }] = await Promise.all([
        runCheck({ text: copy.text, audience: spec }),
        baselineRewrite(copy.text, spec),
        resolveAudience(spec),
      ]);
      const original = toGraded(check.references);
      const [claudeRefs, vernRefs] = await Promise.all([
        base.rewritten.trim() === copy.text ? original : gradeText(base.rewritten, audience),
        check.rewrittenText === copy.text ? original : gradeText(check.rewrittenText, audience),
      ]);
      // Random but reproducible order, so the judge can't learn a position.
      const flip = [...key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7) % 2 !== 0;
      const j = await judgeFidelity(
        describeAudience(spec),
        copy.text,
        flip ? check.rewrittenText : base.rewritten,
        flip ? base.rewritten : check.rewrittenText,
      );
      const span = (id: string) => check.references.find((r) => r.id === id)?.span ?? id;
      const pair: PairResult = {
        copyId: copy.id,
        audienceId: preset.id,
        original: { text: copy.text, refs: original },
        claude: { text: base.rewritten, refs: claudeRefs, fidelity: flip ? j.B : j.A, changes: base.swaps.length },
        vernacular: {
          text: check.rewrittenText,
          refs: vernRefs,
          fidelity: flip ? j.A : j.B,
          changes: check.swaps.length,
          swaps: check.swaps.map((s) => ({ from: span(s.referenceId), to: s.replacement.name, percentile: s.replacement.percentile })),
        },
        stats: { qlooCalls: check.stats.qlooCalls, ms: check.stats.ms },
      };
      await writeFile(fileOf(copy.id, preset.id), JSON.stringify(pair, null, 2));
      const avg = (refs: { percentile: number | null }[]) => {
        const m = refs.filter((r) => r.percentile !== null);
        return m.length ? Math.round(m.reduce((s, r) => s + r.percentile!, 0) / m.length) : "–";
      };
      console.log(
        `✓ ${key}  original p${avg(original)} · Claude p${avg(claudeRefs)} · Vernacular p${avg(vernRefs)}  (${((Date.now() - started) / 1000).toFixed(0)}s, ${qlooUsage().networkCalls} network calls so far)`,
      );
    } catch (e) {
      console.log(`✗ ${key}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Two pairs at a time; the Qloo client paces its own requests underneath.
  let next = 0;
  await Promise.all(
    [0, 1].map(async () => {
      while (next < todo.length) await runPair(todo[next++]);
    }),
  );

  const names = new Set(BENCHMARK_COPY.flatMap((c) => BENCHMARK_AUDIENCES.map((a) => fileOf(c.id, a.id).split("/").pop()!)));
  const pairs: PairResult[] = [];
  for (const f of (await readdir(PAIRS_DIR)).sort()) {
    if (names.has(f)) pairs.push(JSON.parse(await readFile(join(PAIRS_DIR, f), "utf8")));
  }
  const run: BenchmarkRun = {
    corpusVersion: CORPUS_VERSION,
    ranAt: new Date().toISOString().slice(0, 10),
    model: MODEL,
    copy: BENCHMARK_COPY,
    audiences: BENCHMARK_AUDIENCES.map((a) => ({ id: a.id, label: a.spec.label, anchors: a.spec.anchors.map((x) => x.query) })),
    pairs,
  };
  await writeFile(OUT, JSON.stringify(run, null, 2) + "\n");

  const s = summarize(pairs, run.audiences);
  console.log(`\n${pairs.length} pairs in ${OUT}`);
  for (const k of ["original", "claude", "vernacular"] as const) {
    const a = s.arms[k];
    console.log(`${k.padEnd(11)} mean p${a.meanPercentile} · lands ${a.landRate} · misses ${a.missRate} · ${a.measured} measured, ${a.unmeasured} unmeasured`);
  }
  console.log(`Echoes of the brief: Claude ${s.arms.claude.echoes}, Vernacular ${s.arms.vernacular.echoes}; without them Claude p${s.arms.claude.meanWithoutEchoes} · Vernacular p${s.arms.vernacular.meanWithoutEchoes}`);
  console.log(`Without echoes, Vernacular − Claude: ${s.pairedWithoutEchoes.meanDiff} pts (95% CI ${s.pairedWithoutEchoes.ci?.join(" to ")}), ${s.pairedWithoutEchoes.wins}W/${s.pairedWithoutEchoes.ties}T/${s.pairedWithoutEchoes.losses}L`);
  console.log(`Vernacular − Claude: ${s.paired.meanDiff} pts (95% CI ${s.paired.ci?.join(" to ")}), ${s.paired.wins}W/${s.paired.ties}T/${s.paired.losses}L`);
  console.log(`Fidelity: Claude ${JSON.stringify(s.fidelity.claude)} · Vernacular ${JSON.stringify(s.fidelity.vernacular)}`);
  const u = qlooUsage();
  console.log(`Qloo: ${u.networkCalls} network calls this run; ${u.monthRemaining ?? "?"} left this month.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
