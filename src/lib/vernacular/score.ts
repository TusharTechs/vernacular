// Step 2: resolve and score every reference against the audience (Qloo facts only).

import type { AgeBand } from "../qloo/params";
import {
  ageSkew,
  resolveEntity,
  scoreWithPanel,
  type AgeProfile,
  type Audience,
  type Evidence,
  type ResolvedEntity,
} from "../qloo/tools";
import type { AudienceSpec, ExtractedReference, ScoredReference, Verdict } from "./types";

export const THRESHOLDS = { misses: 35, lands: 65, ageSkewPenalty: -0.2 } as const;

const AGE_LABEL: Record<AgeBand, string> = {
  "24_and_younger": "24 and younger",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55 and older",
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

export async function resolveAudience(spec: AudienceSpec) {
  const wanted = spec.anchors.slice(0, 5);
  const found = await mapLimit(wanted, 4, (a) => resolveEntity(a.query, a.type));
  const evidence: Evidence[] = found.map((f) => f.evidence);
  const anchors: ResolvedEntity[] = found.flatMap((f) => (f.entity ? [f.entity] : []));
  const unresolved = wanted.filter((_, i) => !found[i].entity).map((a) => a.query);
  const audience: Audience = { label: spec.label, anchors, age: spec.age, gender: spec.gender, location: spec.location };
  return { audience, evidence, unresolved };
}

export function verdictFor(percentile: number | null, skew: AgeProfile | null, age?: AgeBand): { verdict: Verdict; notes: string[] } {
  const notes: string[] = [];
  if (percentile === null) return { verdict: "unmeasured", notes: ["Qloo did not return a score for this audience."] };
  notes.push(
    percentile >= 100
      ? "Scores higher with this audience than every well-known peer of the same type."
      : percentile <= 0
        ? "Scores lower with this audience than every well-known peer of the same type."
        : `Scores higher with this audience than ${percentile}% of well-known peers of the same type.`,
  );
  let verdict: Verdict = percentile >= THRESHOLDS.lands ? "lands" : percentile < THRESHOLDS.misses ? "misses" : "mixed";
  const s = age && skew ? skew[age] : undefined;
  if (age && typeof s === "number") {
    const strongest = Object.entries(skew ?? {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
    if (s <= THRESHOLDS.ageSkewPenalty) {
      notes.push(`Its audience under-indexes for ${AGE_LABEL[age]} (${s.toFixed(2)}); strongest with ${AGE_LABEL[strongest[0] as AgeBand]}.`);
      if (verdict === "lands") verdict = "mixed";
      else if (verdict === "mixed") verdict = "misses";
    } else if (s > 0.2) {
      notes.push(`Its audience over-indexes for ${AGE_LABEL[age]} (+${s.toFixed(2)}).`);
    }
  }
  return { verdict, notes };
}

export async function scoreReferences(refs: ExtractedReference[], audience: Audience): Promise<ScoredReference[]> {
  const resolved = await mapLimit(refs, 4, (r) => resolveEntity(r.query, r.type));
  const scored: ScoredReference[] = refs.map((r, i) => ({
    ...r,
    entity: resolved[i].entity,
    percentile: null,
    affinity: null,
    ageSkew: null,
    verdict: "unmeasured",
    notes: resolved[i].entity ? [] : [`Qloo search found no ${r.type.replace("_", " ")} named "${r.query}".`],
    evidence: [resolved[i].evidence],
  }));

  // One scoring call per entity type, against that type's reference panel.
  const byType = new Map<string, ScoredReference[]>();
  for (const s of scored) if (s.entity) byType.set(s.type, [...(byType.get(s.type) ?? []), s]);
  await Promise.all(
    [...byType.entries()].map(async ([, group]) => {
      const { results, evidence } = await scoreWithPanel(group.map((g) => g.entity!.id), group[0].type, audience);
      for (const g of group) {
        const r = results.find((x) => x.entityId === g.entity!.id);
        g.evidence.push(...evidence);
        if (r?.isAnchor) {
          g.percentile = 100;
          g.verdict = "lands";
          g.notes.push("This is one of the audience's own taste anchors.");
          continue;
        }
        g.percentile = r?.percentile ?? null;
        g.affinity = r?.affinity ?? null;
      }
    }),
  );

  // Age skew only matters when the audience has an age band.
  if (audience.age) {
    await mapLimit(scored.filter((s) => s.entity && s.verdict !== "lands"), 4, async (s) => {
      const { age, evidence } = await ageSkew(s.entity!.id);
      s.ageSkew = age;
      s.evidence.push(evidence);
    });
  }

  for (const s of scored) {
    if (!s.entity || s.notes.includes("This is one of the audience's own taste anchors.")) continue;
    const v = verdictFor(s.percentile, s.ageSkew, audience.age);
    s.verdict = v.verdict;
    s.notes.push(...v.notes);
  }
  return scored;
}
