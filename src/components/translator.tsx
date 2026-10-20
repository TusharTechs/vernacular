"use client";

import { useRef, useState } from "react";
import type { TranslateEvent } from "@/lib/vernacular/translate";
import type { Verdict } from "@/lib/vernacular/types";
import { streamPost } from "./use-check";

interface Row {
  audience: string;
  percentile: number | null;
  verdict: Verdict;
  keep?: boolean;
  name?: string | null;
  to?: number | null;
  why?: string;
}

const EXAMPLES = ["Seinfeld", "Frank Sinatra", "Olive Garden", "Top Gun", "Fleetwood Mac", "Patagonia", "Jeopardy!"];
const AUDIENCES = ["Gen Z Latin-pop fans", "30–34 hip-hop heads", "25–29 indie & A24 fans", "45–54 country fans", "55+ classic-rock fans"];
const VERDICT_STROKE: Record<Verdict, string> = { lands: "stroke-lands", mixed: "stroke-mixed", misses: "stroke-misses", unmeasured: "stroke-unmeasured" };

const W = 900;
const H = 540;
const CX = W / 2;
const CY = H / 2;
const R = 180;

function wrap(s: string, n = 18) {
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
  return lines.slice(0, 3);
}

export function Translator() {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<{ name: string; role: string; entityType: string } | null>(null);
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const run = async (q = query) => {
    if (!q.trim()) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setQuery(q);
    setSubject(null);
    setRows({});
    setError(null);
    setCopied(false);
    setBusy(true);
    const err = await streamPost<TranslateEvent>("/api/translate", { query: q }, ctrl.signal, (e) => {
      if (e.type === "subject") setSubject({ name: e.name, role: e.role, entityType: e.entityType });
      if (e.type === "scored") setRows((r) => ({ ...r, [e.index]: { audience: e.audience, percentile: e.percentile, verdict: e.verdict } }));
      if (e.type === "translation") setRows((r) => ({ ...r, [e.index]: { ...r[e.index], keep: e.keep, name: e.name, to: e.percentile, why: e.why } }));
      if (e.type === "error") setError(e.message);
    });
    if (err) setError(err);
    setBusy(false);
  };

  const done = subject && AUDIENCES.every((_, i) => rows[i]?.why);
  const shareText = subject
    ? `${subject.name}, translated by Vernacular:\n${AUDIENCES.map((a, i) => {
        const r = rows[i];
        return `• ${a}: ${r?.keep ? `${subject.name} (already lands)` : (r?.name ?? "no clean equivalent")}`;
      }).join("\n")}`
    : "";

  return (
    <div className="flex flex-col gap-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={80}
            placeholder="Type any reference: a show, artist, brand, film, place…"
            aria-label="Reference to translate"
            className="min-w-0 flex-1 rounded-xl border border-rule bg-sheet px-4 py-3 font-serif text-xl outline-none focus:border-accent"
          />
          <button type="submit" disabled={busy || !query.trim()} className="rounded-xl bg-ink px-5 py-3 text-sm font-medium text-sheet disabled:opacity-40">
            {busy ? "Translating…" : "Translate"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Try</span>
          {EXAMPLES.map((x) => (
            <button key={x} type="button" disabled={busy} onClick={() => run(x)} className="rounded-full border border-rule px-3 py-1 text-muted hover:border-accent hover:text-ink">
              {x}
            </button>
          ))}
        </div>
      </form>
      {error && <p role="alert" className="text-sm text-misses">{error}</p>}

      {(subject || busy) && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-rule bg-sheet p-2">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={subject ? `${subject.name} translated for five audiences` : "Translating"}>
              <circle cx={CX} cy={CY} r={R} fill="none" className="stroke-rule" strokeDasharray="2 6" />
              {AUDIENCES.map((a, i) => {
                const ang = -Math.PI / 2 + (i * 2 * Math.PI) / AUDIENCES.length;
                const x = CX + R * Math.cos(ang);
                const y = CY + R * Math.sin(ang);
                const r = rows[i];
                const right = Math.cos(ang) > 0.2;
                const left = Math.cos(ang) < -0.2;
                const anchor = right ? "start" : left ? "end" : "middle";
                const lx = x + (right ? 16 : left ? -16 : 0);
                const ly = y + (Math.sin(ang) < -0.5 ? -74 : 26);
                const final = r?.why ? (r.keep ? subject?.name : r.name) : null;
                return (
                  <g key={a}>
                    <line
                      x1={CX}
                      y1={CY}
                      x2={x}
                      y2={y}
                      className={`${r ? VERDICT_STROKE[r.why ? (r.keep || r.name ? "lands" : "unmeasured") : r.verdict] : "stroke-rule"} compass-spoke`}
                      strokeWidth={r?.why && (r.keep || r.name) ? 3 : 1.5}
                      strokeDasharray={r?.why ? undefined : "4 5"}
                    />
                    <circle cx={x} cy={y} r={r?.why ? 9 : 6} className={r?.why && (r.keep || r.name) ? "fill-lands" : r ? "fill-mixed" : "fill-rule"}>
                      {!r && busy && <animate attributeName="r" values="5;8;5" dur="1.2s" repeatCount="indefinite" />}
                    </circle>
                    <text x={lx} y={ly} textAnchor={anchor} className="fill-muted" fontSize={15} letterSpacing={0.4}>
                      {a.toUpperCase()}
                    </text>
                    {r && (
                      <text x={lx} y={ly + 19} textAnchor={anchor} className={r.verdict === "lands" ? "fill-lands" : r.verdict === "misses" ? "fill-misses" : "fill-mixed"} fontSize={13} fontFamily="var(--font-data)">
                        {subject?.name} · {r.percentile === null ? "n/a" : `p${r.percentile}`} · {r.verdict}
                      </text>
                    )}
                    {final !== null && final !== undefined && (
                      <text x={lx} y={ly + 46} textAnchor={anchor} className="compass-word fill-ink" fontSize={26} fontStyle="italic" fontFamily="var(--font-copy)">
                        {r?.keep ? "✓ " : "→ "}
                        {final}
                        {!r?.keep && r?.to !== null && r?.to !== undefined && (
                          <tspan className="fill-lands" fontSize={14} fontStyle="normal" fontFamily="var(--font-data)">{`  p${r.to}`}</tspan>
                        )}
                      </text>
                    )}
                    {r?.why && !final && (
                      <text x={lx} y={ly + 46} textAnchor={anchor} className="fill-muted" fontSize={16} fontStyle="italic">
                        no clean equivalent
                      </text>
                    )}
                  </g>
                );
              })}
              <circle cx={CX} cy={CY} r={86} className="fill-ink" />
              {subject ? (
                <>
                  {wrap(subject.name, 14).map((l, k, all) => (
                    <text key={k} x={CX} y={CY - (all.length - 1) * 11 + k * 22 - 4} textAnchor="middle" className="fill-sheet" fontSize={24} fontStyle="italic" fontFamily="var(--font-copy)">
                      {l}
                    </text>
                  ))}
                  <text x={CX} y={CY + 34} textAnchor="middle" className="fill-sheet" opacity={0.6} fontSize={10} letterSpacing={1}>
                    {subject.entityType.replace("_", " ").toUpperCase()}
                  </text>
                </>
              ) : (
                <text x={CX} y={CY + 5} textAnchor="middle" className="fill-sheet" opacity={0.7} fontSize={13}>
                  Reading…
                </text>
              )}
            </svg>
          </div>

          <div className="flex flex-col gap-3">
            {subject && (
              <p className="text-sm text-muted">
                <span className="font-serif text-lg italic text-ink">{subject.name}</span> usually stands for {subject.role}. Here&apos;s who it
                lands with, and what to say instead for everyone else.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {AUDIENCES.map((a, i) => {
                const r = rows[i];
                return (
                  <li key={a} className="flex flex-col gap-1 rounded-xl border border-rule bg-sheet p-3">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-muted">{a}</span>
                      {r && <span className="font-mono text-[11px] text-muted">original {r.percentile === null ? "n/a" : `p${r.percentile}`}</span>}
                    </span>
                    {r?.why ? (
                      <>
                        <span className="font-serif text-lg italic">
                          {r.keep ? `✓ ${subject?.name}` : r.name ? `→ ${r.name}` : "No clean equivalent"}
                          {!r.keep && r.to !== null && r.to !== undefined && <span className="ml-2 font-mono text-xs not-italic text-lands">p{r.to}</span>}
                        </span>
                        <span className="text-xs text-muted">{r.why}</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted">{r ? "Finding what lands…" : "Scoring…"}</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {done && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareText);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
                className="self-start rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink"
              >
                {copied ? "Copied" : "Copy the translation"}
              </button>
            )}
          </div>
        </div>
      )}

      {!subject && !busy && (
        <p className="rounded-2xl border border-dashed border-rule p-8 text-center text-muted">
          Every audience has its own Seinfeld. Type a reference and Qloo finds what it means to five different audiences.
        </p>
      )}
    </div>
  );
}
