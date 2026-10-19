"use client";

import { useRef, useState } from "react";
import type { ResolvedEntity } from "@/lib/qloo/tools";
import { AUDIENCE_PRESETS } from "@/lib/vernacular/presets";
import type { TourEvent } from "@/lib/vernacular/tour";
import type { AudienceSpec, ExtractedReference, ScoredReference, Verdict } from "@/lib/vernacular/types";
import { Source } from "./reference-card";
import { streamPost } from "./use-check";

const CELL: Record<Verdict | "pending", string> = {
  lands: "bg-lands-soft text-lands",
  mixed: "bg-mixed-soft text-mixed",
  misses: "bg-misses-soft text-misses",
  unmeasured: "bg-desk text-unmeasured",
  pending: "bg-desk text-muted animate-pulse",
};
const WORD: Record<Verdict, string> = { lands: "Lands", mixed: "Mixed", misses: "Misses", unmeasured: "Not measured" };

interface Column {
  spec: AudienceSpec;
  anchors?: ResolvedEntity[];
  scored?: Record<string, ScoredReference>;
  error?: string;
}

export function TourView({ text, onOpen }: { text: string; onOpen: (audience: AudienceSpec) => void }) {
  const [picked, setPicked] = useState<string[]>(AUDIENCE_PRESETS.map((p) => p.id));
  const [columns, setColumns] = useState<Column[]>([]);
  const [refs, setRefs] = useState<ExtractedReference[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ qlooCalls: number; ms: number } | null>(null);
  const [focus, setFocus] = useState<{ ref: string; col: number } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 5 ? p : [...p, id]));

  const run = async () => {
    const specs = AUDIENCE_PRESETS.filter((p) => picked.includes(p.id)).map((p) => p.spec);
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setColumns(specs.map((spec) => ({ spec })));
    setRefs([]);
    setStats(null);
    setFocus(null);
    setError(null);
    setStatus("running");
    const err = await streamPost<TourEvent>("/api/tour", { text, audiences: specs }, controller.signal, (e) => {
      if (e.type === "extracted") setRefs(e.references);
      if (e.type === "audience") setColumns((c) => c.map((col, i) => (i === e.index ? { ...col, anchors: e.anchors } : col)));
      if (e.type === "scored")
        setColumns((c) => c.map((col, i) => (i === e.index ? { ...col, scored: Object.fromEntries(e.references.map((r) => [r.id, r])) } : col)));
      if (e.type === "audience_error") setColumns((c) => c.map((col, i) => (i === e.index ? { ...col, error: e.message } : col)));
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

  const best = (refId: string) => {
    let top: { col: number; p: number } | null = null;
    columns.forEach((c, i) => {
      const p = c.scored?.[refId]?.percentile;
      if (typeof p === "number" && (!top || p > top.p)) top = { col: i, p };
    });
    return top as { col: number; p: number } | null;
  };
  const focused = focus ? columns[focus.col]?.scored?.[focus.ref] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-xl border border-rule bg-sheet p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Tour Mode</h2>
            <p className="text-sm text-muted">The same copy, scored for up to five audiences side by side.</p>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={status === "running" || picked.length < 2 || !text.trim()}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-40"
          >
            {status === "running" ? "Scoring…" : `Score for ${picked.length} audiences`}
          </button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Audiences to compare">
          {AUDIENCE_PRESETS.map((p) => {
            const on = picked.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                disabled={status === "running"}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${on ? "border-accent bg-accent-soft text-ink" : "border-rule text-muted hover:border-accent"}`}
              >
                {p.spec.label}
              </button>
            );
          })}
        </div>
        <p className="font-serif text-[17px] leading-relaxed text-muted line-clamp-3">{text || "Add copy in the editor first."}</p>
      </section>

      {error && (
        <div role="alert" className="rounded-lg border border-misses/40 bg-misses-soft px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {columns.length > 0 && (
        <section className="overflow-x-auto rounded-xl border border-rule bg-sheet" aria-label="Resonance grid">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule">
                <th className="w-48 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Reference</th>
                {columns.map((c, i) => {
                  const scored = c.scored ? Object.values(c.scored) : [];
                  const lands = scored.filter((s) => s.verdict === "lands").length;
                  return (
                    <th key={i} className="px-2 py-3 text-left align-bottom font-normal">
                      <div className="font-medium text-ink">{c.spec.label}</div>
                      <div className="text-xs text-muted">
                        {c.error ? c.error : c.scored ? `${lands} of ${scored.length} land` : c.anchors ? "Scoring…" : "Resolving…"}
                      </div>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Lands best with</th>
              </tr>
            </thead>
            <tbody>
              {(refs.length ? refs : status === "running" ? [null, null, null] : []).map((r, row) =>
                r ? (
                  <tr key={r.id} className="border-b border-rule/60 last:border-0">
                    <th scope="row" className="px-4 py-2 text-left font-normal">
                      <div className="font-serif text-base">{r.span}</div>
                      <div className="text-xs text-muted">{r.type.replace("_", " ")}</div>
                    </th>
                    {columns.map((c, i) => {
                      const s = c.scored?.[r.id];
                      const v: Verdict | "pending" = s ? s.verdict : c.error ? "unmeasured" : "pending";
                      const isFocus = focus?.ref === r.id && focus.col === i;
                      return (
                        <td key={i} className="px-1 py-1.5">
                          <button
                            type="button"
                            disabled={!s}
                            onClick={() => setFocus({ ref: r.id, col: i })}
                            aria-label={s ? `${r.span} for ${c.spec.label}: ${WORD[s.verdict]}, percentile ${s.percentile ?? "unknown"}` : `${r.span} for ${c.spec.label}: scoring`}
                            className={`flex h-12 w-full min-w-24 flex-col items-start justify-center rounded-md px-3 text-left transition-shadow ${CELL[v]} ${isFocus ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-rule"}`}
                          >
                            {s ? (
                              <>
                                <span className="font-mono text-sm tabular-nums">{s.percentile === null ? "–" : `p${s.percentile}`}</span>
                                <span className="text-[11px]">{WORD[s.verdict]}</span>
                              </>
                            ) : (
                              <span className="text-[11px]">{c.error ? "–" : "…"}</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 text-sm">{(() => { const b = best(r.id); return b ? columns[b.col].spec.label : "–"; })()}</td>
                  </tr>
                ) : (
                  <tr key={`skeleton-${row}`}>
                    <td colSpan={columns.length + 2} className="px-4 py-2">
                      <div className="h-10 animate-pulse rounded-md bg-desk" />
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          {status === "done" && !refs.length && (
            <p className="px-4 py-3 text-sm text-muted">No named cultural references found in this copy.</p>
          )}
          {stats && (
            <p className="border-t border-rule px-4 py-2 font-mono text-xs text-muted">
              {stats.qlooCalls} Qloo calls · {(stats.ms / 1000).toFixed(1)}s
            </p>
          )}
        </section>
      )}

      {focus && focused && (
        <section className="flex flex-col gap-3 rounded-xl border border-rule bg-sheet p-5" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-serif text-lg">
              {focused.span} <span className="text-muted">for</span> {columns[focus.col].spec.label}
            </h3>
            <button
              type="button"
              onClick={() => onOpen(columns[focus.col].spec)}
              className="rounded-md bg-ink px-3 py-1.5 text-sm text-sheet hover:opacity-90"
            >
              Rewrite the copy for {columns[focus.col].spec.label}
            </button>
          </div>
          <ul className="flex flex-col gap-1.5 text-sm">
            {focused.entity && (
              <li className="flex items-start gap-2">
                <Source kind="qloo" />
                <span>Matched to {focused.entity.name}</span>
              </li>
            )}
            {focused.notes.map((n) => (
              <li key={n} className="flex items-start gap-2">
                <Source kind="qloo" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
