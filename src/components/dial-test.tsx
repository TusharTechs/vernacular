"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { alignWords, curve, timeAt, type Beat, type TimedWord } from "@/lib/vernacular/dial";
import type { Verdict } from "@/lib/vernacular/types";

export interface DialRef {
  start: number;
  end: number;
  name: string;
  percentile: number | null;
  verdict: Verdict;
}

export interface Take {
  key: string;
  label: string;
  text: string;
  refs: DialRef[];
}

interface Voiced {
  url: string;
  words: TimedWord[];
  duration: number;
  beats: (Beat & { ref: DialRef })[];
}

// The stage is deliberately dark in both themes, like a screening room.
const STAGE = {
  bg: "#10132a",
  ink: "#f3f4fb",
  dim: "rgba(243,244,251,0.32)",
  grid: "rgba(243,244,251,0.12)",
  lands: "#5ccf8e",
  mixed: "#e6b35a",
  misses: "#ff8566",
  unmeasured: "#9aa1b2",
};
const TAKE_COLORS = ["#ff8566", "#8d9cff", "#5ccf8e"];
const W = 640;
const H = 230;

function useVoices(takes: Take[]) {
  const [voiced, setVoiced] = useState<Record<string, Voiced>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await Promise.all(
        takes.map(async (take) => {
          const res = await fetch("/api/voice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: take.text }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? "Couldn't generate the voice.");
          const words = alignWords(take.text, body.words, body.duration);
          const beats = take.refs.map((ref) => ({ t: timeAt(words, ref.start), score: ref.percentile, ref }));
          return [take.key, { url: `data:audio/mpeg;base64,${body.audio}`, words, duration: body.duration, beats }] as const;
        }),
      );
      const out = Object.fromEntries(entries);
      setVoiced(out);
      return out as Record<string, Voiced>;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the voice.");
      return null;
    } finally {
      setLoading(false);
    }
  };
  return { voiced, loading, error, load };
}

export function DialTest({ takes, audience }: { takes: Take[]; audience: string }) {
  const { voiced, loading, error, load } = useVoices(takes);
  const [playing, setPlaying] = useState<string | null>(null);
  const [heard, setHeard] = useState<string[]>([]);
  const [t, setT] = useState(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const raf = useRef(0);
  const queue = useRef<string[]>([]);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      audio.current?.pause();
    },
    [],
  );

  const playTake = (key: string, v: Record<string, Voiced>) => {
    audio.current?.pause();
    const el = new Audio(v[key].url);
    audio.current = el;
    setPlaying(key);
    setT(0);
    const tick = () => {
      setT(el.currentTime);
      if (!el.paused && !el.ended) raf.current = requestAnimationFrame(tick);
    };
    el.onplay = () => (raf.current = requestAnimationFrame(tick));
    el.onended = () => {
      setT(v[key].duration);
      setHeard((h) => (h.includes(key) ? h : [...h, key]));
      const next = queue.current.shift();
      if (next) window.setTimeout(() => playTake(next, v), 900);
      else setPlaying(null);
    };
    el.play().catch(() => setPlaying(null));
  };

  const start = async (keys = takes.map((x) => x.key)) => {
    const v = Object.keys(voiced).length === takes.length ? voiced : await load();
    if (!v) return;
    setHeard((h) => h.filter((k) => !keys.includes(k)));
    queue.current = keys.slice(1);
    playTake(keys[0], v);
  };
  const stop = () => {
    queue.current = [];
    audio.current?.pause();
    cancelAnimationFrame(raf.current);
    setPlaying(null);
  };

  const maxDuration = Math.max(1, ...Object.values(voiced).map((v) => v.duration));
  const x = (s: number) => (s / maxDuration) * W;
  const y = (v: number) => H - (v / 100) * H;
  const curves = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(voiced).map(([k, v]) => [k, curve(v.beats, v.duration).map(([s, val]) => `${x(s).toFixed(1)},${y(val).toFixed(1)}`).join(" ")]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voiced, maxDuration],
  );

  const current = playing ? takes.find((k) => k.key === playing)! : takes.find((k) => heard.includes(k.key)) ?? takes[0];
  const cv = voiced[current.key];
  const activeBeat = playing && cv ? [...cv.beats].reverse().find((b) => b.t <= t && t - b.t < 2.6) : undefined;
  const done = takes.every((k) => heard.includes(k.key)) && !playing;
  const avg = (take: Take) => {
    const m = take.refs.filter((r) => r.percentile !== null);
    return m.length ? Math.round(m.reduce((s, r) => s + r.percentile!, 0) / m.length) : null;
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-rule bg-sheet p-6" aria-label="Dial Test">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold">Dial Test</h2>
          <p className="max-w-xl text-sm text-muted">
            Hear the copy read aloud and watch {audience} react in real time, then hear it again with the swaps.
          </p>
        </div>
        {playing ? (
          <button type="button" onClick={stop} className="rounded-lg border border-rule px-4 py-2 text-sm hover:border-ink">
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => start()}
            disabled={loading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Warming up the voice…" : done ? "Play again" : "▶ Play the Dial Test"}
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-misses">{error}</p>}

      <div className="flex flex-col gap-5 overflow-hidden rounded-xl p-5 sm:p-7" style={{ background: STAGE.bg, color: STAGE.ink }}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {takes.map((k, i) => (
            <button
              key={k.key}
              type="button"
              disabled={loading}
              onClick={() => start([k.key])}
              className="flex items-center gap-2 rounded-full px-3 py-1 transition-opacity"
              style={{ border: `1px solid ${current.key === k.key ? TAKE_COLORS[i] : STAGE.grid}`, opacity: current.key === k.key ? 1 : 0.7 }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: TAKE_COLORS[i] }} />
              {k.label}
              {avg(k) !== null && <span className="font-mono opacity-70">avg p{avg(k)}</span>}
            </button>
          ))}
          {playing && cv && (
            <span className="ml-auto font-mono opacity-60">
              {t.toFixed(1)}s / {cv.duration.toFixed(1)}s
            </span>
          )}
        </div>

        <p className="min-h-[5.5em] font-serif text-xl leading-relaxed sm:text-2xl" aria-live="off">
          <Karaoke take={current} words={cv?.words} t={playing === current.key ? t : heard.includes(current.key) ? Infinity : -1} active={activeBeat?.ref} />
        </p>

        <div className="relative h-9">
          {activeBeat && (
            <div
              key={`${activeBeat.ref.start}-${playing}`}
              className="dial-pop absolute left-0 top-0 flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
              style={{ background: "rgba(255,255,255,0.08)", border: `1px solid ${STAGE[activeBeat.ref.verdict]}` }}
            >
              <span className="font-serif italic">{activeBeat.ref.name}</span>
              <span className="font-mono text-xs" style={{ color: STAGE[activeBeat.ref.verdict] }}>
                {activeBeat.ref.percentile === null ? "n/a" : `p${activeBeat.ref.percentile}`} · {activeBeat.ref.verdict}
              </span>
            </div>
          )}
        </div>

        <svg viewBox={`0 -26 ${W} ${H + 52}`} className="h-auto w-full" role="img" aria-label="Reaction curves">
          <defs>
            {takes.map((k) => (
              <clipPath key={k.key} id={`dial-clip-${k.key}`}>
                <rect x={0} y={-26} height={H + 52} width={playing === k.key ? x(t) : heard.includes(k.key) ? W : 0} />
              </clipPath>
            ))}
          </defs>
          {[35, 50, 65].map((v) => (
            <g key={v}>
              <line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={STAGE.grid} strokeDasharray={v === 50 ? "0" : "4 4"} />
              <text x={W} y={y(v) - 4} textAnchor="end" fontSize={10} fill={STAGE.dim}>
                {v === 65 ? "lands" : v === 35 ? "misses" : "neutral"}
              </text>
            </g>
          ))}
          {takes.map((k, i) =>
            curves[k.key] ? (
              <g key={k.key} clipPath={`url(#dial-clip-${k.key})`}>
                <polyline points={curves[k.key]} fill="none" stroke={TAKE_COLORS[i]} strokeWidth={2.5} strokeLinejoin="round" />
                {voiced[k.key].beats.map((b, j) =>
                  b.score === null ? null : (
                    <g key={j}>
                      <circle cx={x(b.t)} cy={y(b.score)} r={4} fill={TAKE_COLORS[i]} />
                      <text x={Math.min(W - 30, Math.max(30, x(b.t)))} y={y(b.score) + (b.score > 50 ? -9 : 16)} textAnchor="middle" fontSize={11} fill={STAGE.ink} opacity={0.85}>
                        {b.ref.name}
                      </text>
                    </g>
                  ),
                )}
              </g>
            ) : null,
          )}
          {playing && <line x1={x(t)} x2={x(t)} y1={-26} y2={H + 26} stroke={STAGE.ink} strokeOpacity={0.5} />}
        </svg>

        {done && takes.length > 1 && (
          <p className="text-sm" style={{ color: STAGE.ink }}>
            At the moments that matter, {audience} went from{" "}
            <span className="font-mono" style={{ color: TAKE_COLORS[0] }}>
              p{avg(takes[0]) ?? "–"}
            </span>{" "}
            to{" "}
            <span className="font-mono" style={{ color: TAKE_COLORS[1] }}>
              p{avg(takes[1]) ?? "–"}
            </span>
            .
          </p>
        )}
      </div>

      <p className="text-xs text-muted">
        The voice is AI-generated (OpenAI). The curve isn&apos;t measured emotion: each swing is the Qloo percentile of the reference being spoken at
        that moment, for this audience.
      </p>
    </section>
  );
}

function Karaoke({ take, words, t, active }: { take: Take; words?: TimedWord[]; t: number; active?: DialRef }) {
  if (!words) return <>{take.text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let lastSpoken = t >= 0;
  for (const [i, w] of words.entries()) {
    // Spaces and punctuation take the state of the word before them.
    if (w.start > cursor) parts.push(<span key={`g${i}`} style={{ color: lastSpoken && i > 0 ? STAGE.ink : STAGE.dim }}>{take.text.slice(cursor, w.start)}</span>);
    const ref = take.refs.find((r) => w.start >= r.start && w.end <= r.end);
    const spoken = w.t0 <= t;
    lastSpoken = spoken;
    parts.push(
      <span
        key={i}
        style={{
          color: spoken ? STAGE.ink : STAGE.dim,
          textDecoration: ref ? "underline wavy" : undefined,
          textDecorationColor: ref ? STAGE[ref.verdict] : undefined,
          textUnderlineOffset: 6,
          textShadow: ref && ref === active ? `0 0 18px ${STAGE[ref.verdict]}` : undefined,
        }}
      >
        {take.text.slice(w.start, w.end)}
      </span>,
    );
    cursor = w.end;
  }
  parts.push(<span key="tail" style={{ color: lastSpoken ? STAGE.ink : STAGE.dim }}>{take.text.slice(cursor)}</span>);
  return <>{parts}</>;
}
