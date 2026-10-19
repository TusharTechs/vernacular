"use client";

import { useEffect, useRef, useState } from "react";
import { contextOf } from "@/lib/vernacular/diff";
import type { ScoredReference, Swap } from "@/lib/vernacular/types";

const THRESHOLD = 110;

/** Stories-style review: swipe right to take a swap, left to keep the original. */
export function SwipeReview({
  swaps,
  references,
  onDecide,
}: {
  swaps: Swap[];
  references: Record<string, ScoredReference>;
  onDecide: (referenceId: string, accept: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [tally, setTally] = useState({ taken: 0, kept: 0 });
  const start = useRef<number | null>(null);
  const reduce = useRef(false);
  const current = swaps[index];

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const open = () => {
    setIndex(0);
    setDx(0);
    setLeaving(null);
    setTally({ taken: 0, kept: 0 });
    dialog.current?.showModal();
  };

  const decide = (accept: boolean) => {
    if (!current || leaving) return;
    onDecide(current.referenceId, accept);
    setTally((t) => (accept ? { ...t, taken: t.taken + 1 } : { ...t, kept: t.kept + 1 }));
    setLeaving(accept ? "right" : "left");
    window.setTimeout(
      () => {
        setLeaving(null);
        setDx(0);
        setIndex((i) => i + 1);
      },
      reduce.current ? 0 : 220,
    );
  };

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (!el.open) return;
      if (e.key === "ArrowRight") decide(true);
      if (e.key === "ArrowLeft") decide(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const offset = leaving === "right" ? 600 : leaving === "left" ? -600 : dx;
  const original = current ? references[current.referenceId] : undefined;
  const ctx = current ? contextOf(current.change, 5) : null;

  return (
    <>
      <button type="button" onClick={open} disabled={!swaps.length} className="rounded-md border border-rule px-3 py-1 text-sm hover:border-ink disabled:opacity-40">
        Review swaps
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        aria-label="Review swaps one by one"
        className="m-auto h-[min(92vh,720px)] w-[min(94vw,440px)] overflow-hidden rounded-3xl border border-rule bg-desk p-0 text-ink backdrop:bg-ink/60"
      >
        <div className="flex h-full flex-col gap-4 p-5">
          <div className="flex gap-1" aria-hidden>
            {swaps.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < index ? "bg-ink" : i === index ? "bg-accent" : "bg-rule"}`} />
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{current ? `Swap ${index + 1} of ${swaps.length}` : "Done"}</span>
            <button type="button" onClick={() => dialog.current?.close()} className="rounded px-2 hover:text-ink" aria-label="Close">
              ×
            </button>
          </div>

          {current && original ? (
            <>
              <div className="relative flex-1">
                <article
                  onPointerDown={(e) => {
                    start.current = e.clientX;
                    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                  }}
                  onPointerMove={(e) => start.current !== null && setDx(e.clientX - start.current)}
                  onPointerUp={() => {
                    start.current = null;
                    if (dx > THRESHOLD) decide(true);
                    else if (dx < -THRESHOLD) decide(false);
                    else setDx(0);
                  }}
                  style={{
                    transform: `translateX(${offset}px) rotate(${offset / 22}deg)`,
                    transition: start.current !== null ? "none" : "transform 220ms ease",
                    touchAction: "pan-y",
                  }}
                  className="absolute inset-0 flex cursor-grab select-none flex-col justify-between rounded-2xl border border-rule bg-sheet p-6 shadow-lg active:cursor-grabbing"
                >
                  <span
                    className="pointer-events-none absolute right-5 top-5 rounded-md border-2 border-lands px-2 py-0.5 text-sm font-bold text-lands"
                    style={{ opacity: Math.max(0, Math.min(1, dx / THRESHOLD)) }}
                  >
                    SWAP
                  </span>
                  <span
                    className="pointer-events-none absolute left-5 top-5 rounded-md border-2 border-muted px-2 py-0.5 text-sm font-bold text-muted"
                    style={{ opacity: Math.max(0, Math.min(1, -dx / THRESHOLD)) }}
                  >
                    KEEP
                  </span>
                  <div className="flex flex-col gap-1 pt-8">
                    <span className="text-xs uppercase tracking-wider text-muted">Instead of</span>
                    <p className="font-serif text-2xl text-muted line-through decoration-misses/60">{original.span}</p>
                    <span className="font-mono text-xs text-muted">p{original.percentile ?? "–"} · {original.verdict}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-muted">Try</span>
                    <p className="font-serif text-4xl italic leading-tight">{current.replacement.name}</p>
                    <span className="font-mono text-sm text-lands">p{current.replacement.percentile ?? "–"} for this audience</span>
                  </div>
                  <p className="text-sm text-muted">{current.rationale}</p>
                  {ctx && (
                    <p className="rounded-lg bg-desk p-3 font-serif text-[15px] leading-snug text-muted">
                      {ctx.lead}
                      <span className="swapped text-ink">{current.change.after}</span>
                      {ctx.tail}
                    </p>
                  )}
                </article>
              </div>
              <div className="flex items-center justify-center gap-6 pb-1">
                <button type="button" onClick={() => decide(false)} className="flex h-14 w-14 items-center justify-center rounded-full border border-rule bg-sheet text-xl shadow-sm hover:border-ink" aria-label="Keep the original (left arrow)">
                  ←
                </button>
                <span className="text-xs text-muted">swipe or use ← →</span>
                <button type="button" onClick={() => decide(true)} className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-xl text-sheet shadow-sm hover:opacity-90" aria-label="Take the swap (right arrow)">
                  →
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <p className="font-serif text-3xl italic">All reviewed</p>
              <p className="text-sm text-muted">
                {tally.taken} swap{tally.taken === 1 ? "" : "s"} taken, {tally.kept} kept as written.
              </p>
              <button type="button" onClick={() => dialog.current?.close()} className="mt-2 rounded-md bg-ink px-4 py-2 text-sm text-sheet">
                See the rewrite
              </button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
