import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { SiteHeader } from "@/components/site-header";
import data from "@/lib/vernacular/benchmark/results.json";
import { summarize } from "@/lib/vernacular/benchmark/summarize";
import type { BenchmarkRun } from "@/lib/vernacular/benchmark/types";

export const metadata: Metadata = {
  title: "Why Vernacular",
  description: "The pre-flight check for culture in every piece of copy: the problem, the product, the moat and the business.",
};

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
const signed = (x: number) => (x > 0 ? `+${x}` : `${x}`);

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-rule pt-10 lg:grid-cols-[14rem_1fr] lg:gap-10">
      <span className="text-xs font-semibold uppercase tracking-wider text-accent">{eyebrow}</span>
      <div className="flex min-w-0 flex-col gap-4">
        <h2 className="font-serif text-3xl italic leading-tight text-balance sm:text-4xl">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export default function PitchPage() {
  const run = data as BenchmarkRun;
  const s = summarize(run.pairs, run.audiences);
  const o = s.arms.original;
  const c = s.arms.claude;
  const v = s.arms.vernacular;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-6 sm:px-6 lg:py-10">
      <SiteHeader />

      <header className="hero-glow relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-rule bg-sheet px-6 py-10 sm:px-12 sm:py-14">
        <LogoMark size={56} className="relative" />
        <h1 className="relative max-w-3xl font-serif text-4xl italic leading-[1.05] tracking-tight text-balance sm:text-6xl">
          Every brand talks to a dozen audiences. Its references only work on one.
        </h1>
        <p className="relative max-w-2xl text-lg text-muted">
          Vernacular is the pre-flight check for culture: it catches the shows, artists, brands and places in your copy that your audience won&apos;t
          get, and swaps them for ones they love, verified on Qloo&apos;s taste graph. Grammarly made everyone&apos;s writing correct. Vernacular makes
          it land.
        </p>
      </header>

      <Section eyebrow="The problem" title="Writers reach for their own culture, not their audience's.">
        <p className="max-w-2xl text-muted">
          A 45-year-old copywriter says &ldquo;like a Friday at Olive Garden&rdquo;. A 24-year-old reads it and scrolls on. Translation tools fix language,
          not culture, and generic AI copy makes it worse: models reach for the most famous reference, not the one this audience loves.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { k: pct(o.missRate), t: "of references in ordinary ad copy missed the audience it was sent to", tone: "text-misses" },
            { k: pct(c.missRate), t: "still missed after Claude rewrote it alone, with the same brief", tone: "text-mixed" },
            { k: String(c.echoes), t: "times Claude alone just repeated the audience's own examples back", tone: "text-mixed" },
          ].map((x) => (
            <div key={x.t} className="flex flex-col gap-1 rounded-xl border border-rule bg-sheet p-5">
              <span className={`font-mono text-4xl ${x.tone}`}>{x.k}</span>
              <span className="text-sm text-muted">{x.t}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          From our public benchmark: {run.copy.length} pieces of copy × {run.audiences.length} audiences, every version graded the same way on Qloo.{" "}
          <Link href="/benchmark" className="text-accent underline underline-offset-2">
            Method and every pair →
          </Link>
        </p>
      </Section>

      <Section eyebrow="Who it's for" title="Four people who hit this problem every week.">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              who: "Agency strategist",
              pain: "A campaign ships in several creative routes to audiences that share almost nothing. Deciding which route runs where, and re-briefing writers per audience, takes days.",
              flow: "Campaign check scores every version for every audience in one grid; any weak cell opens the full check, where the agent localises it; share cards go to the client.",
              proof: "Four cold-brew routes × five audiences, in one grid",
              href: "/campaign",
            },
            {
              who: "Social media manager",
              pain: "Writes captions daily under time pressure; one dated reference and the comments turn on the brand.",
              flow: "The extension checks the caption in the composer, a one-click swap fixes it, and predicted comments preview the reaction.",
              proof: "A TikTok skincare caption repurposed for 45–54 country fans",
              href: "/#scenario=tiktok",
            },
            {
              who: "Out-of-home planner",
              pain: "A billboard's references have to land with whoever drives past it, in that city.",
              flow: "Local places are ranked among the city's well-known places, and the map shows which neighbourhoods the audience and each reference reach.",
              proof: "A Chicago sports-bar billboard for 30–34 hip-hop fans",
              href: "/#scenario=billboard",
            },
            {
              who: "Teams shipping AI-written copy",
              pain: "Agents draft and publish copy at volume, and nothing checks whether it speaks to the audience.",
              flow: "The MCP server lets any agent call check_copy before it publishes; the benchmark shows what that adds over the model alone.",
              proof: "Vernacular vs Claude alone, 40 pairs",
              href: "/benchmark",
            },
          ].map((p) => (
            <div key={p.who} className="flex flex-col gap-3 rounded-xl border border-rule bg-sheet p-5">
              <span className="font-serif text-xl italic">{p.who}</span>
              <p className="text-sm">
                <span className="font-medium">The problem: </span>
                <span className="text-muted">{p.pain}</span>
              </p>
              <p className="text-sm">
                <span className="font-medium">With Vernacular: </span>
                <span className="text-muted">{p.flow}</span>
              </p>
              <Link href={p.href} className="mt-auto inline-flex items-center gap-1 self-start rounded-full border border-rule px-3 py-1 text-xs hover:border-accent">
                See it live: {p.proof} →
              </Link>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="The product" title="One taste engine, everywhere copy gets written.">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { h: "Check", d: "Paste copy, a storyboard or a video ad. Every reference scored for the exact audience, weak ones swapped, the copy kept in its own voice.", href: "/" },
            { h: "Campaign", d: "Every version of an ad against every audience in one grid: which version runs where, and which references to fix first.", href: "/campaign" },
            { h: "Anywhere", d: "A browser extension that checks the culture in any text box: social, email, docs, chat. One click to swap.", href: "/anywhere" },
            { h: "Translator", d: "One reference, five audiences: what Seinfeld means to Gen Z, to country fans, to hip-hop heads.", href: "/translate" },
            { h: "API for agents", d: "An MCP server so AI agents check their own copy, and pick between their own variants, before they publish. Six tools, open to any MCP client.", href: "https://github.com/TusharTechs/vernacular#use-it-from-an-agent-mcp" },
          ].map((x) => (
            <Link key={x.h} href={x.href} className="flex flex-col gap-1 rounded-xl border border-rule bg-sheet p-5 transition-colors hover:border-accent">
              <span className="font-serif text-xl italic">{x.h}</span>
              <span className="text-sm text-muted">{x.d}</span>
            </Link>
          ))}
        </div>
        <p className="max-w-2xl text-muted">
          Around the check: hear the copy read aloud while a live reaction curve tracks each reference (the Dial Test), predict the comment section before
          posting, and see on a map which neighbourhoods a reference reaches for out-of-home campaigns.
        </p>
      </Section>

      <Section eyebrow="Why it works" title="The model writes. Qloo decides what lands.">
        <p className="max-w-2xl text-muted">
          A language model can rewrite a sentence, but it can&apos;t know what a specific audience actually loves. Qloo can: cross-domain taste affinity
          for music, film, TV, brands and places, by demographic, by interest and down to the neighbourhood. Vernacular puts every suggestion through
          that test, and shows its evidence.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-xl border border-accent bg-sheet p-5">
            <span className="font-mono text-4xl text-lands">p{v.meanPercentile === null ? "–" : Math.round(v.meanPercentile)}</span>
            <span className="text-sm text-muted">average audience fit after Vernacular, against p{c.meanPercentile === null ? "–" : Math.round(c.meanPercentile)} for Claude alone</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-rule bg-sheet p-5">
            <span className="font-mono text-4xl text-lands">{pct(v.missRate)}</span>
            <span className="text-sm text-muted">of references still miss after Vernacular, down from {pct(o.missRate)} in the original copy</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-rule bg-sheet p-5">
            <span className="font-mono text-4xl text-lands">{s.paired.wins}/{s.paired.n}</span>
            <span className="text-sm text-muted">
              pairs where Vernacular beat Claude alone
              {s.paired.meanDiff !== null && `, by ${signed(s.paired.meanDiff)} points on average`}
              {s.paired.ci && ` (95% interval ${signed(s.paired.ci[0])} to ${signed(s.paired.ci[1])})`}
            </span>
          </div>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          Meaning is kept about as well as Claude alone keeps it (blind judge: {s.fidelity.vernacular.meaning ?? "–"}/5 against {s.fidelity.claude.meaning ?? "–"}/5).
          The moat compounds: every accepted or rejected swap is a labelled example of what works for whom, which no general model sees.
        </p>
      </Section>

      <Section eyebrow="Why now" title="AI is writing the copy. Nobody is checking the culture.">
        <p className="max-w-2xl text-muted">
          Brands now publish more copy than ever, much of it drafted by models and soon published by agents. More output means more generic references
          and more audiences talked past. A taste check belongs in that pipeline the way spellcheck belongs in a word processor, and agents need it as a
          tool they can call.
        </p>
      </Section>

      <Section eyebrow="Business" title="Free in the browser, paid where the work happens.">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Proposed plans">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 font-normal">Plan (proposed)</th>
                <th className="py-2 font-normal">For</th>
                <th className="py-2 font-normal">What it unlocks</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Free", "Anyone writing", "The extension's lint and a few full checks a month"],
                ["Pro", "Creators and marketers", "Unlimited checks, saved audiences, Dial Test, predicted comments"],
                ["Team", "Agencies and brand teams", "Shared brand audiences, approval flow, Tour Mode across markets"],
                ["API", "Agent and martech platforms", "Usage-based MCP and REST access to check, translate and map"],
              ].map(([plan, who, what]) => (
                <tr key={plan} className="border-t border-rule align-top">
                  <td className="py-3 pr-4 font-serif text-lg italic">{plan}</td>
                  <td className="py-3 pr-4 text-muted">{who}</td>
                  <td className="py-3">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-2xl text-muted">
          The wedge is the free extension: it lives in every text box, so the product is discovered where the problem happens. Teams pay for shared
          audiences and approvals; platforms pay per check.
        </p>
      </Section>

      <Section eyebrow="Next" title="Where it goes from here.">
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            ["Your audiences, not presets", "Build audiences from a brand's own customer segments and Qloo's audience data."],
            ["Every format", "Scripts, storyboards and video ads already work; next are slide decks, product pages and app-store listings at scale."],
            ["Where teams write", "Google Docs, Figma, Notion and CMS integrations alongside the extension."],
            ["More languages", "Spanish copy already works; the taste graph is global, so the same check extends to every market."],
          ].map(([h, d]) => (
            <li key={h} className="flex flex-col gap-1 rounded-xl border border-rule bg-sheet p-5">
              <span className="font-medium">{h}</span>
              <span className="text-sm text-muted">{d}</span>
            </li>
          ))}
        </ul>
      </Section>

      <section className="flex flex-col items-start gap-4 rounded-2xl border border-rule bg-ink p-8 text-sheet sm:p-12">
        <h2 className="max-w-2xl font-serif text-3xl italic leading-tight sm:text-4xl">Try it on your own copy. It takes a minute.</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/" className="rounded-full bg-sheet px-5 py-2.5 text-sm font-medium text-ink hover:opacity-90">
            Check your copy
          </Link>
          <Link href="/translate" className="rounded-full border border-sheet/40 px-5 py-2.5 text-sm hover:border-sheet">
            Translate a reference
          </Link>
          <Link href="/benchmark" className="rounded-full border border-sheet/40 px-5 py-2.5 text-sm hover:border-sheet">
            See the benchmark
          </Link>
        </div>
      </section>
    </main>
  );
}
