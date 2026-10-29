"use client";

import { useEffect, useRef, useState } from "react";
import { SCENARIOS, type Scenario } from "@/lib/vernacular/scenarios";

export function ScenarioGallery({ active, loading, onOpen }: { active: string | null; loading: string | null; onOpen: (s: Scenario) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  // Track whether the row can scroll further each way, for the arrows and the edge fades.
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = row.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * Math.max(260, el.clientWidth * 0.8), behavior: reduce ? "auto" : "smooth" });
  };

  // Fade only the right edge, and only while a card is cut off there: cards snap flush left.
  const fade = edges.end ? undefined : "linear-gradient(to right, black calc(100% - 56px), transparent)";

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-label="Real-world scenarios">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Real-world scenarios</h2>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted md:inline">Each one is a real check, saved so it opens instantly</span>
          <div className="hidden gap-1 sm:flex">
            {([-1, 1] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => scrollBy(d)}
                disabled={d < 0 ? edges.start : edges.end}
                aria-label={d < 0 ? "Earlier scenarios" : "More scenarios"}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-rule text-sm text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-30"
              >
                {d < 0 ? "←" : "→"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        ref={row}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:thin]"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      >
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onOpen(s)}
            disabled={loading !== null}
            aria-pressed={active === s.id}
            className={`flex w-60 shrink-0 snap-start flex-col gap-1.5 rounded-xl border bg-sheet p-4 text-left transition-colors disabled:cursor-wait ${
              active === s.id ? "border-ink" : "border-rule hover:border-accent"
            }`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">{s.format}</span>
            <span className="font-serif text-lg leading-tight">{s.label}</span>
            <span className="line-clamp-2 text-xs text-muted">{s.situation}</span>
            <span className="mt-auto pt-1 text-xs">
              <span className="text-muted">for </span>
              {s.audience.label}
              {s.audience.location ? ` · ${s.audience.location}` : ""}
            </span>
            {loading === s.id && <span className="font-mono text-[10px] text-muted">Opening…</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
