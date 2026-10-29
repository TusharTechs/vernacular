"use client";

import { SCENARIOS, type Scenario } from "@/lib/vernacular/scenarios";

export function ScenarioGallery({ active, loading, onOpen }: { active: string | null; loading: string | null; onOpen: (s: Scenario) => void }) {
  return (
    <section className="flex flex-col gap-2" aria-label="Real-world scenarios">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Real-world scenarios</h2>
        <span className="hidden text-xs text-muted sm:inline">Each one is a real check, saved so it opens instantly</span>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
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
