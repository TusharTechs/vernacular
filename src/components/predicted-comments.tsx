"use client";

import { useState } from "react";
import type { CommentInput, Mood, Persona, PredictedComment } from "@/lib/vernacular/comments";

const MOOD: Record<Mood, { emoji: string; label: string; tone: string }> = {
  loves: { emoji: "😍", label: "loves it", tone: "text-lands" },
  likes: { emoji: "🙂", label: "likes it", tone: "text-lands" },
  meh: { emoji: "😐", label: "meh", tone: "text-mixed" },
  confused: { emoji: "🤔", label: "confused", tone: "text-mixed" },
  cringe: { emoji: "😬", label: "cringe", tone: "text-misses" },
};
const LIKES: Record<Mood, number> = { loves: 312, likes: 128, meh: 14, confused: 9, cringe: 41 };

interface Data {
  personas: Persona[];
  original: PredictedComment[];
  swaps: PredictedComment[];
}

export function PredictedComments({ input, after }: { input: CommentInput; after: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't predict the comments.");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't predict the comments.");
    } finally {
      setLoading(false);
    }
  };

  if (!data) {
    return (
      <div className="flex flex-col items-start gap-2 border-t border-rule pt-4">
        <button
          type="button"
          data-tour="comments"
          onClick={load}
          disabled={loading}
          className="rounded-md border border-rule px-3 py-1.5 text-sm hover:border-accent disabled:opacity-60"
        >
          {loading ? "Gathering the comment section…" : "💬 Predict the comments"}
        </button>
        <p className="text-xs text-muted">Five simulated commenters, each built from what {input.audience.label} love on Qloo.</p>
        {error && <p role="alert" className="text-sm text-misses">{error}</p>}
      </div>
    );
  }

  const list = after ? data.swaps : data.original;
  const tally = list.reduce<Partial<Record<Mood, number>>>((t, c) => ({ ...t, [c.mood]: (t[c.mood] ?? 0) + 1 }), {});
  const positive = (tally.loves ?? 0) + (tally.likes ?? 0);

  return (
    <div className="flex flex-col gap-3 border-t border-rule pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Predicted comments · {after ? "with swaps" : "original"}</h3>
        <span className="flex gap-2 text-sm" aria-label="Reaction tally">
          {(Object.keys(MOOD) as Mood[]).map((m) =>
            tally[m] ? (
              <span key={m} title={MOOD[m].label}>
                {MOOD[m].emoji} {tally[m]}
              </span>
            ) : null,
          )}
        </span>
      </div>
      <p className="text-xs text-muted">
        {positive} of {list.length} react well. Flip between Original and With swaps above to compare.
      </p>
      <ul className="flex flex-col gap-3">
        {list.map((c, i) => {
          const p = data.personas[c.persona];
          return (
            <li key={`${after}-${i}`} className="comment-in flex gap-3" style={{ animationDelay: `${i * 90}ms` }}>
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ background: `hsl(${(c.persona * 67 + 210) % 360} 55% 48%)` }}
                aria-hidden
              >
                {c.handle.slice(0, 1).toUpperCase()}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                <p>
                  <span className="mr-1.5 font-semibold">{c.handle}</span>
                  {c.text}
                </p>
                <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                  <span>♥ {LIKES[c.mood] + ((c.persona * 37) % 23)}</span>
                  <span className={MOOD[c.mood].tone}>
                    {MOOD[c.mood].emoji} {MOOD[c.mood].label}
                    {c.about ? ` · re ${c.about}` : ""}
                  </span>
                  {p && <span title="This persona's favourites, from Qloo">into {p.favourites.slice(0, 2).map((f) => f.name).join(", ")}</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        Simulated by Claude, not real people. Who they are comes from Qloo&apos;s taste data for this audience; how they react to each reference follows
        its Qloo score.
      </p>
    </div>
  );
}
