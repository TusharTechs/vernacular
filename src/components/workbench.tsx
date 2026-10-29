"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_TEXT_CHARS } from "@/lib/vernacular/limits";
import { AUDIENCE_PRESETS, SAMPLE_COPY } from "@/lib/vernacular/presets";
import { applyChange } from "@/lib/vernacular/diff";
import type { AudienceSpec, CheckResult, Verdict } from "@/lib/vernacular/types";
import { AGE_LABEL, AudienceBuilder } from "./audience-builder";
import { ComparePanel } from "./compare-panel";
import { CultureMap } from "./culture-map";
import { DialTest, type Take } from "./dial-test";
import { verdictOfPercentile } from "@/lib/vernacular/dial";
import { FeedPreview } from "./feed-preview";
import { Filmstrip } from "./filmstrip";
import { MediaInput, type StoryboardRead } from "./media-input";
import { HighlightedNames, locate, MarkedCopy } from "./copy-view";
import { ReferenceCard } from "./reference-card";
import { GuidedTour, type TourStep } from "./guided-tour";
import { Hero } from "./hero";
import { useHistory, YourChecks } from "./history";
import { ScenarioGallery } from "./scenario-gallery";
import { SectionBar } from "./section-bar";
import { SiteHeader } from "./site-header";
import { SCENARIOS, type Scenario } from "@/lib/vernacular/scenarios";
import { ShareButton } from "./share-dialog";
import { SwipeReview } from "./swipe-review";
import { TourView } from "./tour-view";
import { TraceDrawer } from "./trace-drawer";
import { traceOf, useCheck, type Phase } from "./use-check";

const PHASE_TEXT: Record<Phase, string> = {
  idle: "",
  reading: "Reading the copy and resolving the audience on Qloo…",
  scoring: "Scoring each reference for this audience on Qloo…",
  swapping: "Finding verified replacements for the weak references…",
  done: "",
  error: "",
};

export function Workbench({ stats }: { stats: { lift: number | null; missRate: number | null } }) {
  const [text, setText] = useState(SAMPLE_COPY[0].text);
  const [audience, setAudience] = useState<AudienceSpec>(structuredClone(AUDIENCE_PRESETS[0].spec));
  const [editing, setEditing] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"editor" | "tour">("editor");
  const [input, setInput] = useState<"copy" | "media">("copy");
  const [board, setBoard] = useState<StoryboardRead | null>(null);
  const { state, run, reset, load } = useCheck();
  const [sampleAt, setSampleAt] = useState<string | null>(null);
  const [scenario, setScenario] = useState<string | null>("tour");
  const [opening, setOpening] = useState<string | null>(null);
  const [touring, setTouring] = useState(false);
  const yourChecks = useHistory();
  const liveCheck = useRef(false); // true only for checks the visitor ran themselves
  const [tourInvite, setTourInvite] = useState(false);
  const touched = useRef(false);

  // Deep link from the extension: #check={"text":…,"audience":presetId} opens and runs a check.
  // It's a fragment, so the copy never reaches a server log.
  useEffect(() => {
    // #scenario=<id> opens a gallery scenario (linked from the pitch page).
    const sc = /^#scenario=([a-z-]+)$/.exec(window.location.hash);
    const found = sc && SCENARIOS.find((x) => x.id === sc[1]);
    if (found) {
      history.replaceState(null, "", window.location.pathname);
      openScenario(found);
      return;
    }
    const m = /^#check=(.+)$/.exec(window.location.hash);
    if (!m) return;
    try {
      const { text: t, audience: a } = JSON.parse(decodeURIComponent(m[1])) as { text?: string; audience?: string };
      const preset = AUDIENCE_PRESETS.find((p) => p.id === a)?.spec ?? AUDIENCE_PRESETS[0].spec;
      if (!t?.trim()) return;
      touched.current = true;
      history.replaceState(null, "", window.location.pathname);
      setText(t.slice(0, MAX_TEXT_CHARS));
      setAudience(structuredClone(preset));
      check(structuredClone(preset), t.slice(0, MAX_TEXT_CHARS));
    } catch {
      // ignore a malformed link
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open on a real, server-cached check of the sample so the first view shows results.
  useEffect(() => {
    let alive = true;
    fetch("/api/sample")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { checkedAt: string; result: CheckResult } | null) => {
        if (!alive || !d || touched.current) return;
        load(d.result);
        setText(d.result.input.text);
        setAudience(structuredClone(d.result.input.audience));
        setEditing(false);
        setSampleAt(d.checkedAt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [load]);

  // Save checks the visitor ran themselves to "Your checks" (this browser only).
  useEffect(() => {
    if (state.phase === "done" && state.result && liveCheck.current) {
      liveCheck.current = false;
      yourChecks.add(state.result);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.result]);

  // Invite first-time visitors to the tour once the sample's results are on screen.
  useEffect(() => {
    if (state.phase !== "done" || !sampleAt) return;
    try {
      if (!localStorage.getItem("vernacular-tour-seen")) setTourInvite(true);
    } catch {
      // storage unavailable: skip the invite
    }
  }, [state.phase, sampleAt]);
  const startTour = () => {
    setTourInvite(false);
    setMode("editor");
    try {
      localStorage.setItem("vernacular-tour-seen", "1");
    } catch {
      // ignore
    }
    setTouring(true);
  };
  const TOUR: TourStep[] = [
    { target: 'section[aria-label="Real-world scenarios"]', title: "Real copy, real audiences", body: "Each card is a real check of a real format (ads, emails, captions, a Spanish promo) sent to an audience it wasn't written for, saved so it opens instantly. Re-run any of them live." },
    { target: "#sec-copy", title: "Proof marks for culture", body: "Every named reference gets a wavy underline: green lands, amber is mixed, red misses. Scores are Qloo percentiles for this exact audience." },
    { target: 'aside[aria-label="Audience and references"] [data-tour="swap"]', title: "Why this swap", body: "Each card shows the Qloo evidence (score, age skew) and a verified swap, with the Qloo tags that show it plays the same role as the original." },
    { target: '[data-tour="dial-play"]', title: "Hear it land", body: "Press play: an AI voice reads the copy while the audience's reaction curve dips on misses and spikes on swaps." },
    { target: '[data-tour="comments"]', title: "See the comments before you post", body: "Preview the post in a feed, then predict the comments: simulated commenters built from Qloo, reacting in line with each score." },
    { target: '[data-tour="map"]', title: "Where it lands", body: "Qloo's neighbourhood heatmaps show where your audience lives in a city, and whether each reference's fans live there too." },
    { target: 'nav[aria-label="Main"] a[href="/translate"]', title: "Translate any reference", body: "Type a reference and see what it means to five audiences at once. Also try the browser extension and the benchmark." },
  ];

  const busy = state.phase === "reading" || state.phase === "scoring" || state.phase === "swapping";
  const located = useMemo(() => locate(state.text, state.extracted), [state.text, state.extracted]);
  const verdicts = useMemo(() => {
    const v: Record<string, Verdict | "pending"> = {};
    for (const r of state.extracted) v[r.id] = state.scored[r.id]?.verdict ?? "pending";
    return v;
  }, [state.extracted, state.scored]);
  const swapsInOrder = useMemo(() => Object.values(state.swaps), [state.swaps]);
  const accepted = swapsInOrder.filter((s) => decisions[s.referenceId]);
  const rewritten = accepted.reduce((t, s) => applyChange(t, s.change), state.text);
  const trace = traceOf(state);
  // Dial Test takes: the original and the copy with every suggested swap.
  const takes = useMemo<Take[]>(() => {
    if (state.phase !== "done" || !located.length) return [];
    const original: Take = {
      key: "original",
      label: "Original",
      text: state.text,
      refs: located.map((r) => ({ start: r.start, end: r.end, name: state.scored[r.id]?.entity?.name ?? r.span, percentile: state.scored[r.id]?.percentile ?? null, verdict: state.scored[r.id]?.verdict ?? "unmeasured" })),
    };
    if (!swapsInOrder.length) return [original];
    const text = swapsInOrder.reduce((t, sw) => applyChange(t, sw.change), state.text);
    const refs: Take["refs"] = [];
    let cursor = 0;
    for (const r of located) {
      const sw = swapsInOrder.find((s) => s.referenceId === r.id);
      const name = sw ? sw.replacement.name : r.span;
      const candidates = sw ? [name, name.split(" ").slice(0, 2).join(" ")] : [r.span];
      let at = -1;
      let len = 0;
      for (const c of candidates) {
        at = text.indexOf(c, cursor);
        if (at >= 0) {
          len = c.length;
          break;
        }
      }
      if (at < 0) continue;
      const scored = state.scored[r.id];
      const percentile = sw ? sw.replacement.percentile : (scored?.percentile ?? null);
      refs.push({ start: at, end: at + len, name: sw ? sw.replacement.name : (scored?.entity?.name ?? r.span), percentile, verdict: sw ? verdictOfPercentile(percentile) : (scored?.verdict ?? "unmeasured") });
      cursor = at + len;
    }
    return [original, { key: "swaps", label: "With swaps", text, refs }];
  }, [state.phase, state.text, state.scored, located, swapsInOrder]);
  const counts = Object.values(state.scored).reduce<Record<string, number>>((c, r) => ({ ...c, [r.verdict]: (c[r.verdict] ?? 0) + 1 }), {});

  const selectFromCopy = (id: string) => {
    setSelected(id);
    const card = document.getElementById(`note-${id}`);
    if (card) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
      card.focus({ preventScroll: true });
    }
  };

  // Open a gallery scenario from its server-cached check; fall back to a live check.
  const openScenario = async (sc: Scenario) => {
    touched.current = true;
    liveCheck.current = false;
    setScenario(sc.id);
    setOpening(sc.id);
    setText(sc.text);
    setAudience(structuredClone(sc.audience));
    setBoard(null);
    setInput("copy");
    setSelected(null);
    setDecisions({});
    try {
      const res = await fetch(`/api/scenario/${sc.id}`);
      if (!res.ok) throw new Error();
      const d: { checkedAt: string; result: CheckResult } = await res.json();
      load(d.result);
      setEditing(false);
      setSampleAt(d.checkedAt);
    } catch {
      check(sc.audience, sc.text);
    } finally {
      setOpening(null);
    }
  };

  const check = (forAudience: AudienceSpec = audience, forText: string = text) => {
    touched.current = true;
    liveCheck.current = true;
    setSampleAt(null);
    const spec: AudienceSpec = { ...forAudience, anchors: forAudience.anchors.filter((a) => a.query.trim()) };
    setEditing(false);
    setSelected(null);
    setDecisions({});
    setCopied(false);
    run({ text: forText, audience: spec });
  };
  const edit = () => {
    touched.current = true;
    setScenario(null);
    setSampleAt(null);
    reset();
    setEditing(true);
  };
  const copyRewritten = async () => {
    try {
      await navigator.clipboard.writeText(rewritten);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
      <GuidedTour steps={TOUR} open={touring} onClose={() => setTouring(false)} />
      {tourInvite && !touring && (
        <div role="status" className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-32px)] items-center gap-3 rounded-full border border-rule bg-sheet py-2 pl-4 pr-2 text-sm shadow-lg">
          <span>New here? See the best parts in 60 seconds.</span>
          <button type="button" onClick={startTour} className="rounded-full bg-ink px-3 py-1.5 text-sheet">
            Start tour
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setTourInvite(false);
              try {
                localStorage.setItem("vernacular-tour-seen", "1");
              } catch {
                // ignore
              }
            }}
            className="px-2 text-muted hover:text-ink"
          >
            ×
          </button>
        </div>
      )}
      <SiteHeader />
      <Hero lift={stats.lift} missRate={stats.missRate} onTour={state.phase === "done" ? startTour : undefined} />

      <section aria-label="Mode" className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full border border-rule bg-sheet p-1 text-sm" role="tablist" aria-label="Mode">
          {(["editor", "tour"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 transition-colors ${mode === m ? "bg-ink text-sheet" : "text-muted hover:text-ink"}`}
            >
              {m === "editor" ? "Check one audience" : "Tour Mode · compare five"}
            </button>
          ))}
        </div>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-lands" /> Lands</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-mixed" /> Mixed</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-misses" /> Misses</span>
        </div>
      </section>

      {mode === "tour" && (
        <TourView
          text={text}
          onOpen={(spec) => {
            const copy = structuredClone(spec);
            setAudience(copy);
            setMode("editor");
            check(copy);
          }}
        />
      )}

      {mode === "editor" && <ScenarioGallery active={scenario} loading={opening} onOpen={openScenario} />}
      {mode === "editor" && (
        <YourChecks
          items={yourChecks.items}
          onClear={yourChecks.clear}
          onOpen={(h) => {
            touched.current = true;
            liveCheck.current = false;
            load(h.result);
            setText(h.result.input.text);
            setAudience(structuredClone(h.result.input.audience));
            setBoard(null);
            setEditing(false);
            setSelected(null);
            setDecisions({});
            setScenario(null);
            setSampleAt(null);
          }}
        />
      )}

      <div className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] ${mode === "tour" ? "hidden" : ""}`}>
        <main className="flex min-w-0 flex-col gap-4">
          {state.phase === "done" && (
            <SectionBar
              sections={[
                { id: "sec-copy", label: "Copy" },
                ...(swapsInOrder.length ? [{ id: "sec-rewrite", label: "Rewrite" }] : []),
                ...(takes.length ? [{ id: "sec-dial", label: "▶ Hear it" }] : []),
                ...(state.extracted.length ? [{ id: "sec-feed", label: "In the feed" }] : []),
                ...(Object.values(state.scored).some((r) => r.entity) ? [{ id: "sec-map", label: "Map" }] : []),
                ...(swapsInOrder.length ? [{ id: "sec-compare", label: "vs Claude alone" }] : []),
              ]}
            />
          )}
          {sampleAt && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
              <span>
                Example: a saved check, run on Qloo on{" "}
                {new Date(sampleAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. Click a marked reference to see why.
              </span>
              <span className="flex flex-wrap gap-4">
                <button type="button" onClick={() => check(audience, text)} className="font-medium text-accent hover:underline">
                  Re-run it live
                </button>
                <button type="button" onClick={edit} className="font-medium text-accent hover:underline">
                  Try your own copy
                </button>
              </span>
            </div>
          )}

          <section id="sec-copy" className="scroll-mt-16 rounded-xl border border-rule bg-sheet p-6 shadow-sm sm:p-8" aria-label="Copy">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted">
                {editing ? "Your copy" : `${board && board.text === state.text ? "Shot notes checked" : "Checked"} for ${audience.label}`}
              </span>
              {editing && (
                <div className="flex rounded-md border border-rule p-0.5 text-xs" role="tablist" aria-label="Input type">
                  {(["copy", "media"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="tab"
                      aria-selected={input === m}
                      onClick={() => setInput(m)}
                      className={`rounded px-2.5 py-1 ${input === m ? "bg-ink text-sheet" : "text-muted hover:text-ink"}`}
                    >
                      {m === "copy" ? "Copy" : "Storyboard or video"}
                    </button>
                  ))}
                </div>
              )}
              {editing && input === "copy" ? (
                <div className="flex w-full flex-wrap gap-2">
                  {SAMPLE_COPY.map((s) => (
                    <button key={s.id} type="button" onClick={() => { setText(s.text); setBoard(null); }} className="rounded-full border border-rule px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink">
                      Sample: {s.label}
                    </button>
                  ))}
                </div>
              ) : !editing ? (
                <button type="button" onClick={edit} className="text-sm text-accent hover:underline">
                  {board && board.text === state.text ? "Change frames" : "Edit copy"}
                </button>
              ) : null}
            </div>

            {editing && input === "media" ? (
              <MediaInput
                disabled={busy}
                onRead={(r) => {
                  touched.current = true;
                  setBoard(r);
                  setText(r.text);
                  check(audience, r.text);
                }}
              />
            ) : editing ? (
              <textarea
                id="copy-input"
                value={text}
                onChange={(e) => {
                  touched.current = true;
                  setText(e.target.value);
                }}
                maxLength={MAX_TEXT_CHARS}
                rows={7}
                placeholder="Paste an ad script, caption, tour announcement or stand-up bit…"
                className="w-full resize-y bg-transparent font-serif text-[21px] leading-[1.75] outline-none placeholder:text-muted/60"
              />
            ) : (
              <div className="flex flex-col gap-5">
                {board && board.text === state.text && (
                  <Filmstrip text={state.text} frames={board.frames} shots={board.shots} refs={located} verdicts={verdicts} selectedId={selected} onSelect={selectFromCopy} />
                )}
                <MarkedCopy
                  text={state.text}
                  refs={located}
                  verdicts={verdicts}
                  selectedId={selected}
                  onSelect={selectFromCopy}
                  compact={!!board && board.text === state.text}
                />
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
              <span className="font-mono text-xs text-muted">
                {editing ? (input === "copy" ? `${text.length.toLocaleString()} / ${MAX_TEXT_CHARS.toLocaleString()}` : "") : PHASE_TEXT[state.phase] || summaryLine(counts, state.phase)}
              </span>
              {editing && input === "copy" && (
                <button
                  type="button"
                  onClick={() => check()}
                  disabled={!text.trim() || (!audience.anchors.some((a) => a.query.trim()) && !audience.age && !audience.segments?.length && !audience.tags?.length)}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-sheet shadow-sm hover:opacity-90 disabled:opacity-40"
                >
                  Check copy
                </button>
              )}
              {!editing && busy && <span className="h-1.5 w-32 overflow-hidden rounded-full bg-desk"><span className="block h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-accent" /></span>}
            </div>
          </section>

          {state.phase === "error" && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-misses/40 bg-misses-soft px-4 py-3 text-sm">
              <span>{state.error}</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => check()} className="rounded-md border border-misses/40 px-3 py-1 hover:bg-sheet">
                  Try again
                </button>
                <button
                  type="button"
                  onClick={() => openScenario(SCENARIOS.find((sc) => sc.audience.label === audience.label) ?? SCENARIOS[0])}
                  className="rounded-md border border-misses/40 px-3 py-1 hover:bg-sheet"
                >
                  Open a ready-made example
                </button>
              </span>
            </div>
          )}

          {state.phase === "done" && state.extracted.length === 0 && (
            <p className="rounded-lg border border-rule bg-sheet px-4 py-3 text-sm text-muted">
              No named cultural references found. Vernacular checks specific artists, shows, films, books, podcasts, games, brands and places.
            </p>
          )}

          {swapsInOrder.length > 0 && (
            <section id="sec-rewrite" className="flex scroll-mt-16 flex-col gap-3 rounded-xl border border-rule bg-sheet p-6" aria-label="Rewritten copy">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-muted">
                  Rewritten · {accepted.length} of {swapsInOrder.length} swaps accepted
                </span>
                <div className="flex gap-2">
                  {accepted.length < swapsInOrder.length && (
                    <button type="button" onClick={() => setDecisions(Object.fromEntries(swapsInOrder.map((s) => [s.referenceId, true])))} className="rounded-md border border-rule px-3 py-1 text-sm hover:border-ink">
                      Accept all
                    </button>
                  )}
                  <SwipeReview swaps={swapsInOrder} references={state.scored} onDecide={(id, accept) => setDecisions((d) => ({ ...d, [id]: accept }))} />
                  {state.result && <ShareButton result={state.result} />}
                  <button type="button" onClick={copyRewritten} className="rounded-md bg-ink px-3 py-1 text-sm text-sheet hover:opacity-90">
                    {copied ? "Copied" : "Copy text"}
                  </button>
                </div>
              </div>
              <p className="whitespace-pre-wrap font-serif text-[19px] leading-[1.7]">
                <HighlightedNames text={rewritten} names={accepted.map((s) => s.replacement.name)} />
              </p>
            </section>
          )}

          {takes.length > 0 && (
            <div id="sec-dial" className="scroll-mt-16">
              <DialTest key={takes.map((t) => t.text).join("|")} takes={takes} audience={audience.label} />
            </div>
          )}

          {state.phase === "done" && state.extracted.length > 0 && (
            <div id="sec-feed" className="scroll-mt-16">
            <FeedPreview
              original={state.text}
              rewritten={swapsInOrder.reduce((t, sw) => applyChange(t, sw.change), state.text)}
              refs={located}
              verdicts={verdicts}
              swapNames={swapsInOrder.map((s) => s.replacement.name)}
              media={board && board.text === state.text ? board.frames[0]?.src : undefined}
              audience={audience.label}
              comments={
                takes.length
                  ? {
                      audience: state.result?.input.audience ?? audience,
                      original: { text: takes[0].text, refs: takes[0].refs.map(({ name, percentile, verdict }) => ({ name, percentile, verdict })) },
                      swaps: {
                        text: (takes[1] ?? takes[0]).text,
                        refs: (takes[1] ?? takes[0]).refs.map(({ name, percentile, verdict }) => ({ name, percentile, verdict })),
                      },
                    }
                  : undefined
              }
            />
            </div>
          )}

          {state.phase === "done" && Object.values(state.scored).some((r) => r.entity) && (
            <div id="sec-map" className="scroll-mt-16">
              <CultureMap audience={state.result?.input.audience ?? audience} references={Object.values(state.scored)} swaps={swapsInOrder} />
            </div>
          )}

          {state.phase === "done" && swapsInOrder.length > 0 && (
            <div id="sec-compare" className="scroll-mt-16">
              <ComparePanel text={state.text} audience={audience} references={state.extracted} scored={state.scored} swaps={state.swaps} />
            </div>
          )}

          <TraceDrawer calls={trace} />
        </main>

        <aside className="flex min-w-0 flex-col gap-4" aria-label="Audience and references">
          <section className="rounded-xl border border-rule bg-sheet p-5">
            <h2 className="mb-4 text-sm font-semibold">Who is this for?</h2>
            {editing ? (
              <AudienceBuilder
                value={audience}
                onChange={(a) => {
                  touched.current = true;
                  setAudience(a);
                }}
                disabled={busy}
              />
            ) : (
              <div className="flex flex-col gap-2 text-sm">
                <p className="font-serif text-lg">{audience.label}</p>
                <p className="text-muted">
                  {state.anchors.length ? `Loves ${state.anchors.map((a) => a.name).join(", ")}` : "Resolving taste anchors…"}
                  {audience.tags?.length ? ` · into ${audience.tags.map((t) => t.name).join(", ")}` : ""}
                  {audience.segments?.length ? ` · ${audience.segments.map((s) => s.name).join(", ")}` : ""}
                  {audience.age ? ` · ${AGE_LABEL[audience.age]}` : ""}
                  {audience.location ? ` · ${audience.location}` : ""}
                </p>
              </div>
            )}
          </section>

          {!editing &&
            (state.extracted.length ? state.extracted : []).map((r) => (
              <ReferenceCard
                key={r.id}
                id={`note-${r.id}`}
                span={r.span}
                reference={state.scored[r.id]}
                swap={state.swaps[r.id]}
                kept={state.kept[r.id]}
                working={busy}
                focusAge={audience.age}
                selected={selected === r.id}
                accepted={decisions[r.id]}
                onSelect={() => setSelected(r.id)}
                onAccept={() => setDecisions((d) => ({ ...d, [r.id]: true }))}
                onDismiss={() => setDecisions((d) => ({ ...d, [r.id]: false }))}
              />
            ))}

          {!editing && state.phase === "reading" && (
            <div className="flex flex-col gap-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg border border-rule bg-sheet" />
              ))}
            </div>
          )}

          {!editing && state.steps.length > 0 && (
            <section className="rounded-lg border border-rule bg-sheet p-4" aria-label="Agent activity">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">Agent activity</h2>
              <ol className="flex flex-col gap-1 font-mono text-xs text-muted">
                {state.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function summaryLine(counts: Record<string, number>, phase: Phase) {
  if (phase !== "done") return "";
  const parts = [
    counts.lands && `${counts.lands} land`,
    counts.mixed && `${counts.mixed} mixed`,
    counts.misses && `${counts.misses} miss`,
    counts.unmeasured && `${counts.unmeasured} not measured`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Done";
}
