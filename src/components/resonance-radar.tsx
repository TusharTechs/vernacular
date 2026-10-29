"use client";

// Resonance radar for the Culture Translator. Each audience is an axis; distance
// from the hub is a Qloo percentile for that audience, over the misses / mixed /
// lands bands. The original reference draws one shape, its translations another,
// and the chart morphs between them. Axes are buttons linked to the cards beside it.

import { useEffect, useRef, useState } from "react";
import type { Verdict } from "@/lib/vernacular/types";

export interface RadarRow {
  audience: string;
  percentile: number | null;
  verdict: Verdict;
  keep?: boolean;
  name?: string | null;
  to?: number | null;
  why?: string;
}

const W = 900;
const H = 660;
const CX = W / 2;
const CY = H / 2 + 6;
const HUB = 66;
const RMAX = 220;
const rad = (p: number) => HUB + (Math.max(0, Math.min(100, p)) / 100) * (RMAX - HUB);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Where each audience ends up after translating: the swap's score, or the original's if kept or nothing fits. */
export function afterScore(r: RadarRow | undefined): number | null {
  if (!r) return null;
  if (r.why && !r.keep && r.name && r.to !== null && r.to !== undefined) return r.to;
  return r.percentile;
}

function wrap(s: string, n: number) {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > n && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

export function ResonanceRadar({
  subject,
  audiences,
  rows,
  busy,
  active,
  onHover,
  onPick,
}: {
  subject: { name: string; entityType: string } | null;
  audiences: string[];
  rows: Record<number, RadarRow>;
  busy: boolean;
  active: number | null;
  onHover: (i: number | null) => void;
  onPick: (i: number) => void;
}) {
  const done = !!subject && audiences.every((_, i) => rows[i]?.why);
  const [t, setT] = useState(0); // 0 = original, 1 = translated
  const [view, setView] = useState<"before" | "after">("before");
  const raf = useRef<number | null>(null);
  const played = useRef<string | null>(null);

  const animateTo = (target: 0 | 1) => {
    setView(target ? "after" : "before");
    if (raf.current) cancelAnimationFrame(raf.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(target);
      return;
    }
    const from = t;
    const start = performance.now();
    const dur = 1400;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      setT(from + (target - from) * ease(k));
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  // A new subject starts from its original shape; once every translation is in, play the morph once.
  useEffect(() => {
    if (!subject) return;
    if (!done) {
      setT(0);
      setView("before");
      return;
    }
    if (played.current === subject.name) return;
    played.current = subject.name;
    const id = window.setTimeout(() => animateTo(1), 500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject?.name, done]);
  useEffect(() => () => void (raf.current && cancelAnimationFrame(raf.current)), []);

  const n = audiences.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const at = (i: number, p: number) => [CX + rad(p) * Math.cos(ang(i)), CY + rad(p) * Math.sin(ang(i))] as const;

  const before = audiences.map((_, i) => rows[i]?.percentile ?? null);
  const after = audiences.map((_, i) => afterScore(rows[i]));
  const now = audiences.map((_, i) => {
    const b = before[i];
    const a = after[i] ?? b;
    if (b === null) return a === null ? null : a * t;
    return b + ((a ?? b) - b) * t;
  });
  const shape = (vals: (number | null)[]) => vals.map((v, i) => at(i, v ?? 0).join(",")).join(" ");
  const haveShape = before.some((v) => v !== null);

  const lands = (vals: (number | null)[]) => vals.filter((v) => v !== null && v >= 65).length;
  const mean = (vals: (number | null)[]) => {
    const m = vals.filter((v): v is number => v !== null);
    return m.length ? Math.round(m.reduce((s, v) => s + v, 0) / m.length) : null;
  };
  const sel = active !== null ? rows[active] : undefined;
  const selName = sel ? (sel.why ? (sel.keep ? subject?.name : (sel.name ?? null)) : null) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-2">
        <div className="flex rounded-full border border-rule p-0.5 text-xs" role="group" aria-label="Show">
          {(["before", "after"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              disabled={!done}
              onClick={() => animateTo(v === "after" ? 1 : 0)}
              className={`rounded-full px-3 py-1 transition-colors disabled:opacity-40 ${view === v ? "bg-ink text-sheet" : "text-muted hover:text-ink"}`}
            >
              {v === "before" ? `As written: ${subject?.name ?? "…"}` : "Translated"}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!done}
          onClick={() => {
            setT(0);
            window.setTimeout(() => animateTo(1), 60);
          }}
          className="rounded-full border border-rule px-3 py-1 text-xs text-muted hover:border-ink hover:text-ink disabled:opacity-40"
        >
          ▶ Replay
        </button>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-manipulation" role="group" aria-label={subject ? `${subject.name}: Qloo percentile for five audiences, as written and translated` : "Translating"}>
        <defs>
          <radialGradient id="radar-glow">
            <stop offset="0" stopColor="var(--lands)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--lands)" stopOpacity="0.04" />
          </radialGradient>
        </defs>

        {/* Bands: misses inside p35, mixed to p65, lands beyond. */}
        <circle cx={CX} cy={CY} r={rad(100)} className="fill-lands-soft" opacity={0.55} />
        <circle cx={CX} cy={CY} r={rad(65)} className="fill-mixed-soft" opacity={0.6} />
        <circle cx={CX} cy={CY} r={rad(35)} className="fill-misses-soft" opacity={0.65} />
        {[35, 65, 100].map((p) => (
          <circle key={p} cx={CX} cy={CY} r={rad(p)} fill="none" className="stroke-rule" strokeDasharray={p === 100 ? undefined : "3 5"} />
        ))}
        {/* Axes. */}
        {audiences.map((a, i) => {
          const [x, y] = at(i, 100);
          return (
            <line
              key={a}
              x1={CX + HUB * Math.cos(ang(i))}
              y1={CY + HUB * Math.sin(ang(i))}
              x2={x}
              y2={y}
              className={active === i ? "stroke-ink" : "stroke-rule"}
              strokeWidth={active === i ? 2 : 1}
            />
          );
        })}

        {/* The original's footprint stays as a ghost once the translation takes over. */}
        {haveShape && t > 0.02 && <polygon points={shape(before)} className="fill-misses stroke-misses" fillOpacity={0.06} strokeOpacity={0.5} strokeDasharray="4 4" strokeWidth={1.5} />}
        {haveShape && (
          <polygon
            points={shape(now)}
            fill={t > 0.5 ? "url(#radar-glow)" : undefined}
            className={t > 0.5 ? "stroke-lands" : "fill-mixed stroke-mixed"}
            fillOpacity={t > 0.5 ? 1 : 0.16}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        )}

        {/* Band names sit in the gap between the first two axes, clear of every dot. */}
        <g className="fill-muted stroke-sheet font-mono" fontSize={11} textAnchor="middle" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
          {([["lands p65+", 82], ["mixed", 50], ["misses", 18]] as const).map(([label, p]) => {
            const a = -Math.PI / 2 + Math.PI / audiences.length;
            return (
              <text key={label} x={CX + rad(p) * Math.cos(a)} y={CY + rad(p) * Math.sin(a) + 4}>
                {label}
              </text>
            );
          })}
        </g>

        {/* Vertices and labels, one button per audience. */}
        {audiences.map((a, i) => {
          const r = rows[i];
          const v = now[i];
          const [x, y] = at(i, v ?? 0);
          const [lx0, ly0] = at(i, 100);
          const cos = Math.cos(ang(i));
          const sin = Math.sin(ang(i));
          const right = cos > 0.2;
          const left = cos < -0.2;
          const anchor = right ? "start" : left ? "end" : "middle";
          const lx = lx0 + (right ? 18 : left ? -18 : 0);
          const ly = ly0 + (sin < -0.5 ? -58 : sin > 0.5 ? 30 : -14);
          const final = r?.why ? (r.keep ? subject?.name : r.name) : null;
          const showAfter = t > 0.5 && !!r?.why;
          const tone = v === null ? "fill-unmeasured" : v >= 65 ? "fill-lands" : v < 35 ? "fill-misses" : "fill-mixed";
          const dim = active !== null && active !== i;
          return (
            <g
              key={a}
              role="button"
              tabIndex={0}
              aria-pressed={active === i}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(i)}
              onBlur={() => onHover(null)}
              onClick={() => onPick(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPick(i);
                }
              }}
              className="cursor-pointer outline-none [&:focus-visible_.radar-hit]:stroke-accent"
              opacity={dim ? 0.45 : 1}
              style={{ transition: "opacity 200ms ease" }}
            >
              <circle cx={lx0} cy={ly0} r={34} className="radar-hit" fill="transparent" stroke="transparent" strokeWidth={2} />
              {r && v !== null && (
                <>
                  {active === i && <circle cx={x} cy={y} r={17} className={tone} opacity={0.22} />}
                  <circle cx={x} cy={y} r={active === i ? 10 : 8} className={`${tone} stroke-sheet`} strokeWidth={3} />
                </>
              )}
              {!r && busy && <circle cx={at(i, 50)[0]} cy={at(i, 50)[1]} r={6} className="fill-rule compass-pulse" />}
              <text x={lx} y={ly} textAnchor={anchor} className="fill-muted" fontSize={15} letterSpacing={0.5}>
                {a.toUpperCase()}
              </text>
              {r && (
                <text x={lx} y={ly + 26} textAnchor={anchor} fontSize={23} fontStyle="italic" fontFamily="var(--font-copy)" className="fill-ink">
                  {showAfter && final ? `${r.keep ? "✓ " : "→ "}${final}` : (subject?.name ?? "")}
                  <tspan
                    fontSize={14}
                    fontStyle="normal"
                    fontFamily="var(--font-data)"
                    className={(showAfter ? (afterScore(r) ?? 0) : (r.percentile ?? 0)) >= 65 ? "fill-lands" : (showAfter ? (afterScore(r) ?? 0) : (r.percentile ?? 0)) < 35 ? "fill-misses" : "fill-mixed"}
                  >
                    {`  p${showAfter ? (afterScore(r) ?? "–") : (r.percentile ?? "–")}`}
                  </tspan>
                </text>
              )}
              {r?.why && !final && t > 0.5 && (
                <text x={lx} y={ly + 46} textAnchor={anchor} className="fill-muted" fontSize={14} fontStyle="italic">
                  no clean equivalent
                </text>
              )}
            </g>
          );
        })}

        {/* Hub: the subject, or the picked audience's translation. */}
        <circle cx={CX} cy={CY} r={HUB} className="fill-ink" />
        {sel && active !== null ? (
          <>
            {wrap(selName ?? subject?.name ?? "", 12).map((l, k, all) => (
              <text key={k} x={CX} y={CY - 4 - (all.length - 1) * 18 + k * 18} textAnchor="middle" className="fill-sheet" fontSize={all.length > 1 ? 16 : 19} fontStyle="italic" fontFamily="var(--font-copy)">
                {l}
              </text>
            ))}
            <text x={CX} y={CY + 22} textAnchor="middle" className="fill-sheet" opacity={0.65} fontSize={9} letterSpacing={0.8}>
              {sel.why ? (sel.keep ? "ALREADY LANDS" : selName ? "SAY THIS INSTEAD" : "NO CLEAN EQUIVALENT") : "SCORING"}
            </text>
            {sel.percentile !== null && (
              <text x={CX} y={CY + 38} textAnchor="middle" className="fill-sheet font-mono" opacity={0.85} fontSize={11}>
                {sel.why && !sel.keep && selName ? `p${sel.percentile} → p${afterScore(sel) ?? "–"}` : `p${sel.percentile}`}
              </text>
            )}
          </>
        ) : subject ? (
          <>
            {wrap(subject.name, 12).map((l, k, all) => (
              <text key={k} x={CX} y={CY - (all.length - 1) * 10 + k * 20 + 2} textAnchor="middle" className="fill-sheet" fontSize={21} fontStyle="italic" fontFamily="var(--font-copy)">
                {l}
              </text>
            ))}
            <text x={CX} y={CY + 36} textAnchor="middle" className="fill-sheet" opacity={0.6} fontSize={9.5} letterSpacing={1}>
              {subject.entityType.replace("_", " ").toUpperCase()}
            </text>
          </>
        ) : (
          <text x={CX} y={CY + 5} textAnchor="middle" className="fill-sheet" opacity={0.7} fontSize={13}>
            Reading…
          </text>
        )}
      </svg>

      {haveShape && (
        <p className="px-3 pb-3 text-sm text-muted" aria-live="polite">
          {subject?.name} lands with <span className="font-mono text-ink">{lands(before)}</span> of {n} audiences
          {mean(before) !== null && (
            <>
              {" "}
              (average <span className="font-mono text-ink">p{mean(before)}</span>)
            </>
          )}
          {done && (
            <>
              ; translated, <span className="font-mono text-lands">{lands(after)}</span> of {n}
              {mean(after) !== null && (
                <>
                  {" "}
                  (<span className="font-mono text-lands">p{mean(after)}</span>)
                </>
              )}
            </>
          )}
          . Click an audience to see its translation.
        </p>
      )}
    </div>
  );
}
