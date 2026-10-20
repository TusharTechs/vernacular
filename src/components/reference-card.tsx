"use client";

import { TastePath } from "./taste-path";
import { AGE_BANDS, type AgeBand } from "@/lib/qloo/params";
import { contextOf } from "@/lib/vernacular/diff";
import type { Kept, ScoredReference, Swap, Verdict } from "@/lib/vernacular/types";

const VERDICT_TEXT: Record<Verdict, string> = { lands: "Lands", mixed: "Mixed", misses: "Misses", unmeasured: "Not measured" };
const VERDICT_CLASS: Record<Verdict, string> = {
  lands: "bg-lands-soft text-lands",
  mixed: "bg-mixed-soft text-mixed",
  misses: "bg-misses-soft text-misses",
  unmeasured: "bg-desk text-unmeasured",
};
const FILL: Record<Verdict, string> = { lands: "bg-lands", mixed: "bg-mixed", misses: "bg-misses", unmeasured: "bg-unmeasured" };
const SHORT_AGE: Record<AgeBand, string> = {
  "24_and_younger": "≤24",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
};

export function Source({ kind }: { kind: "qloo" | "model" | "generated" }) {
  const map = {
    qloo: ["Qloo", "border-lands/40 text-lands", "Measured by a Qloo API call"],
    model: ["Model", "border-mixed/40 text-mixed", "Inferred by the language model"],
    generated: ["Generated", "border-accent/40 text-accent", "Written by the language model"],
  } as const;
  const [label, cls, title] = map[kind];
  return (
    <span title={title} className={`shrink-0 rounded border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider ${cls}`}>
      {label}
    </span>
  );
}

function Meter({ percentile, verdict }: { percentile: number | null; verdict: Verdict }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 flex-1 rounded-full bg-desk" role="img" aria-label={percentile === null ? "No score" : `Percentile ${percentile} of 100`}>
        <div className={`absolute inset-y-0 left-0 rounded-full ${FILL[verdict]}`} style={{ width: `${percentile ?? 0}%` }} />
        <div className="absolute inset-y-[-3px] left-[35%] w-px bg-muted/50" />
        <div className="absolute inset-y-[-3px] left-[65%] w-px bg-muted/50" />
      </div>
      <span className="w-10 text-right font-mono text-xs tabular-nums text-muted">{percentile === null ? "–" : `p${percentile}`}</span>
    </div>
  );
}

function AgeBars({ skew, focus }: { skew: Partial<Record<AgeBand, number>>; focus?: AgeBand }) {
  const max = Math.max(0.3, ...AGE_BANDS.map((b) => Math.abs(skew[b] ?? 0)));
  return (
    <div className="flex items-end gap-1.5" role="img" aria-label="Age skew of this reference's audience">
      {AGE_BANDS.map((b) => {
        const v = skew[b] ?? 0;
        const h = Math.round((Math.abs(v) / max) * 18);
        return (
          <div key={b} className="flex w-9 flex-col items-center gap-1">
            <div className="flex h-10 w-full flex-col justify-center">
              <div className="flex h-[18px] items-end justify-center">
                {v > 0 && <div className={`w-3 rounded-t-sm ${b === focus ? "bg-ink" : "bg-muted/50"}`} style={{ height: h }} />}
              </div>
              <div className="h-px w-full bg-rule" />
              <div className="flex h-[18px] items-start justify-center">
                {v < 0 && <div className={`w-3 rounded-b-sm ${b === focus ? "bg-ink" : "bg-muted/30"}`} style={{ height: h }} />}
              </div>
            </div>
            <span className={`font-mono text-[9px] ${b === focus ? "text-ink" : "text-muted"}`}>{SHORT_AGE[b]}</span>
          </div>
        );
      })}
    </div>
  );
}

function SwapPreview({ swap }: { swap: Swap }) {
  const { lead, tail } = contextOf(swap.change);
  return (
    <p className="font-serif text-[15px] leading-snug text-muted" aria-label={`Change: ${swap.change.before} becomes ${swap.change.after}`}>
      {lead}
      <del className="text-misses decoration-misses/60">{swap.change.before}</del>
      {swap.change.before && swap.change.after ? " " : ""}
      <ins className="swapped text-ink no-underline">{swap.change.after}</ins>
      {tail}
    </p>
  );
}

export function ReferenceCard({
  id,
  span,
  reference,
  swap,
  kept,
  working,
  focusAge,
  selected,
  accepted,
  onSelect,
  onAccept,
  onDismiss,
}: {
  id: string;
  span: string;
  reference?: ScoredReference;
  swap?: Swap;
  kept?: Kept;
  working: boolean;
  focusAge?: AgeBand;
  selected: boolean;
  accepted: boolean | undefined;
  onSelect: () => void;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const verdict = reference?.verdict;
  return (
    <article
      id={id}
      tabIndex={-1}
      onClick={onSelect}
      className={`flex flex-col gap-3 rounded-lg border bg-sheet p-4 scroll-mt-4 outline-none transition-shadow ${selected ? "border-accent shadow-[0_0_0_3px_var(--accent-soft)]" : "border-rule"}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-lg leading-tight">{span}</h3>
          {reference?.entity && (
            <p className="text-xs text-muted">
              Matched to {reference.entity.name} · {reference.type.replace("_", " ")}
            </p>
          )}
        </div>
        {verdict ? (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT_CLASS[verdict]}`}>{VERDICT_TEXT[verdict]}</span>
        ) : (
          <span className="shrink-0 rounded-full bg-desk px-2.5 py-0.5 text-xs text-muted">Scoring…</span>
        )}
      </header>

      {reference && (
        <>
          <Meter percentile={reference.percentile} verdict={reference.verdict} />
          {reference.ageSkew && <AgeBars skew={reference.ageSkew} focus={focusAge} />}
          <ul className="flex flex-col gap-1.5 text-sm">
            {reference.notes.map((n) => (
              <li key={n} className="flex items-start gap-2">
                <Source kind="qloo" />
                <span>{n}</span>
              </li>
            ))}
            <li className="flex items-start gap-2 text-muted">
              <Source kind="model" />
              <span>Role in the sentence: {reference.role}</span>
            </li>
          </ul>
        </>
      )}

      {swap && (
        <div className="flex flex-col gap-2 rounded-md border border-rule bg-desk/60 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm">
              Swap for <strong className="font-serif text-base">{swap.replacement.name}</strong>
            </p>
            <span className="font-mono text-xs text-lands">p{swap.replacement.percentile ?? "–"}</span>
          </div>
          <p className="flex items-start gap-2 text-sm text-muted">
            <Source kind="generated" />
            <span>{swap.rationale}</span>
          </p>
          <SwapPreview swap={swap} />
          {swap.drivers.length > 0 && (
            <div className="flex items-start gap-2">
              <Source kind="qloo" />
              <TastePath
                drivers={swap.drivers}
                original={{ name: reference?.entity?.name ?? span, percentile: reference?.percentile ?? null }}
                replacement={{ name: swap.replacement.name, percentile: swap.replacement.percentile }}
              />
            </div>
          )}
          <div className="flex gap-2 pt-1">
            {accepted ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); onDismiss(); }} className="rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink">
                Undo
              </button>
            ) : (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); onAccept(); }} className="rounded-md bg-ink px-3 py-1.5 text-sm text-sheet hover:opacity-90">
                  Accept swap
                </button>
                {accepted === undefined && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onDismiss(); }} className="rounded-md px-3 py-1.5 text-sm text-muted hover:text-ink">
                    Dismiss
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {kept && <p className="rounded-md bg-desk/60 p-3 text-sm text-muted">Kept as written. {kept.reason}</p>}

      {!swap && !kept && working && (verdict === "misses" || verdict === "mixed") && (
        <p className="animate-pulse text-sm text-muted">Looking for a better fit on Qloo…</p>
      )}
    </article>
  );
}
