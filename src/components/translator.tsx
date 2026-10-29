"use client";

import { useEffect, useRef, useState } from "react";
import type { TranslateEvent } from "@/lib/vernacular/translate";
import { ResonanceRadar, type RadarRow } from "./resonance-radar";
import { streamPost } from "./use-check";

type Row = RadarRow;

const EXAMPLES = ["Seinfeld", "Frank Sinatra", "Olive Garden", "Top Gun", "Fleetwood Mac", "Patagonia", "Jeopardy!"];
const AUDIENCES = ["Gen Z Latin-pop fans", "30–34 hip-hop heads", "25–29 indie & A24 fans", "45–54 country fans", "55+ classic-rock fans"];
export function Translator() {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<{ name: string; role: string; entityType: string } | null>(null);
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = hover ?? pinned;
  const abort = useRef<AbortController | null>(null);
  const touched = useRef(false);

  const apply = (e: TranslateEvent) => {
    if (e.type === "subject") setSubject({ name: e.name, role: e.role, entityType: e.entityType });
    if (e.type === "scored") setRows((r) => ({ ...r, [e.index]: { audience: e.audience, percentile: e.percentile, verdict: e.verdict } }));
    if (e.type === "translation") setRows((r) => ({ ...r, [e.index]: { ...r[e.index], keep: e.keep, name: e.name, to: e.percentile, why: e.why } }));
    if (e.type === "error") setError(e.message);
  };

  // Open on a saved real run, so the compass is there before anyone waits.
  useEffect(() => {
    let alive = true;
    fetch("/api/translate/sample")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { checkedAt: string; query: string; events: TranslateEvent[] } | null) => {
        if (!alive || !d || touched.current) return;
        setQuery(d.query);
        d.events.forEach(apply);
        setSavedAt(d.checkedAt);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const run = async (q = query) => {
    if (!q.trim()) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    touched.current = true;
    setQuery(q);
    setSubject(null);
    setRows({});
    setError(null);
    setCopied(false);
    setSavedAt(null);
    setPinned(null);
    setBusy(true);
    const err = await streamPost<TranslateEvent>("/api/translate", { query: q }, ctrl.signal, apply);
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
      {savedAt && (
        <p className="text-sm text-muted">
          Example: a saved run on Qloo, {new Date(savedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}. Press Translate to run it
          live, or try another reference.
        </p>
      )}

      {(subject || busy) && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="self-start rounded-2xl border border-rule bg-sheet p-2 lg:sticky lg:top-4">
            <ResonanceRadar
              subject={subject}
              audiences={AUDIENCES}
              rows={rows}
              busy={busy}
              active={active}
              onHover={setHover}
              onPick={(i) => setPinned((p) => (p === i ? null : i))}
            />
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
                  <li
                    key={a}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setPinned((p) => (p === i ? null : i))}
                    className={`flex cursor-pointer flex-col gap-1 rounded-xl border bg-sheet p-3 transition-colors ${active === i ? "border-ink shadow-sm" : "border-rule"}`}
                  >
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
