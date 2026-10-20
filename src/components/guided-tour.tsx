"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface TourStep {
  /** CSS selector for the element to spotlight. */
  target: string;
  title: string;
  body: string;
}

const PAD = 8;

/** A lightweight coach-mark tour: spotlights one element at a time with a short caption. */
export function GuidedTour({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const next = useRef<HTMLButtonElement>(null);
  const step = steps[i];

  const measure = useCallback(() => {
    const el = step && document.querySelector(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = document.querySelector(step.target);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tall = el ? el.getBoundingClientRect().height > window.innerHeight * 0.55 : false;
    el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: tall ? "start" : "center" });
    const t = window.setTimeout(measure, reduce ? 0 : 450);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    next.current?.focus({ preventScroll: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(steps.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, steps.length]);

  if (!open || !step) return null;
  const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
  const vh = typeof window === "undefined" ? 768 : window.innerHeight;
  // Put the caption below the target, else above it; a target too tall for either gets the caption pinned to the bottom corner.
  const below = rect ? rect.bottom + PAD + 220 < vh : true;
  const above = rect ? rect.top - PAD - 220 > 0 : false;
  const cardTop = !rect ? vh / 2 - 100 : below ? rect.bottom + PAD + 12 : above ? rect.top - PAD - 12 - 200 : vh - 232;
  const cardLeft = rect ? Math.max(12, Math.min(vw - 352, below || above ? rect.left : vw - 352)) : vw / 2 - 170;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Tour step ${i + 1} of ${steps.length}: ${step.title}`}>
      <button type="button" aria-label="Close the tour" onClick={onClose} className="absolute inset-0 cursor-default" />
      {rect ? (
        <>
          {/* Four dark panels around the target, leaving it lit. */}
          {[
            { top: 0, left: 0, width: "100%", height: Math.max(0, rect.top - PAD) },
            { top: rect.bottom + PAD, left: 0, width: "100%", bottom: 0 },
            { top: rect.top - PAD, left: 0, width: Math.max(0, rect.left - PAD), height: rect.height + PAD * 2 },
            { top: rect.top - PAD, left: rect.right + PAD, right: 0, height: rect.height + PAD * 2 },
          ].map((style, k) => (
            <div key={k} className="tour-dim pointer-events-none absolute" style={style} />
          ))}
          <div
            className="pointer-events-none absolute rounded-xl ring-2 ring-accent"
            style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          />
        </>
      ) : (
        <div className="tour-dim pointer-events-none absolute inset-0" />
      )}
      <div
        className="absolute flex w-[340px] max-w-[calc(100vw-24px)] flex-col gap-2 rounded-xl border border-rule bg-sheet p-4 text-ink shadow-xl"
        style={{ top: cardTop, left: cardLeft }}
      >
        <span className="font-mono text-[11px] text-muted">
          {i + 1} / {steps.length}
        </span>
        <h2 className="font-serif text-xl italic">{step.title}</h2>
        <p className="text-sm text-muted">{step.body}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} className="text-sm text-muted hover:text-ink">
            Skip
          </button>
          <span className="flex gap-2">
            {i > 0 && (
              <button type="button" onClick={() => setI(i - 1)} className="rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink">
                Back
              </button>
            )}
            <button
              ref={next}
              type="button"
              onClick={() => (i === steps.length - 1 ? onClose() : setI(i + 1))}
              className="rounded-md bg-ink px-3 py-1.5 text-sm text-sheet"
            >
              {i === steps.length - 1 ? "Done" : "Next"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
