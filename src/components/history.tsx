"use client";

import { useEffect, useState } from "react";
import type { CheckResult } from "@/lib/vernacular/types";

// Your recent checks, kept only in this browser (localStorage); nothing is sent anywhere.
const KEY = "vernacular-history-v1";
const MAX = 8;

export interface HistoryItem {
  id: string;
  at: string;
  audience: string;
  excerpt: string;
  before: number | null;
  after: number | null;
  result: CheckResult;
}

const mean = (xs: (number | null)[]) => {
  const m = xs.filter((x): x is number => x !== null);
  return m.length ? Math.round(m.reduce((a, b) => a + b, 0) / m.length) : null;
};

export function summarise(r: CheckResult): Omit<HistoryItem, "id" | "at"> {
  const before = mean(r.references.map((x) => x.percentile));
  const after = mean(r.references.map((x) => r.swaps.find((s) => s.referenceId === x.id)?.replacement.percentile ?? x.percentile));
  return { audience: r.audience.label, excerpt: r.input.text.slice(0, 90), before, after, result: r };
}

export function readHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryItem[];
  } catch {
    return [];
  }
}

export function saveToHistory(r: CheckResult): HistoryItem[] {
  const item: HistoryItem = { id: `${Date.now()}`, at: new Date().toISOString(), ...summarise(r) };
  const next = [item, ...readHistory().filter((h) => !(h.result.input.text === r.input.text && h.audience === item.audience))].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: keep the in-memory list only
  }
  return next;
}

export function YourChecks({ items, onOpen, onClear }: { items: HistoryItem[]; onOpen: (h: HistoryItem) => void; onClear: () => void }) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-2" aria-label="Your checks">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">Your checks</h2>
        <button type="button" onClick={onClear} className="text-xs text-muted hover:text-ink">
          Clear · kept only in this browser
        </button>
      </div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        {items.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => onOpen(h)}
            className="flex w-60 shrink-0 snap-start flex-col gap-1.5 rounded-xl border border-rule bg-sheet p-4 text-left hover:border-accent"
          >
            <span className="flex items-center justify-between gap-2 font-mono text-xs">
              <span className="text-muted">{new Date(h.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              <span>
                <span className="text-misses">p{h.before ?? "–"}</span>
                {h.after !== h.before && (
                  <>
                    {" "}
                    → <span className="text-lands">p{h.after ?? "–"}</span>
                  </>
                )}
              </span>
            </span>
            <span className="line-clamp-2 font-serif text-[15px] leading-snug">{h.excerpt}</span>
            <span className="mt-auto text-xs text-muted">for {h.audience}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  useEffect(() => setItems(readHistory()), []);
  return {
    items,
    add: (r: CheckResult) => setItems(saveToHistory(r)),
    clear: () => {
      try {
        localStorage.removeItem(KEY);
      } catch {
        // ignore
      }
      setItems([]);
    },
  };
}
