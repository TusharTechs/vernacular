// Turns per-pair results into the numbers the benchmark page shows. Pure, so
// the page and the tests compute exactly the same thing.

import type { Arm, GradedRef, PairResult } from "./types";

export const ARMS = ["original", "claude", "vernacular"] as const;
export type ArmKey = (typeof ARMS)[number];

export interface ArmSummary {
  measured: number;
  /** References that repeat one of the audience's own examples from the brief (scored p100 by definition). */
  echoes: number;
  /** Mean percentile with those echoes left out. */
  meanWithoutEchoes: number | null;
  unmeasured: number;
  meanPercentile: number | null;
  landRate: number | null;
  missRate: number | null;
  /** Share of measured references at p100, the top of the scale, where percentiles can't separate them. */
  topShare: number | null;
  /** Outside check: mean 1–5 recognition from a non-Claude model, when rated. */
  recognition: number | null;
  recognitionWithoutEchoes: number | null;
}

export interface Paired {
  n: number;
  meanDiff: number | null;
  ci: [number, number] | null;
  wins: number;
  ties: number;
  losses: number;
}

export interface Summary {
  pairs: number;
  arms: Record<ArmKey, ArmSummary>;
  byAudience: ({ audienceId: string } & Record<ArmKey, number | null>)[];
  paired: Paired;
  /** The same comparison with echoes of the brief left out of both sides. */
  pairedWithoutEchoes: Paired;
  fidelity: Record<"claude" | "vernacular", { meaning: number | null; natural: number | null }>;
  changes: Record<"claude" | "vernacular", number | null>;
  speed: { meanMs: number | null; meanQlooCalls: number | null };
  /** Per pair, Vernacular's mean recognition minus Claude alone's (a tie is within 0.25 points). */
  recognitionPaired: Paired;
  /** The same, with echoes of the brief left out of both sides. */
  recognitionPairedWithoutEchoes: Paired;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (x: number | null, dp = 1) => (x === null ? null : Math.round(x * 10 ** dp) / 10 ** dp);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
type Echo = (r: GradedRef) => boolean;
const never: Echo = () => false;

function armSummary(arms: Arm[], echoOf: Echo[] = arms.map(() => never)): ArmSummary {
  const refs = arms.flatMap((a) => a.refs);
  const measured = refs.filter((r) => r.percentile !== null);
  const echoes = arms.flatMap((a, i) => a.refs.filter(echoOf[i]));
  const fresh = arms.flatMap((a, i) => a.refs.filter((r) => r.percentile !== null && !echoOf[i](r)));
  return {
    measured: measured.length,
    echoes: echoes.length,
    meanWithoutEchoes: round(mean(fresh.map((r) => r.percentile!))),
    unmeasured: refs.length - measured.length,
    meanPercentile: round(mean(measured.map((r) => r.percentile!))),
    landRate: measured.length ? round(measured.filter((r) => r.verdict === "lands").length / measured.length, 3) : null,
    missRate: measured.length ? round(measured.filter((r) => r.verdict === "misses").length / measured.length, 3) : null,
    topShare: measured.length ? round(measured.filter((r) => r.percentile === 100).length / measured.length, 3) : null,
    recognition: round(mean(refs.flatMap((r) => (r.recognition === undefined ? [] : [r.recognition]))), 2),
    recognitionWithoutEchoes: round(
      mean(arms.flatMap((a, i) => a.refs.filter((r) => r.recognition !== undefined && !echoOf[i](r)).map((r) => r.recognition!))),
      2,
    ),
  };
}

/** Mean recognition of a text's rated references, or null if none were rated. */
export function pairRecognition(arm: Arm, skip: Echo = never): number | null {
  return mean(arm.refs.flatMap((r) => (r.recognition === undefined || skip(r) ? [] : [r.recognition])));
}

/** Mean percentile of a text's measured references, or null if none were measured. */
export function pairScore(arm: Arm, skip: Echo = never): number | null {
  return mean(arm.refs.filter((r) => r.percentile !== null && !skip(r)).map((r) => r.percentile!));
}

function paired(pairs: PairResult[], echoFor: (p: PairResult) => Echo): Paired {
  return pairedBy(pairs, (p, k) => pairScore(p[k], echoFor(p)), 1, 1);
}

function pairedBy(pairs: PairResult[], score: (p: PairResult, k: "claude" | "vernacular") => number | null, tie: number, dp: number): Paired {
  const diffs: number[] = [];
  for (const p of pairs) {
    const v = score(p, "vernacular");
    const c = score(p, "claude");
    if (v !== null && c !== null) diffs.push(v - c);
  }
  const ci = bootstrapCi(diffs, 2000, 7, dp);
  return {
    n: diffs.length,
    meanDiff: round(mean(diffs), dp),
    ci,
    wins: diffs.filter((d) => d >= tie).length,
    ties: diffs.filter((d) => Math.abs(d) < tie).length,
    losses: diffs.filter((d) => d <= -tie).length,
  };
}

// Small seeded generator so the bootstrap interval is the same on every render.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function bootstrapCi(diffs: number[], resamples = 2000, seed = 7, dp = 1): [number, number] | null {
  if (diffs.length < 2) return null;
  const rand = rng(seed);
  const means: number[] = [];
  for (let i = 0; i < resamples; i++) {
    let sum = 0;
    for (let j = 0; j < diffs.length; j++) sum += diffs[Math.floor(rand() * diffs.length)];
    means.push(sum / diffs.length);
  }
  means.sort((a, b) => a - b);
  return [round(means[Math.floor(resamples * 0.025)], dp)!, round(means[Math.ceil(resamples * 0.975) - 1], dp)!];
}

export function summarize(pairs: PairResult[], audiences: { id: string; anchors?: string[] }[]): Summary {
  const anchors = new Map(audiences.map((a) => [a.id, new Set((a.anchors ?? []).map(norm))]));
  const echoFor = (p: PairResult): Echo => {
    const set = anchors.get(p.audienceId);
    return (r) => !!set?.size && [r.name, r.span].some((n) => n && set.has(norm(n)));
  };
  const arms = Object.fromEntries(ARMS.map((k) => [k, armSummary(pairs.map((p) => p[k]), pairs.map(echoFor))])) as Record<ArmKey, ArmSummary>;
  const byAudience = audiences.map(({ id: audienceId }) => {
    const these = pairs.filter((p) => p.audienceId === audienceId);
    return { audienceId, ...(Object.fromEntries(ARMS.map((k) => [k, armSummary(these.map((p) => p[k])).meanPercentile])) as Record<ArmKey, number | null>) };
  });

  const fid = (k: "claude" | "vernacular", f: "meaning" | "natural") =>
    round(mean(pairs.flatMap((p) => (p[k].fidelity ? [p[k].fidelity![f]] : []))), 2);

  return {
    pairs: pairs.length,
    arms,
    byAudience,
    paired: paired(pairs, () => never),
    pairedWithoutEchoes: paired(pairs, echoFor),
    fidelity: {
      claude: { meaning: fid("claude", "meaning"), natural: fid("claude", "natural") },
      vernacular: { meaning: fid("vernacular", "meaning"), natural: fid("vernacular", "natural") },
    },
    changes: {
      claude: round(mean(pairs.map((p) => p.claude.changes))),
      vernacular: round(mean(pairs.map((p) => p.vernacular.changes))),
    },
    speed: {
      meanMs: round(mean(pairs.map((p) => p.stats.ms)), 0),
      meanQlooCalls: round(mean(pairs.map((p) => p.stats.qlooCalls))),
    },
    recognitionPaired: pairedBy(pairs, (p, k) => pairRecognition(p[k]), 0.25, 2),
    recognitionPairedWithoutEchoes: pairedBy(pairs, (p, k) => pairRecognition(p[k], echoFor(p)), 0.25, 2),
  };
}
