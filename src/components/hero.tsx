"use client";

import { useEffect, useState } from "react";
import { SHOWCASE } from "@/lib/vernacular/showcase";

type Stage = "miss" | "typing" | "land";

/** A line of real copy whose weak reference is underlined, then rewritten into one that lands. */
function SwapTicker() {
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<Stage>("miss");
  const [typed, setTyped] = useState(0);
  const s = SHOWCASE[i];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStage("land");
      setTyped(s.after.name.length);
      const t = window.setTimeout(() => setI((x) => (x + 1) % SHOWCASE.length), 4500);
      return () => window.clearTimeout(t);
    }
    setStage("miss");
    setTyped(0);
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setStage("typing"), 1700));
    for (let k = 1; k <= s.after.name.length; k++) timers.push(window.setTimeout(() => setTyped(k), 1700 + k * 55));
    timers.push(window.setTimeout(() => setStage("land"), 1750 + s.after.name.length * 55));
    timers.push(window.setTimeout(() => setI((x) => (x + 1) % SHOWCASE.length), 4800 + s.after.name.length * 55));
    return () => timers.forEach(window.clearTimeout);
  }, [i, s.after.name.length]);

  const [pre, post] = s.line.split("{ref}");
  const showing = stage === "miss" ? s.before : s.after;
  return (
    <div className="flex flex-col gap-3" aria-live="off">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">
        for <span className="text-ink">{s.audience}</span>
      </span>
      <p className="min-h-[2.6em] font-serif text-2xl leading-snug sm:text-[2rem]">
        {pre}
        {stage === "miss" ? (
          <span className="underline decoration-misses decoration-wavy decoration-2 underline-offset-[7px] text-muted">{s.before.name}</span>
        ) : (
          <span className="rounded-md bg-lands-soft px-1 text-ink">
            {s.after.name.slice(0, typed)}
            {stage === "typing" && <span className="ticker-caret">|</span>}
          </span>
        )}
        {post}
      </p>
      <span className="flex items-center gap-2 font-mono text-xs">
        <span className={`rounded-full px-2 py-0.5 ${stage === "miss" ? "bg-misses-soft text-misses" : "bg-desk text-muted line-through"}`}>
          {s.before.name} · p{s.before.p}
        </span>
        <span className="text-muted">→</span>
        <span className={`rounded-full px-2 py-0.5 ${stage === "land" ? "bg-lands-soft text-lands" : "bg-desk text-muted"}`}>
          {s.after.name} · p{s.after.p}
        </span>
        <span className="sr-only">{`${showing.name}`}</span>
      </span>
    </div>
  );
}

export function Hero({ lift, missRate }: { lift: number | null; missRate: number | null }) {
  return (
    <section className="hero-glow relative overflow-hidden rounded-2xl border border-rule bg-sheet px-6 py-8 sm:px-10 sm:py-10">
      <div className="relative grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="flex flex-col gap-4">
          <h1 className="font-serif text-4xl italic leading-[1.05] tracking-tight text-balance sm:text-6xl">The spell-checker for culture.</h1>
          <p className="max-w-xl text-lg text-muted">
            Grammarly fixes your grammar. Vernacular fixes your references: every artist, show, brand and place in your copy, scored for the exact
            audience you&apos;re writing for on Qloo&apos;s taste graph, and the ones that miss swapped for ones that land.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {lift !== null && (
              <a href="/benchmark" className="rounded-full border border-rule bg-desk px-3 py-1 hover:border-accent">
                <span className="font-mono text-lands">+{lift}</span> percentile points over Claude alone
              </a>
            )}
            {missRate !== null && (
              <a href="/benchmark" className="rounded-full border border-rule bg-desk px-3 py-1 hover:border-accent">
                <span className="font-mono text-lands">{Math.round(missRate * 100)}%</span> of references miss after Vernacular
              </a>
            )}
            <span className="rounded-full border border-rule bg-desk px-3 py-1">Qloo taste graph × Claude agents</span>
          </div>
        </div>
        <div className="rounded-xl border border-rule bg-desk/60 p-5 sm:p-6">
          <SwapTicker />
        </div>
      </div>
    </section>
  );
}
