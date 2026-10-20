"use client";

import { useState } from "react";
import type { Arm, BenchmarkRun } from "@/lib/vernacular/benchmark/types";
import { pairScore } from "@/lib/vernacular/benchmark/summarize";

const PILL: Record<string, string> = {
  lands: "bg-lands-soft text-lands",
  mixed: "bg-mixed-soft text-mixed",
  misses: "bg-misses-soft text-misses",
  unmeasured: "bg-desk text-unmeasured",
};

/** Underline each graded reference where it appears in the text. */
function Marked({ arm }: { arm: Arm }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [i, r] of arm.refs.entries()) {
    const at = arm.text.indexOf(r.span, cursor);
    if (at < 0) continue;
    parts.push(arm.text.slice(cursor, at));
    parts.push(
      <span key={i} className="mark" data-verdict={r.verdict}>
        {r.span}
      </span>,
    );
    cursor = at + r.span.length;
  }
  parts.push(arm.text.slice(cursor));
  return <p className="font-serif text-[17px] leading-relaxed">{parts}</p>;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function Column({ title, arm, extra, anchors }: { title: string; arm: Arm; extra?: React.ReactNode; anchors: Set<string> }) {
  const score = pairScore(arm);
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-rule bg-sheet p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
        <span className="font-mono text-sm">{score === null ? "–" : `avg p${Math.round(score)}`}</span>
      </div>
      <Marked arm={arm} />
      <ul className="flex flex-wrap gap-1.5">
        {arm.refs.map((r, i) => (
          <li key={i} className={`rounded-full px-2 py-0.5 text-xs ${PILL[r.verdict]}`}>
            {r.name ?? r.span}
            <span className="font-mono"> · {r.percentile === null ? "n/a" : `p${r.percentile}`}</span>
            {[r.name, r.span].some((n) => n && anchors.has(norm(n))) && <span> · from the brief</span>}
          </li>
        ))}
        {!arm.refs.length && <li className="text-xs text-muted">No references found.</li>}
      </ul>
      {extra}
    </div>
  );
}

function Fidelity({ f }: { f: { meaning: number; natural: number; note: string } | null }) {
  if (!f) return null;
  return (
    <p className="border-t border-rule pt-3 text-xs text-muted">
      Blind judge: meaning <span className="font-mono text-ink">{f.meaning}/5</span> · reads naturally{" "}
      <span className="font-mono text-ink">{f.natural}/5</span>
      {f.note && f.note !== "None" ? <> · {f.note}</> : null}
    </p>
  );
}

export function BenchmarkExplorer({ run }: { run: BenchmarkRun }) {
  // Open on the same copy and audience as the editor's sample.
  const first = run.pairs.find((p) => p.copyId === "tour" && p.audienceId === "genz-latin") ?? run.pairs[0];
  const [copyId, setCopyId] = useState(first?.copyId ?? run.copy[0].id);
  const [audienceId, setAudienceId] = useState(first?.audienceId ?? run.audiences[0].id);
  const pair = run.pairs.find((p) => p.copyId === copyId && p.audienceId === audienceId);
  const anchors = new Set((run.audiences.find((a) => a.id === audienceId)?.anchors ?? []).map(norm));
  const has = (c: string, a: string) => run.pairs.some((p) => p.copyId === c && p.audienceId === a);

  const chip = (active: boolean, available: boolean) =>
    `rounded-full border px-3 py-1 text-xs transition-colors ${
      active ? "border-ink bg-ink text-sheet" : available ? "border-rule text-muted hover:border-accent hover:text-ink" : "border-rule text-muted opacity-40"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Copy">
          {run.copy.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === copyId} onClick={() => setCopyId(c.id)} className={chip(c.id === copyId, has(c.id, audienceId))}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Audience">
          {run.audiences.map((a) => (
            <button key={a.id} type="button" aria-pressed={a.id === audienceId} onClick={() => setAudienceId(a.id)} className={chip(a.id === audienceId, has(copyId, a.id))}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {pair ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <Column title="Original" arm={pair.original} anchors={anchors} />
          <Column title="Claude alone" arm={pair.claude} anchors={anchors} extra={<Fidelity f={pair.claude.fidelity} />} />
          <Column
            title="Vernacular"
            arm={pair.vernacular}
            anchors={anchors}
            extra={
              <>
                {pair.vernacular.swaps.length > 0 && (
                  <p className="text-xs text-muted">
                    Swapped {pair.vernacular.swaps.map((s) => `${s.from} → ${s.to}`).join(", ")}
                  </p>
                )}
                <Fidelity f={pair.vernacular.fidelity} />
              </>
            }
          />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-rule p-6 text-sm text-muted">This pair didn&apos;t finish in the last run.</p>
      )}
    </div>
  );
}
