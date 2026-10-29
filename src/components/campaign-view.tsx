"use client";

import { useEffect, useRef, useState } from "react";
import type { CampaignCell, CampaignEvent, CampaignResult } from "@/lib/vernacular/campaign";
import { variantsFromCsv } from "@/lib/vernacular/csv";
import { AUDIENCE_PRESETS } from "@/lib/vernacular/presets";
import type { ExtractedReference, Verdict } from "@/lib/vernacular/types";
import { Source } from "./reference-card";
import { streamPost } from "./use-check";

const MAX_VARIANTS = 5;
const MAX_CHARS = 600;
const TONE: Record<Verdict, string> = {
  lands: "bg-lands-soft text-lands",
  mixed: "bg-mixed-soft text-mixed",
  misses: "bg-misses-soft text-misses",
  unmeasured: "bg-desk text-unmeasured",
};
const fitVerdict = (fit: number | null): Verdict => (fit === null ? "unmeasured" : fit >= 65 ? "lands" : fit < 35 ? "misses" : "mixed");

type Variant = { name: string; text: string };

function csvCell(s: string | number | null) {
  const v = s === null ? "" : String(s);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function CampaignView() {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [picked, setPicked] = useState<string[]>(AUDIENCE_PRESETS.map((p) => p.id));
  const [cols, setCols] = useState<string[]>([]); // preset ids of the grid's columns
  const [extracted, setExtracted] = useState<(ExtractedReference[] | undefined)[]>([]);
  const [cells, setCells] = useState<CampaignCell[]>([]);
  const [colErrors, setColErrors] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<"loading" | "idle" | "running" | "done" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [stats, setStats] = useState<CampaignResult["stats"] | null>(null);
  const [selected, setSelected] = useState<{ v: number; a: number } | null>(null);
  const [gridVariants, setGridVariants] = useState<Variant[]>([]);
  const abort = useRef<AbortController | null>(null);
  const file = useRef<HTMLInputElement>(null);

  // Open on the saved example campaign so the grid is there on first view.
  useEffect(() => {
    let alive = true;
    fetch("/api/campaign/sample")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: CampaignResult | null) => {
        if (!alive) return;
        if (!d) {
          setStatus("idle");
          return;
        }
        const ids = d.input.audiences.map((a) => AUDIENCE_PRESETS.find((p) => p.spec.label === a.label)?.id ?? "");
        setVariants(d.input.variants);
        setGridVariants(d.input.variants);
        setCols(ids);
        setPicked(ids.filter(Boolean));
        setExtracted(d.extracted);
        setCells(d.cells);
        setStats(d.stats);
        setSavedAt(d.checkedAt);
        setSelected(firstToFix(d.cells));
        setStatus("done");
      })
      .catch(() => alive && setStatus("idle"));
    return () => {
      alive = false;
    };
  }, []);

  const run = async () => {
    const live = variants.map((v, i) => ({ name: v.name.trim() || `Variant ${String.fromCharCode(65 + i)}`, text: v.text.trim() })).filter((v) => v.text);
    const ids = AUDIENCE_PRESETS.filter((p) => picked.includes(p.id)).map((p) => p.id);
    if (!live.length || !ids.length) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setGridVariants(live);
    setCols(ids);
    setExtracted([]);
    setCells([]);
    setColErrors({});
    setSelected(null);
    setSavedAt(null);
    setStats(null);
    setError(null);
    setStatus("running");
    const audiences = ids.map((id) => AUDIENCE_PRESETS.find((p) => p.id === id)!.spec);
    const err = await streamPost<CampaignEvent>("/api/campaign", { variants: live, audiences }, controller.signal, (e) => {
      if (e.type === "extracted") setExtracted((x) => Object.assign([...x], { [e.variant]: e.references }));
      if (e.type === "cells") setCells((c) => [...c.filter((x) => x.audience !== e.audience), ...e.cells]);
      if (e.type === "audience_error") setColErrors((x) => ({ ...x, [e.audience]: e.message }));
      if (e.type === "done") {
        setStats(e.stats);
        setStatus("done");
      }
      if (e.type === "error") {
        setError(e.message);
        setStatus("error");
      }
    });
    if (err) {
      setError(err);
      setStatus("error");
    }
  };

  const importCsv = async (f: File) => {
    const vs = variantsFromCsv(await f.text());
    if (!vs.length) {
      setError("No variants found in that file. Use a column named copy (and optionally name), one variant per row.");
      return;
    }
    setError(null);
    setVariants(vs.map((v) => ({ ...v, text: v.text.slice(0, MAX_CHARS) })));
  };

  // When a run finishes, open the cell most in need of a fix.
  useEffect(() => {
    if (status === "done" && !selected && cells.length) setSelected(firstToFix(cells));
  }, [status, selected, cells]);

  const cell = (v: number, a: number) => cells.find((c) => c.variant === v && c.audience === a);
  const bestIn = (a: number) => {
    const col = cells.filter((c) => c.audience === a && c.fit !== null);
    return col.length ? col.reduce((b, c) => (c.fit! > b.fit! ? c : b)) : null;
  };
  const rowMean = (v: number) => {
    const row = cells.filter((c) => c.variant === v && c.fit !== null);
    return row.length ? Math.round(row.reduce((n, c) => n + c.fit!, 0) / row.length) : null;
  };
  const checkLink = (v: number, a: number) =>
    `/#check=${encodeURIComponent(JSON.stringify({ text: gridVariants[v]?.text ?? "", audience: cols[a] }))}`;
  const label = (id: string) => AUDIENCE_PRESETS.find((p) => p.id === id)?.spec.label ?? id;

  const download = () => {
    const lines = [["variant", "audience", "fit_percentile", "lands", "mixed", "misses", "unmeasured", "references"].join(",")];
    for (const c of [...cells].sort((x, y) => x.variant - y.variant || x.audience - y.audience)) {
      lines.push(
        [
          csvCell(gridVariants[c.variant]?.name ?? ""),
          csvCell(label(cols[c.audience])),
          csvCell(c.fit),
          c.counts.lands,
          c.counts.mixed,
          c.counts.misses,
          c.counts.unmeasured,
          csvCell(c.refs.map((r) => `${r.span} ${r.verdict}${r.percentile !== null ? ` p${r.percentile}` : ""}`).join("; ")),
        ].join(","),
      );
    }
    const url = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "vernacular-campaign.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sel = selected ? cell(selected.v, selected.a) : undefined;
  const running = status === "running";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border border-rule bg-sheet p-5" aria-label="Variants">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Variants</h2>
            <p className="text-sm text-muted">Up to {MAX_VARIANTS} versions of the same ad, {MAX_CHARS} characters each. Or import a CSV with a copy column.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            <button type="button" onClick={() => file.current?.click()} disabled={running} className="rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink disabled:opacity-40">
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => setVariants((v) => [...v, { name: `Variant ${String.fromCharCode(65 + v.length)}`, text: "" }])}
              disabled={running || variants.length >= MAX_VARIANTS}
              className="rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink disabled:opacity-40"
            >
              Add variant
            </button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {variants.map((v, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-rule p-3">
              <div className="flex items-center gap-2">
                <input
                  aria-label={`Variant ${i + 1} name`}
                  value={v.name}
                  maxLength={40}
                  onChange={(e) => setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                />
                <button
                  type="button"
                  onClick={() => setVariants((vs) => vs.filter((_, j) => j !== i))}
                  disabled={running || variants.length <= 1}
                  aria-label={`Remove ${v.name || `variant ${i + 1}`}`}
                  className="text-sm text-muted hover:text-misses disabled:opacity-30"
                >
                  ×
                </button>
              </div>
              <textarea
                aria-label={`Variant ${i + 1} copy`}
                value={v.text}
                maxLength={MAX_CHARS}
                rows={3}
                onChange={(e) => setVariants((vs) => vs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                className="resize-y rounded-md border border-rule bg-desk/40 px-3 py-2 font-serif text-[15px] leading-relaxed outline-none focus:border-accent"
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Audiences">
            {AUDIENCE_PRESETS.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  disabled={running}
                  onClick={() => setPicked((x) => (on ? x.filter((y) => y !== p.id) : [...x, p.id]))}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-accent bg-accent-soft text-ink" : "border-rule text-muted hover:border-accent"}`}
                >
                  {p.spec.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={run}
            disabled={running || !picked.length || !variants.some((v) => v.text.trim())}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40"
          >
            {running ? "Scoring the campaign…" : `Check ${variants.filter((v) => v.text.trim()).length} × ${picked.length}`}
          </button>
        </div>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-misses/40 bg-misses-soft px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {status === "loading" && <p className="animate-pulse text-sm text-muted">Loading the example campaign…</p>}

      {cols.length > 0 && gridVariants.length > 0 && status !== "loading" && (
        <section className="flex min-w-0 flex-col gap-3" aria-label="Campaign grid">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-muted">
              {savedAt
                ? `Example: a saved run on Qloo, ${new Date(savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. Edit the variants or press Check to run it live.`
                : running
                  ? "Reading each variant, then scoring every reference for each audience on Qloo…"
                  : "Each cell is the variant's average Qloo percentile for that audience."}
              {stats && ` ${stats.qlooCalls} Qloo calls, ${(stats.ms / 1000).toFixed(0)} s.`}
            </p>
            {cells.length > 0 && !running && (
              <button type="button" onClick={download} className="rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink">
                Download CSV
              </button>
            )}
          </div>
          <div className="max-w-full overflow-x-auto rounded-xl border border-rule bg-sheet" tabIndex={0} role="region" aria-label="Campaign grid, scrolls sideways">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule">
                  <th className="w-56 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Variant</th>
                  {cols.map((id, a) => (
                    <th key={id} className="px-2 py-3 text-left align-bottom font-normal">
                      <div className="font-medium text-ink">{label(id)}</div>
                      {colErrors[a] && <div className="text-xs text-misses">{colErrors[a]}</div>}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left align-bottom text-xs font-medium uppercase tracking-wider text-muted">Average</th>
                </tr>
              </thead>
              <tbody>
                {gridVariants.map((v, vi) => (
                  <tr key={vi} className="border-b border-rule last:border-0">
                    <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                      <div className="font-medium">{v.name}</div>
                      <div className="line-clamp-2 font-serif text-xs text-muted">{v.text}</div>
                      {extracted[vi] && <div className="pt-1 text-[11px] text-muted">{extracted[vi]!.length} references</div>}
                    </th>
                    {cols.map((id, a) => {
                      const c = cell(vi, a);
                      const best = bestIn(a);
                      const isBest = !!c && !!best && best.variant === vi && c.fit !== null;
                      const on = selected?.v === vi && selected?.a === a;
                      return (
                        <td key={id} className="px-1.5 py-2 align-top">
                          {c ? (
                            <button
                              type="button"
                              onClick={() => setSelected({ v: vi, a })}
                              aria-pressed={on}
                              className={`relative flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left transition-shadow ${TONE[fitVerdict(c.fit)]} ${on ? "ring-2 ring-ink" : "hover:ring-1 hover:ring-rule"}`}
                            >
                              <span className="sr-only">
                                {v.name} for {label(id)}:{" "}
                              </span>
                              <span className="font-mono text-lg leading-none">
                                {c.fit === null ? "–" : `p${c.fit}`}
                                {isBest && (
                                  <>
                                    <span aria-hidden className="ml-1 text-xs">★</span>
                                    <span className="sr-only">, best version for this audience,</span>
                                  </>
                                )}
                              </span>
                              <span className="text-[11px]">
                                {c.counts.lands} land · {c.counts.misses} miss
                              </span>
                            </button>
                          ) : (
                            <span className={`block h-12 rounded-lg ${running && !colErrors[a] ? "animate-pulse bg-desk" : "bg-desk/50"}`} />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 align-top font-mono text-sm text-muted">{rowMean(vi) === null ? "" : `p${rowMean(vi)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {status === "done" && cells.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-xl border border-rule bg-sheet p-5">
                <h3 className="text-sm font-semibold">Where each version should run</h3>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {cols.map((id, a) => {
                    const b = bestIn(a);
                    return (
                      <li key={id} className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-muted">{label(id)}</span>
                        <span>
                          {b ? (
                            <>
                              <strong>{gridVariants[b.variant]?.name}</strong> <span className="font-mono text-xs text-muted">p{b.fit}</span>
                              {b.fit! < 65 && <span className="text-xs text-mixed"> · none land yet, open it to swap</span>}
                            </>
                          ) : (
                            <span className="text-muted">no scores</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="pt-1 text-xs text-muted">★ marks the best version per audience. Averages are within-audience Qloo percentiles, so compare down a column, not across.</p>
              </div>
              {sel && (
                <div className="flex flex-col gap-2 rounded-xl border border-rule bg-sheet p-5" aria-live="polite">
                  <h3 className="text-sm font-semibold">
                    {gridVariants[sel.variant]?.name} for {label(cols[sel.audience])}
                  </h3>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {sel.refs.map((r, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-2">
                        <span className="flex items-baseline gap-2">
                          <Source kind="qloo" />
                          {r.span}
                          {r.name && r.name !== r.span && <span className="text-xs text-muted">({r.name})</span>}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 font-mono text-xs ${TONE[r.verdict]}`}>
                          {r.verdict}
                          {r.percentile !== null && ` · p${r.percentile}`}
                        </span>
                      </li>
                    ))}
                    {!sel.refs.length && <li className="text-muted">No named references in this version.</li>}
                  </ul>
                  <a href={checkLink(sel.variant, sel.audience)} className="self-start pt-1 text-sm font-medium text-accent hover:underline">
                    Open the full check, with verified swaps →
                  </a>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function firstToFix(cells: CampaignCell[]): { v: number; a: number } | null {
  const weak = cells.filter((c) => c.counts.misses > 0).sort((x, y) => y.counts.misses - x.counts.misses);
  const c = weak[0] ?? cells[0];
  return c ? { v: c.variant, a: c.audience } : null;
}
