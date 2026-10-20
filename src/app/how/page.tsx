import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "How it works · Vernacular",
  description: "How Vernacular decides what lands: the pipeline, the scoring method, the Qloo calls behind it, and what we learned about culture and audiences.",
};

// Seinfeld's percentile for each audience preset, from a live Culture Translator run on Oct 20, 2026.
const SEINFELD = [
  { audience: "25–29 indie & A24 fans", p: 20 },
  { audience: "30–34 hip-hop heads", p: 28 },
  { audience: "Gen Z Latin-pop fans", p: 40 },
  { audience: "45–54 country fans", p: 85 },
  { audience: "55+ classic-rock fans", p: 100 },
];

const STEPS = [
  {
    n: "1",
    h: "Read",
    who: "Claude",
    d: "Finds every named reference in copy, storyboard frames or a video's voiceover, with the role it plays in its sentence (\"shorthand for a binge-worthy sitcom\").",
  },
  {
    n: "2",
    h: "Score",
    who: "Qloo",
    d: "Resolves each reference and ranks it against ~40 well-known peers of the same type, scored for this audience in the same request, then adjusts for its age skew.",
  },
  {
    n: "3",
    h: "Swap",
    who: "Claude agent + Qloo",
    d: "One agent per sentence asks Qloo for equivalents the audience over-indexes on, verifies each with the same scoring, and rewrites only the words it needs.",
  },
  {
    n: "4",
    h: "Prove",
    who: "Evidence",
    d: "Every verdict and swap links to the Qloo calls behind it, with Qloo's explainability: which of the audience's favourites pulled a swap in.",
  },
];

const FINDINGS = [
  {
    h: "Raw affinity can't be compared across audiences.",
    d: "The same references average very different affinities from one audience to the next. So Vernacular never compares raw numbers across audiences: it ranks a reference against well-known peers scored for the same audience in the same request.",
  },
  {
    h: "Without data, a model repeats the brief.",
    d: "In our benchmark, 36 of Claude alone's references were the very examples used to describe the audience: Bad Bunny for Bad Bunny fans. Qloo excludes the examples you give it, so every swap is a new name the audience already loves.",
  },
  {
    h: "Popularity isn't recognisability.",
    d: "Qloo rated a little-known 2019 film (popularity 0.93) about as popular as Boy Meets World (0.92). For a yardstick like \"funnier than X\", the agent has to choose a household name, so that rule lives in its instructions.",
  },
  {
    h: "Search always answers, even when it shouldn't.",
    d: "A made-up band, \"Zorblax Quartet\", came back as Vitamin String Quartet; a TV search for \"Bob Ross\" returned Bob's Burgers. Every match now has to plausibly be the thing asked for, using Qloo's alternative names, so La Casa de Papel still finds Money Heist.",
  },
  {
    h: "Facts aren't references.",
    d: "\"From the studio that gave you Jurassic Park\" is a claim about the studio. Swapping it would make the ad untrue, so credits, venues and where something is sold are always kept.",
  },
  {
    h: "Local places need local peers.",
    d: "With a city set, Qloo scores only places near it, so they're ranked against that city's well-known places. For 30–34 hip-hop fans in Chicago, Wrigley Field lands at p100 and Soldier Field misses at p0.",
  },
  {
    h: "Where fans live isn't what they like.",
    d: "Olive Garden's fans live in 9 of the 10 Los Angeles neighbourhoods where Gen Z Latin-pop fans over-index, yet it misses on taste. The map is a placement tool next to the verdicts, never a replacement for them.",
  },
];

const ENDPOINTS = [
  ["GET /search", "Resolve every reference, anchor and candidate, checked for a plausible name match"],
  ["GET /v2/insights · filter.results.entities", "Score references and their peer panel for the audience in one request"],
  ["GET /v2/insights · feature.explainability", "Swap candidates, and which anchors drove each one"],
  ["GET /v2/insights · urn:demographics", "Age skew that can downgrade a verdict"],
  ["GET /v2/insights · urn:heatmap", "Neighbourhood maps from Qloo's locality boundaries"],
  ["GET /v2/insights · location", "Places and brands for an audience in a city"],
  ["GET /v2/audiences", "Segments for audiences described in plain words"],
  ["GET /v2/tags", "Role-preserving swaps and interest tags"],
];

export default function HowPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-6 sm:px-6 lg:py-10">
      <SiteHeader />
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl italic tracking-tight text-balance sm:text-6xl">How Vernacular decides what lands</h1>
        <p className="max-w-2xl text-lg text-muted">
          The model writes; Qloo decides. Here&apos;s the pipeline behind every check, the method that makes scores mean something, and what building
          it taught us about culture and audiences.
        </p>
      </header>

      <section aria-label="Pipeline" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <div key={s.h} className="relative flex flex-col gap-2 rounded-xl border border-rule bg-sheet p-5">
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-mono text-xs text-sheet">{s.n}</span>
              <span className="font-serif text-xl italic">{s.h}</span>
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">{s.who}</span>
            <p className="text-sm text-muted">{s.d}</p>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-muted lg:block">
                →
              </span>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-rule bg-sheet p-6 sm:p-8">
        <h2 className="font-serif text-3xl italic">One show, five audiences</h2>
        <p className="max-w-2xl text-muted">
          A score only means something relative to an audience. Seinfeld beats every well-known show for 55+ classic-rock fans and only one in five
          for indie and A24 fans. Live Qloo scores, from the Culture Translator:
        </p>
        <div className="flex flex-col gap-3 pt-2">
          {SEINFELD.map((x) => (
            <div key={x.audience} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 sm:grid-cols-[14rem_1fr_3rem]">
              <span className="truncate text-sm">{x.audience}</span>
              <span className="relative h-2 rounded-full bg-desk">
                <span className="absolute inset-y-0 left-0 rounded-full bg-misses-soft" style={{ width: "35%" }} />
                <span className="absolute inset-y-0 right-0 rounded-full bg-lands-soft" style={{ width: "35%" }} />
                <span
                  className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sheet ${x.p >= 65 ? "bg-lands" : x.p < 35 ? "bg-misses" : "bg-mixed"}`}
                  style={{ left: `${x.p}%` }}
                />
              </span>
              <span className="text-right font-mono text-sm">p{x.p}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          Shaded: misses below p35, lands at p65 and above. <Link href="/translate" className="text-accent underline underline-offset-2">Translate your own reference →</Link>
        </p>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="font-serif text-3xl italic">What building it taught us</h2>
        <ol className="grid gap-3 md:grid-cols-2">
          {FINDINGS.map((f, i) => (
            <li key={f.h} className="flex gap-4 rounded-xl border border-rule bg-sheet p-5">
              <span className="font-mono text-sm text-accent">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{f.h}</span>
                <span className="text-sm text-muted">{f.d}</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="font-serif text-3xl italic">The Qloo calls behind it</h2>
          <div className="overflow-x-auto rounded-xl border border-rule bg-sheet" tabIndex={0} role="region" aria-label="Qloo endpoints">
            <table className="w-full min-w-[480px] text-sm">
              <tbody>
                {ENDPOINTS.map(([e, d]) => (
                  <tr key={e} className="border-b border-rule last:border-0 align-top">
                    <td className="whitespace-nowrap p-3 font-mono text-xs">{e}</td>
                    <td className="p-3 text-muted">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            One run of the landing sample: 30 Qloo calls and 9 Claude calls, first verdicts in about 7 seconds. Every call behind a result is listed under
            the check.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="font-serif text-3xl italic">Guardrails</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {[
              "A swap must come from Qloo in this run; the model can't invent one.",
              "It must verify as landing, or be mixed and at least 15 points above the original.",
              "The rewrite must name it and drop the original, or the tool rejects it.",
              "Each agent is capped at 16 turns and 40 Qloo calls.",
              "Factual references (credits, venues) are kept, never swapped.",
            ].map((g) => (
              <li key={g} className="flex gap-2 rounded-lg border border-rule bg-sheet p-3">
                <span className="text-lands" aria-hidden>
                  ✓
                </span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            Tested by a live suite of 16 adversarial cases (prompt injection, made-up names, Spanish copy, misspellings and more) and 63 unit tests.{" "}
            <Link href="/benchmark" className="text-accent underline underline-offset-2">
              See the benchmark →
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
