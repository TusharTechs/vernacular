"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_TEXT_CHARS } from "@/lib/vernacular/limits";
import { AUDIENCE_PRESETS, SAMPLE_COPY } from "@/lib/vernacular/presets";
import { applyChange } from "@/lib/vernacular/diff";
import type { AudienceSpec, CheckResult, Verdict } from "@/lib/vernacular/types";
import { AGE_LABEL, AudienceBuilder } from "./audience-builder";
import { ComparePanel } from "./compare-panel";
import { HighlightedNames, locate, MarkedCopy } from "./copy-view";
import { ReferenceCard } from "./reference-card";
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

export function Workbench() {
  const [text, setText] = useState(SAMPLE_COPY[0].text);
  const [audience, setAudience] = useState<AudienceSpec>(structuredClone(AUDIENCE_PRESETS[0].spec));
  const [editing, setEditing] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"editor" | "tour">("editor");
  const { state, run, reset, load } = useCheck();
  const [sampleAt, setSampleAt] = useState<string | null>(null);
  const touched = useRef(false);

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

  const check = (forAudience: AudienceSpec = audience) => {
    touched.current = true;
    setSampleAt(null);
    const spec: AudienceSpec = { ...forAudience, anchors: forAudience.anchors.filter((a) => a.query.trim()) };
    setEditing(false);
    setSelected(null);
    setDecisions({});
    setCopied(false);
    run({ text, audience: spec });
  };
  const edit = () => {
    touched.current = true;
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-4xl italic tracking-tight sm:text-5xl">Vernacular</h1>
          <p className="max-w-xl text-muted">
            The spell-checker for culture. Every reference in your copy, scored for the audience you&apos;re writing for on Qloo&apos;s taste graph, and the ones that miss swapped for verified equivalents.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
        <div className="flex rounded-lg border border-rule bg-sheet p-1 text-sm" role="tablist" aria-label="Mode">
          {(["editor", "tour"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 transition-colors ${mode === m ? "bg-ink text-sheet" : "text-muted hover:text-ink"}`}
            >
              {m === "editor" ? "Editor" : "Tour Mode"}
            </button>
          ))}
        </div>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-lands" /> Lands</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-mixed" /> Mixed</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-misses" /> Misses</span>
        </div>
        </div>
      </header>

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

      <div className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] ${mode === "tour" ? "hidden" : ""}`}>
        <main className="flex min-w-0 flex-col gap-4">
          {sampleAt && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
              <span>
                Example: this sample was checked live on Qloo{" "}
                {new Date(sampleAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. Click a marked reference to see why.
              </span>
              <button type="button" onClick={edit} className="font-medium text-accent hover:underline">
                Try your own copy
              </button>
            </div>
          )}

          <section className="rounded-xl border border-rule bg-sheet p-6 shadow-sm sm:p-8" aria-label="Copy">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted">
                {editing ? "Your copy" : `Checked for ${audience.label}`}
              </span>
              {editing ? (
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_COPY.map((s) => (
                    <button key={s.id} type="button" onClick={() => setText(s.text)} className="rounded-full border border-rule px-3 py-1 text-xs text-muted hover:border-accent hover:text-ink">
                      Sample: {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <button type="button" onClick={edit} className="text-sm text-accent hover:underline">
                  Edit copy
                </button>
              )}
            </div>

            {editing ? (
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
              <MarkedCopy text={state.text} refs={located} verdicts={verdicts} selectedId={selected} onSelect={selectFromCopy} />
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
              <span className="font-mono text-xs text-muted">
                {editing ? `${text.length.toLocaleString()} / ${MAX_TEXT_CHARS.toLocaleString()}` : PHASE_TEXT[state.phase] || summaryLine(counts, state.phase)}
              </span>
              {editing && (
                <button
                  type="button"
                  onClick={() => check()}
                  disabled={!text.trim() || (!audience.anchors.some((a) => a.query.trim()) && !audience.age && !audience.segments?.length && !audience.tags?.length)}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40"
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
              <button type="button" onClick={() => check()} className="rounded-md border border-misses/40 px-3 py-1 hover:bg-sheet">
                Try again
              </button>
            </div>
          )}

          {state.phase === "done" && state.extracted.length === 0 && (
            <p className="rounded-lg border border-rule bg-sheet px-4 py-3 text-sm text-muted">
              No named cultural references found. Vernacular checks specific artists, shows, films, books, podcasts, games, brands and places.
            </p>
          )}

          {swapsInOrder.length > 0 && (
            <section className="flex flex-col gap-3 rounded-xl border border-rule bg-sheet p-6" aria-label="Rewritten copy">
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

          {state.phase === "done" && swapsInOrder.length > 0 && (
            <ComparePanel text={state.text} audience={audience} references={state.extracted} scored={state.scored} swaps={state.swaps} />
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
