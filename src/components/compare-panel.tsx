"use client";

import { useState } from "react";
import type { BaselineResult } from "@/lib/vernacular/baseline";
import type { AudienceSpec, ExtractedReference, ScoredReference, Swap, Verdict } from "@/lib/vernacular/types";

const TONE: Record<Verdict, string> = { lands: "text-lands", mixed: "text-mixed", misses: "text-misses", unmeasured: "text-unmeasured" };

interface Cell {
  name: string;
  percentile: number | null;
  verdict: Verdict;
  note?: string;
}

function CellView({ c, changed }: { c: Cell; changed: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={`font-serif ${changed ? "text-ink" : "text-muted"}`}>{c.name}</span>
      <span className={`font-mono text-xs ${TONE[c.verdict]}`}>
        {c.percentile === null ? "not measured" : `p${c.percentile}`} {changed ? "" : "· kept"}
      </span>
      {c.note && <span className="text-[11px] text-mixed">{c.note}</span>}
    </div>
  );
}

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

export function ComparePanel({
  text,
  audience,
  references,
  scored,
  swaps,
}: {
  text: string;
  audience: AudienceSpec;
  references: ExtractedReference[];
  scored: Record<string, ScoredReference>;
  swaps: Record<string, Swap>;
}) {
  const [result, setResult] = useState<BaselineResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/baseline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, audience }) });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "The comparison failed.");
      else setResult(data as BaselineResult);
    } catch {
      setError("Lost the connection to the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const anchorNames = new Set(audience.anchors.map((a) => a.query.toLowerCase()));
  const rows = references.map((r) => {
    const s = scored[r.id];
    const original: Cell = { name: r.span, percentile: s?.percentile ?? null, verdict: s?.verdict ?? "unmeasured" };
    const pick = result?.picks.find((p) => p.original.toLowerCase().includes(r.span.toLowerCase()) || r.span.toLowerCase().includes(p.original.toLowerCase()));
    const alone: Cell = pick
      ? {
          name: pick.matched ?? pick.replacement,
          percentile: pick.percentile,
          verdict: pick.verdict,
          note: anchorNames.has(pick.replacement.toLowerCase()) ? "Copies a name from the audience brief" : pick.matched ? undefined : "Qloo couldn't find this",
        }
      : original;
    const sw = swaps[r.id];
    const ours: Cell = sw ? { name: sw.replacement.name, percentile: sw.replacement.percentile, verdict: sw.replacement.percentile !== null && sw.replacement.percentile >= 65 ? "lands" : "mixed" } : original;
    return { id: r.id, original, alone, ours, aloneChanged: !!pick, oursChanged: !!sw };
  });
  const misses = (cells: Cell[]) => cells.filter((c) => c.verdict === "misses").length;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-rule bg-sheet p-6" aria-label="Comparison with Claude alone">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 className="text-sm font-semibold">Would Claude alone do as well?</h2>
          <p className="text-sm text-muted">
            The same model gets the same copy and audience description, but no Qloo. Qloo then scores its choices exactly the way it scored Vernacular&apos;s.
          </p>
        </div>
        {!result && (
          <button type="button" onClick={run} disabled={busy} className="rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink disabled:opacity-50">
            {busy ? "Running Claude alone…" : "Run the comparison"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-misses">{error}</p>}
      {result && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr className="border-b border-rule">
                  <th className="py-2 pr-3 font-medium">Original</th>
                  <th className="py-2 pr-3 font-medium">Claude alone</th>
                  <th className="py-2 font-medium">Vernacular (Claude + Qloo)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-rule/60 align-top last:border-0">
                    <td className="py-2 pr-3"><CellView c={r.original} changed /></td>
                    <td className="py-2 pr-3"><CellView c={r.alone} changed={r.aloneChanged} /></td>
                    <td className="py-2"><CellView c={r.ours} changed={r.oursChanged} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-mono text-xs">
                <tr>
                  <td className="pt-3 pr-3">avg p{mean(rows.map((r) => r.original.percentile)) ?? "–"} · {misses(rows.map((r) => r.original))} miss</td>
                  <td className="pt-3 pr-3">avg p{mean(rows.map((r) => r.alone.percentile)) ?? "–"} · {misses(rows.map((r) => r.alone))} miss</td>
                  <td className="pt-3">avg p{mean(rows.map((r) => r.ours.percentile)) ?? "–"} · {misses(rows.map((r) => r.ours))} miss</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-muted">
            Both columns are scored on the same Qloo measure, so this shows how far each one moves the copy toward this audience. It does not measure tone or how a real crowd responds.
          </p>
        </>
      )}
    </section>
  );
}
