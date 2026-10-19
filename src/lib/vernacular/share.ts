// Share cards: a compact, validated summary of a check carried in the URL.
// Holds reference names, verdicts and percentiles only, never the user's copy.

import { z } from "zod";
import type { CheckResult, Verdict } from "./types";

const V = { lands: "l", mixed: "m", misses: "x", unmeasured: "u" } as const;
const FROM_V: Record<string, Verdict> = { l: "lands", m: "mixed", x: "misses", u: "unmeasured" };

const Card = z.object({
  a: z.string().min(1).max(60),
  r: z
    .array(
      z.object({
        n: z.string().min(1).max(48),
        v: z.enum(["l", "m", "x", "u"]),
        p: z.number().int().min(0).max(100).nullable(),
        s: z.string().max(48).optional(),
        sp: z.number().int().min(0).max(100).nullable().optional(),
      }),
    )
    .min(1)
    .max(8),
});
type Card = z.infer<typeof Card>;

export interface ShareSummary {
  audience: string;
  refs: { name: string; verdict: Verdict; percentile: number | null; swap?: string; swapPercentile?: number | null }[];
}

export function summaryOf(result: CheckResult): ShareSummary {
  return {
    audience: result.audience.label.slice(0, 60),
    refs: result.references.slice(0, 8).map((r) => {
      const s = result.swaps.find((w) => w.referenceId === r.id);
      return {
        name: r.span.slice(0, 48),
        verdict: r.verdict,
        percentile: r.percentile,
        swap: s?.replacement.name.slice(0, 48),
        swapPercentile: s?.replacement.percentile ?? null,
      };
    }),
  };
}

const toB64Url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64Url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

export function encodeShare(s: ShareSummary): string {
  const card: Card = {
    a: s.audience,
    r: s.refs.map((r) => ({ n: r.name, v: V[r.verdict], p: r.percentile, ...(r.swap ? { s: r.swap, sp: r.swapPercentile ?? null } : {}) })),
  };
  return toB64Url(JSON.stringify(card));
}

/** Returns null for anything malformed or tampered with. */
export function decodeShare(token: string): ShareSummary | null {
  if (!/^[A-Za-z0-9_-]{8,3000}$/.test(token)) return null;
  try {
    const parsed = Card.safeParse(JSON.parse(fromB64Url(token)));
    if (!parsed.success) return null;
    return {
      audience: parsed.data.a,
      refs: parsed.data.r.map((r) => ({ name: r.n, verdict: FROM_V[r.v], percentile: r.p, swap: r.s, swapPercentile: r.sp ?? null })),
    };
  } catch {
    return null;
  }
}

/** Headline numbers for the card. */
export function scoreOf(s: ShareSummary) {
  const measured = s.refs.filter((r) => r.verdict !== "unmeasured");
  const lands = measured.filter((r) => r.verdict === "lands").length;
  const afterLands = measured.filter((r) => r.verdict === "lands" || (r.swap && (r.swapPercentile ?? 0) >= 65)).length;
  const mean = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => typeof x === "number");
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const before = mean(measured.map((r) => r.percentile));
  const after = mean(measured.map((r) => (r.swap ? r.swapPercentile : r.percentile)));
  const ratio = measured.length ? lands / measured.length : 0;
  const headline =
    ratio === 1 ? `Fluent in ${s.audience}.` : ratio >= 0.5 ? `Mostly speaks ${s.audience}.` : `Lost in translation with ${s.audience}.`;
  return { total: measured.length, lands, afterLands, before, after, headline, swaps: s.refs.filter((r) => r.swap).length };
}
