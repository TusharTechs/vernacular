"use client";

import type { Verdict } from "@/lib/vernacular/types";
import type { Located } from "./copy-view";
import type { Frame, StoryboardRead } from "./media-input";

const CHIP: Record<Verdict | "pending", string> = {
  lands: "border-lands/40 bg-lands-soft text-lands",
  mixed: "border-mixed/40 bg-mixed-soft text-mixed",
  misses: "border-misses/40 bg-misses-soft text-misses",
  unmeasured: "border-rule bg-desk text-unmeasured",
  pending: "border-rule bg-desk text-muted animate-pulse",
};

/** Frames in order, each with the verdicts of the references found in its shot. */
export function Filmstrip({
  text,
  frames,
  shots,
  refs,
  verdicts,
  selectedId,
  onSelect,
}: {
  text: string;
  frames: Frame[];
  shots: StoryboardRead["shots"];
  /** References positioned in `text`, so each can be placed in the shot whose note contains it. */
  refs: Located[];
  verdicts: Record<string, Verdict | "pending">;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ol className="flex snap-x gap-3 overflow-x-auto pb-2" aria-label="Frames and their references">
      {shots.map((shot) => {
        const frame = frames[shot.index];
        const start = text.indexOf(shot.note);
        const end = start + shot.note.length;
        const inShot = start < 0 ? [] : refs.filter((r) => r.start >= start && r.end <= end);
        const worst = inShot.map((r) => verdicts[r.id]).find((v) => v === "misses") ?? inShot.map((r) => verdicts[r.id]).find((v) => v === "mixed");
        return (
          <li key={shot.index} className="flex w-56 shrink-0 snap-start flex-col gap-2">
            <div
              className={`relative overflow-hidden rounded-md border-2 ${
                worst === "misses" ? "border-misses" : worst === "mixed" ? "border-mixed" : inShot.length ? "border-lands" : "border-rule"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {frame && <img src={frame.src} alt={shot.note} className="aspect-video w-full object-cover" />}
              <span className="absolute left-1.5 top-1.5 rounded bg-ink/80 px-1.5 py-px font-mono text-[10px] text-sheet">{shot.label}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {inShot.length ? (
                inShot.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className={`rounded-full border px-2 py-0.5 text-xs ${CHIP[verdicts[r.id] ?? "pending"]} ${selectedId === r.id ? "ring-2 ring-accent" : ""}`}
                  >
                    {r.span}
                  </button>
                ))
              ) : (
                <span className="text-xs text-muted">No named references</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
