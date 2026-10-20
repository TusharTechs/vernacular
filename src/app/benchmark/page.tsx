import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { BenchmarkExplorer } from "@/components/benchmark-explorer";
import data from "@/lib/vernacular/benchmark/results.json";
import { summarize, type ArmKey } from "@/lib/vernacular/benchmark/summarize";
import type { BenchmarkRun } from "@/lib/vernacular/benchmark/types";
import { THRESHOLDS } from "@/lib/vernacular/score";

const run = data as BenchmarkRun;

export const metadata: Metadata = {
  title: "Benchmark · Vernacular",
  description: "The same copy and audiences, localized by Claude alone and by Vernacular, every result graded the same way on Qloo's taste graph.",
};

const ARM_LABEL: Record<ArmKey, string> = { original: "Original copy", claude: "Claude alone", vernacular: "Vernacular" };
const ARM_DOT: Record<ArmKey, string> = { original: "bg-unmeasured", claude: "bg-mixed", vernacular: "bg-accent" };
const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);

/** A 0–100 percentile track with the lands/misses bands drawn in. */
function Track({ values }: { values: Partial<Record<ArmKey, number | null>> }) {
  return (
    <div className="relative h-6 w-full">
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-desk">
        <div className="absolute inset-y-0 left-0 bg-misses-soft" style={{ width: `${THRESHOLDS.misses}%` }} />
        <div className="absolute inset-y-0 right-0 bg-lands-soft" style={{ width: `${100 - THRESHOLDS.lands}%` }} />
      </div>
      {(Object.entries(values) as [ArmKey, number | null][]).map(([k, v]) =>
        v === null ? null : (
          <span
            key={k}
            title={`${ARM_LABEL[k]}: p${Math.round(v)}`}
            className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sheet ${ARM_DOT[k]}`}
            style={{ left: `${v}%` }}
          />
        ),
      )}
    </div>
  );
}

/** The brief examples Claude alone repeated most often, e.g. "Bad Bunny for Bad Bunny fans". */
function topEchoes(n: number) {
  const counts = new Map<string, number>();
  for (const p of run.pairs) {
    const anchors = run.audiences.find((a) => a.id === p.audienceId)?.anchors ?? [];
    for (const r of p.claude.refs) {
      const hit = anchors.find((a) => [r.name, r.span].some((x) => x?.toLowerCase() === a.toLowerCase()));
      if (hit) counts.set(hit, (counts.get(hit) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name]) => name);
}

export default function BenchmarkPage() {
  const s = summarize(run.pairs, run.audiences);
  const echoed = topEchoes(2);
  const total = run.copy.length * run.audiences.length;
  const arms: ArmKey[] = ["original", "claude", "vernacular"];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-6 sm:px-6 lg:py-10">
      <SiteHeader />
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl italic tracking-tight text-balance sm:text-5xl">Does a frontier model know your audience?</h1>
        <p className="max-w-2xl text-muted">
          {run.copy.length} pieces of ad copy × {run.audiences.length} audiences. Claude alone and Vernacular each rewrote every piece for every
          audience, using the same model and the same brief. Then every final text went through one grader: find its references, score each on
          Qloo&apos;s taste graph for that audience.
        </p>
        {s.pairs < total && (
          <p className="text-xs text-muted">
            {s.pairs} of {total} pairs finished in the latest run.
          </p>
        )}
      </header>

      <section aria-label="Headline results" className="grid gap-3 sm:grid-cols-3">
        {arms.map((k) => {
          const a = s.arms[k];
          return (
            <div key={k} className={`flex flex-col gap-3 rounded-xl border bg-sheet p-5 ${k === "vernacular" ? "border-accent" : "border-rule"}`}>
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
                <span className={`h-2.5 w-2.5 rounded-full ${ARM_DOT[k]}`} /> {ARM_LABEL[k]}
              </span>
              <span className="font-mono text-5xl tracking-tight">p{a.meanPercentile === null ? "–" : Math.round(a.meanPercentile)}</span>
              <Track values={{ [k]: a.meanPercentile }} />
              <span className="text-sm text-muted">
                <span className="text-lands">{pct(a.landRate)} land</span> · <span className="text-misses">{pct(a.missRate)} miss</span> ·{" "}
                {a.measured + a.unmeasured} references
              </span>
              {a.echoes > 0 && (
                <span className="text-xs text-muted">
                  {a.echoes} repeat the brief&apos;s own examples · p{a.meanWithoutEchoes === null ? "–" : Math.round(a.meanWithoutEchoes)} without them
                </span>
              )}
            </div>
          );
        })}
      </section>

      {s.arms.claude.echoes > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-mixed bg-mixed-soft p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mixed">What Claude alone does instead</h2>
          <p className="max-w-3xl font-serif text-2xl leading-snug text-balance">
            {s.arms.claude.echoes} of Claude&apos;s {s.arms.claude.measured + s.arms.claude.unmeasured} references were the examples we used to describe
            the audience{echoed.length ? `: ${echoed.map((e) => `${e} for ${e} fans`).join(", ")}` : ""}.
          </p>
          <p className="max-w-3xl text-sm text-muted">
            Those score a perfect p100 by definition, so they flatter the headline above. Leave echoes out of both sides and Claude alone averages{" "}
            <span className="font-mono text-ink">p{s.arms.claude.meanWithoutEchoes === null ? "–" : Math.round(s.arms.claude.meanWithoutEchoes)}</span>{" "}
            against Vernacular&apos;s{" "}
            <span className="font-mono text-ink">p{s.arms.vernacular.meanWithoutEchoes === null ? "–" : Math.round(s.arms.vernacular.meanWithoutEchoes)}</span>
            , and Vernacular scores higher in {s.pairedWithoutEchoes.wins} of {s.pairedWithoutEchoes.n} pairs
            {s.pairedWithoutEchoes.meanDiff !== null && (
              <>
                {" "}
                by {s.pairedWithoutEchoes.meanDiff} points on average
                {s.pairedWithoutEchoes.ci && ` (95% interval ${s.pairedWithoutEchoes.ci[0]} to ${s.pairedWithoutEchoes.ci[1]})`}
              </>
            )}
            . Vernacular repeated the brief {s.arms.vernacular.echoes === 0 ? "zero times" : `${s.arms.vernacular.echoes} times`}: Qloo leaves the
            examples you give it out of its suggestions, so every swap is a new name the audience already loves.
          </p>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4 rounded-xl border border-rule bg-sheet p-6">
          <h2 className="text-sm font-semibold">Pair by pair</h2>
          <p className="font-serif text-2xl leading-snug text-balance">
            Vernacular&apos;s rewrite scored higher than Claude&apos;s in <span className="text-accent">{s.paired.wins}</span> of {s.paired.n} pairs,
            tied in {s.paired.ties} and scored lower in {s.paired.losses}.
          </p>
          <p className="text-sm text-muted">
            Average gap{" "}
            <span className="font-mono text-ink">
              {s.paired.meanDiff === null ? "–" : `${s.paired.meanDiff > 0 ? "+" : ""}${s.paired.meanDiff}`} percentile points
            </span>
            {s.paired.ci && (
              <>
                {" "}
                (95% bootstrap interval {s.paired.ci[0]} to {s.paired.ci[1]})
              </>
            )}
            . A tie is within one point, usually because both left the copy alone.
          </p>
          <div className="mt-2 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>Mean percentile by audience</span>
              <span className="flex gap-3">
                {arms.map((k) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${ARM_DOT[k]}`} /> {ARM_LABEL[k]}
                  </span>
                ))}
              </span>
            </div>
            {s.byAudience.map((row) => (
              <div key={row.audienceId} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[12rem_1fr]">
                <span className="truncate text-sm">{run.audiences.find((a) => a.id === row.audienceId)?.label}</span>
                <Track values={{ original: row.original, claude: row.claude, vernacular: row.vernacular }} />
              </div>
            ))}
            <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-3 font-mono text-[10px] text-muted sm:grid-cols-[12rem_1fr]">
              <span />
              <span className="flex justify-between">
                <span>p0</span>
                <span>misses &lt; p{THRESHOLDS.misses}</span>
                <span>lands ≥ p{THRESHOLDS.lands}</span>
                <span>p100</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-rule bg-sheet p-6">
          <h2 className="text-sm font-semibold">Did the copy survive?</h2>
          <p className="text-sm text-muted">
            Fit is only half the job. A blind judge saw both rewrites in random order and rated whether each kept the original&apos;s message and still
            read naturally.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-normal" />
                <th className="py-1 font-normal">Claude alone</th>
                <th className="py-1 font-normal">Vernacular</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-t border-rule">
                <td className="py-2 font-sans">Meaning kept</td>
                <td>{s.fidelity.claude.meaning ?? "–"}/5</td>
                <td>{s.fidelity.vernacular.meaning ?? "–"}/5</td>
              </tr>
              <tr className="border-t border-rule">
                <td className="py-2 font-sans">Reads naturally</td>
                <td>{s.fidelity.claude.natural ?? "–"}/5</td>
                <td>{s.fidelity.vernacular.natural ?? "–"}/5</td>
              </tr>
              <tr className="border-t border-rule">
                <td className="py-2 font-sans">References changed</td>
                <td>{s.changes.claude ?? "–"}</td>
                <td>{s.changes.vernacular ?? "–"}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted">
            Vernacular averaged {s.speed.meanQlooCalls ?? "–"} Qloo lookups and {s.speed.meanMs === null ? "–" : Math.round(s.speed.meanMs / 1000)}s
            per check.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-serif text-2xl italic">Every pair</h2>
          <p className="text-sm text-muted">Pick a piece of copy and an audience to see all three versions and how each reference scored.</p>
        </div>
        <BenchmarkExplorer run={run} />
      </section>

      <section className="grid gap-6 border-t border-rule pt-8 text-sm leading-relaxed md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">How it was measured</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted">
            <li>
              Both systems got the same copy and the same audience description: a label, two things the audience loves, and an age band. Claude
              alone answered from its own knowledge; Vernacular used Qloo through its swap agent.
            </li>
            <li>
              Each final text was graded by one pass, the same for all three versions: Claude finds the references, Qloo resolves each one and ranks
              it against about 40 well-known entities of the same type for that audience. A percentile of 70 means it beats 70% of them.
            </li>
            <li>
              Lands is p{THRESHOLDS.lands} or above, misses is below p{THRESHOLDS.misses}, with one step down when Qloo shows the reference
              skews away from the audience&apos;s age.
            </li>
            <li>
              The fidelity judge is Claude at low effort, shown both rewrites unlabelled in a fixed random order, and told not to judge audience fit.
            </li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">What it doesn&apos;t show</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted">
            <li>
              Qloo is both Vernacular&apos;s source and the grader, so this measures how far a model alone is from what Qloo&apos;s data says about an
              audience, not how real people react. In an earlier fixed-in-advance check, Qloo&apos;s percentiles ranked references the way the
              audiences&apos; own tastes predicted most of the time, but that isn&apos;t a human panel.
            </li>
            <li>The copy was written for this benchmark and is short; each pair ran once, and model outputs vary between runs.</li>
            <li>Reference finding is itself model-based, so a version can be graded on a slightly different set of references.</li>
          </ul>
        </div>
      </section>

      <footer className="flex flex-wrap justify-between gap-2 border-t border-rule pt-4 font-mono text-xs text-muted">
        <span>
          Corpus v{run.corpusVersion} · {run.model} · run {run.ranAt}
        </span>
        <span>Reproduce with npm run benchmark</span>
      </footer>
    </main>
  );
}
