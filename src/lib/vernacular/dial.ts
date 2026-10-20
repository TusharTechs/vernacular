// Dial Test maths, shared by the server and the browser. Pure functions only.

export interface TimedWord {
  /** Character range in the text. */
  start: number;
  end: number;
  /** Seconds in the audio. */
  t0: number;
  t1: number;
}

const norm = (w: string) => w.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Give every word of the text a time, using the transcription's word timings.
 * Matching is greedy with a short look-ahead so a misheard or merged word
 * doesn't derail the rest; unmatched words are interpolated between neighbours.
 */
export function alignWords(text: string, spoken: { word: string; start: number; end: number }[], duration: number): TimedWord[] {
  const tokens = [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’*.&-]*/gu)].map((m) => ({ start: m.index!, end: m.index! + m[0].length, key: norm(m[0]) }));
  const times: ({ t0: number; t1: number } | null)[] = tokens.map(() => null);
  let i = 0;
  for (const w of spoken) {
    const k = norm(w.word);
    if (!k) continue;
    for (let j = i; j < Math.min(tokens.length, i + 6); j++) {
      if (tokens[j].key === k || (k.length > 3 && tokens[j].key.startsWith(k)) || (tokens[j].key.length > 3 && k.startsWith(tokens[j].key))) {
        times[j] = { t0: w.start, t1: w.end };
        i = j + 1;
        break;
      }
    }
  }
  // Interpolate gaps linearly between the nearest timed neighbours.
  const out: TimedWord[] = [];
  for (let j = 0; j < tokens.length; j++) {
    let t = times[j];
    if (!t) {
      let a = j - 1;
      while (a >= 0 && !times[a]) a--;
      let b = j + 1;
      while (b < tokens.length && !times[b]) b++;
      const from = a >= 0 ? times[a]!.t1 : 0;
      const to = b < tokens.length ? times[b]!.t0 : duration;
      const span = b - a;
      const t0 = from + ((to - from) * (j - a - 0.5)) / span;
      t = { t0, t1: t0 + Math.max(0.1, (to - from) / span) * 0.8 };
    }
    out.push({ start: tokens[j].start, end: tokens[j].end, ...t });
  }
  return out;
}

/** When the character at `index` is spoken (the word containing or following it). */
export function timeAt(words: TimedWord[], index: number): number {
  const w = words.find((x) => x.end > index) ?? words.at(-1);
  return w ? w.t0 : 0;
}

export interface Beat {
  /** Seconds. */
  t: number;
  /** 0–100 Qloo percentile, or null if unmeasured. */
  score: number | null;
}

/**
 * The reaction curve: neutral 50, and at each reference a swing toward its
 * percentile that rises quickly as it's spoken and fades over a few seconds.
 * It visualises the per-reference scores over time; it is not measured emotion.
 */
export function reactionAt(beats: Beat[], t: number): number {
  let y = 50;
  for (const b of beats) {
    if (b.score === null) continue;
    const dt = t - b.t;
    const k = dt < 0 ? Math.exp(-((dt / 0.35) ** 2)) : Math.exp(-dt / 2.2);
    y += (b.score - 50) * k;
  }
  return Math.max(0, Math.min(100, y));
}

export function curve(beats: Beat[], duration: number, samples = 160): [number, number][] {
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = (duration * i) / samples;
    return [t, reactionAt(beats, t)];
  });
}

/** Verdict for a bare percentile (no age-skew adjustment), matching the scoring thresholds. */
export function verdictOfPercentile(p: number | null): "lands" | "mixed" | "misses" | "unmeasured" {
  if (p === null) return "unmeasured";
  return p >= 65 ? "lands" : p < 35 ? "misses" : "mixed";
}
