"use client";

import type { ExtractedReference, Verdict } from "@/lib/vernacular/types";

export interface Located extends ExtractedReference {
  start: number;
  end: number;
}

/** Position each reference in the text, dropping overlaps. */
export function locate(text: string, refs: ExtractedReference[]): Located[] {
  const out: Located[] = [];
  for (const r of refs) {
    const sentenceAt = text.indexOf(r.sentence);
    const within = sentenceAt >= 0 ? r.sentence.indexOf(r.span) : -1;
    const start = within >= 0 ? sentenceAt + within : text.indexOf(r.span);
    if (start < 0) continue;
    const end = start + r.span.length;
    if (out.some((o) => start < o.end && end > o.start)) continue;
    out.push({ ...r, start, end });
  }
  return out.sort((a, b) => a.start - b.start);
}

export function MarkedCopy({
  text,
  refs,
  verdicts,
  selectedId,
  onSelect,
  compact = false,
}: {
  text: string;
  compact?: boolean;
  refs: Located[];
  verdicts: Record<string, Verdict | "pending">;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const r of refs) {
    if (r.start > cursor) parts.push(text.slice(cursor, r.start));
    parts.push(
      <mark
        key={r.id}
        role="button"
        tabIndex={0}
        data-verdict={verdicts[r.id] ?? "pending"}
        data-selected={selectedId === r.id}
        onClick={() => onSelect(r.id)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(r.id))}
        className="mark bg-transparent text-inherit"
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  }
  parts.push(text.slice(cursor));
  return <p className={`whitespace-pre-wrap font-serif ${compact ? "text-[16px] leading-[1.7]" : "text-[21px] leading-[1.75]"}`}>{parts}</p>;
}

/** Text with replacement names highlighted. */
export function HighlightedNames({ text, names }: { text: string; names: string[] }) {
  if (!names.length) return <>{text}</>;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pieces = text.split(new RegExp(`(${escaped})`, "g"));
  return (
    <>
      {pieces.map((p, i) =>
        names.includes(p) ? (
          <span key={i} className="swapped">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}
