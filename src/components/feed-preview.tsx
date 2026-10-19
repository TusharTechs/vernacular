"use client";

import { useState } from "react";
import type { Verdict } from "@/lib/vernacular/types";
import type { Located } from "./copy-view";

type Format = "photo" | "video" | "pro" | "micro";

// Approximate characters shown before a feed truncates the caption ("…more").
const FORMATS: Record<Format, { label: string; fold: number; limit?: number }> = {
  photo: { label: "Photo post", fold: 125 },
  video: { label: "Short video", fold: 90 },
  pro: { label: "Professional post", fold: 210 },
  micro: { label: "Microblog", fold: 280, limit: 280 },
};

const UNDER: Record<Verdict | "pending", string> = {
  lands: "decoration-lands",
  mixed: "decoration-mixed",
  misses: "decoration-misses",
  unmeasured: "decoration-unmeasured",
  pending: "decoration-rule",
};

function Caption({
  text,
  refs,
  verdicts,
  fold,
  expanded,
  onExpand,
  highlight,
}: {
  text: string;
  refs: Located[];
  verdicts: Record<string, Verdict | "pending">;
  fold: number;
  expanded: boolean;
  onExpand: () => void;
  highlight: string[];
}) {
  const shown = expanded || text.length <= fold ? text : text.slice(0, fold).replace(/\s+\S*$/, "");
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const r of refs) {
    if (r.end > shown.length) break;
    parts.push(shown.slice(cursor, r.start));
    parts.push(
      <span key={r.id} className={`underline decoration-wavy decoration-[1.5px] underline-offset-4 ${UNDER[verdicts[r.id] ?? "pending"]}`}>
        {shown.slice(r.start, r.end)}
      </span>,
    );
    cursor = r.end;
  }
  const rest = shown.slice(cursor);
  if (highlight.length) {
    const escaped = highlight.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const pieces = rest.split(new RegExp(`(${escaped})`, "g"));
    parts.push(...pieces.map((p, i) => (highlight.includes(p) ? <span key={`h${i}`} className="swapped">{p}</span> : p)));
  } else {
    parts.push(rest);
  }
  return (
    <span className="whitespace-pre-wrap">
      {parts}
      {shown.length < text.length && (
        <button type="button" onClick={onExpand} className="ml-1 text-muted hover:underline">
          …more
        </button>
      )}
    </span>
  );
}

function Avatar() {
  return <span className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-accent to-lands" aria-hidden />;
}

function Icons({ vertical = false }: { vertical?: boolean }) {
  const icon = (d: string, label: string) => (
    <svg key={label} viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-label={label} role="img">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const set = [
    icon("M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z", "Like"),
    icon("M4 5h16v11H8l-4 4z", "Comment"),
    icon("M4 12l16-8-6 16-2-6z", "Share"),
  ];
  return <div className={`flex ${vertical ? "flex-col gap-5" : "gap-4"}`}>{set}</div>;
}

export function FeedPreview({
  original,
  rewritten,
  refs,
  verdicts,
  swapNames,
  media,
  audience,
}: {
  original: string;
  rewritten: string;
  refs: Located[];
  verdicts: Record<string, Verdict | "pending">;
  swapNames: string[];
  media?: string;
  audience: string;
}) {
  const [format, setFormat] = useState<Format>("photo");
  const [after, setAfter] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const f = FORMATS[format];
  const text = after ? rewritten : original;
  const visibleRefs = after ? [] : refs;
  const aboveFold = refs.filter((r) => r.end <= f.fold);
  const foldMisses = aboveFold.filter((r) => verdicts[r.id] === "misses" || verdicts[r.id] === "mixed");

  const caption = (
    <Caption
      text={text}
      refs={visibleRefs}
      verdicts={verdicts}
      fold={f.fold}
      expanded={expanded}
      onExpand={() => setExpanded(true)}
      highlight={after ? swapNames : []}
    />
  );
  const mediaBox = (className: string, label = true) =>
    media ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={media} alt="Post media" className={`${className} object-cover`} />
    ) : (
      <div className={`${className} flex items-end bg-gradient-to-br from-accent via-ink to-misses p-4`}>
        {label && <span className="font-serif text-xl italic text-white/90">for {audience}</span>}
      </div>
    );

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-rule bg-sheet p-6" aria-label="Feed preview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">See it in the feed</h2>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-md border border-rule p-0.5 text-xs" role="tablist" aria-label="Post format">
            {(Object.keys(FORMATS) as Format[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={format === k}
                onClick={() => {
                  setFormat(k);
                  setExpanded(false);
                }}
                className={`rounded px-2.5 py-1 ${format === k ? "bg-ink text-sheet" : "text-muted hover:text-ink"}`}
              >
                {FORMATS[k].label}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border border-rule p-0.5 text-xs" role="tablist" aria-label="Version">
            {[false, true].map((v) => (
              <button
                key={String(v)}
                type="button"
                role="tab"
                aria-selected={after === v}
                onClick={() => {
                  setAfter(v);
                  setExpanded(false);
                }}
                className={`rounded px-2.5 py-1 ${after === v ? "bg-ink text-sheet" : "text-muted hover:text-ink"}`}
              >
                {v ? "With swaps" : "Original"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!after && (
        <p className="text-sm text-muted">
          {aboveFold.length
            ? foldMisses.length
              ? `${foldMisses.map((r) => r.span).join(" and ")} ${foldMisses.length === 1 ? "sits" : "sit"} above the fold, where every scroller sees ${foldMisses.length === 1 ? "it" : "them"}.`
              : `Everything above the fold lands with ${audience}.`
            : "No references above the fold; most people won't reach them."}{" "}
          <span className="text-xs">(Fold lengths are approximate.)</span>
        </p>
      )}

      <div className="flex justify-center rounded-lg bg-desk p-4 sm:p-6">
        {format === "photo" && (
          <article className="w-full max-w-[380px] overflow-hidden rounded-lg border border-rule bg-sheet text-[14px]">
            <header className="flex items-center gap-2 p-3">
              <Avatar />
              <span className="font-semibold">yourbrand</span>
            </header>
            {mediaBox("aspect-square w-full")}
            <div className="flex flex-col gap-2 p-3">
              <Icons />
              <p>
                <span className="mr-1 font-semibold">yourbrand</span>
                {caption}
              </p>
            </div>
          </article>
        )}
        {format === "video" && (
          <article className="relative aspect-[9/16] w-full max-w-[300px] overflow-hidden rounded-2xl bg-ink text-white">
            {mediaBox("absolute inset-0 h-full w-full opacity-80", false)}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pr-14 text-[13px] leading-snug [&_.swapped]:text-ink">
              <p className="mb-1 font-semibold">@yourbrand</p>
              <p>{caption}</p>
            </div>
            <div className="absolute bottom-6 right-3 text-white">
              <Icons vertical />
            </div>
          </article>
        )}
        {format === "pro" && (
          <article className="w-full max-w-[520px] rounded-lg border border-rule bg-sheet p-4 text-[14px] leading-relaxed">
            <header className="mb-3 flex items-center gap-2">
              <Avatar />
              <div className="flex flex-col leading-tight">
                <span className="font-semibold">Your Brand</span>
                <span className="text-xs text-muted">Promoted</span>
              </div>
            </header>
            <p className="mb-3">{caption}</p>
            {mediaBox("aspect-video w-full rounded")}
            <div className="mt-3 border-t border-rule pt-2 text-muted">
              <Icons />
            </div>
          </article>
        )}
        {format === "micro" && (
          <article className="flex w-full max-w-[520px] gap-3 rounded-lg border border-rule bg-sheet p-4 text-[15px] leading-snug">
            <Avatar />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span>
                <span className="font-semibold">Your Brand</span> <span className="text-muted">@yourbrand · 1m</span>
              </span>
              <p>{caption}</p>
              {media && mediaBox("aspect-video w-full rounded-xl")}
              <div className="flex items-center justify-between text-muted">
                <Icons />
                <span className={`font-mono text-xs ${text.length > (f.limit ?? Infinity) ? "text-misses" : ""}`}>
                  {text.length}/{f.limit}
                </span>
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
