// Fast lint: score the references in a piece of text and, for each weak one,
// offer the best Qloo-verified same-type alternative. No rewriting agent, so it
// answers in seconds; it powers the browser extension and the /anywhere demo.

import { findEquivalents, scoreWithPanel } from "../qloo/tools";
import { extractReferences } from "./extract";
import { resolveAudience, scoreReferences, THRESHOLDS } from "./score";
import type { AudienceSpec, Verdict } from "./types";

export interface LintItem {
  span: string;
  name: string | null;
  type: string;
  verdict: Verdict;
  percentile: number | null;
  note: string | null;
  suggestion: { name: string; percentile: number } | null;
}

const cache = new Map<string, { at: number; items: LintItem[] }>();

export async function lint(text: string, spec: AudienceSpec): Promise<LintItem[]> {
  const key = JSON.stringify([text, spec]);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 30 * 60 * 1000) return hit.items;

  const [{ audience }, refs] = await Promise.all([resolveAudience(spec), extractReferences(text)]);
  const scored = await scoreReferences(refs, audience);
  const items = await Promise.all(
    scored.map(async (s): Promise<LintItem> => {
      const base = { span: s.span, name: s.entity?.name ?? null, type: s.type, verdict: s.verdict, percentile: s.percentile, note: s.notes.at(-1) ?? null };
      // A person usually stands for a role (a director's look, a trait), which only the full agent can rewrite around.
      if (!s.entity || s.type === "person" || (s.verdict !== "misses" && s.verdict !== "mixed")) return { ...base, suggestion: null };
      try {
        const { candidates } = await findEquivalents(s.entity, audience, { take: 6, popularityFloor: 0.6 });
        const top = candidates.slice(0, 3);
        if (!top.length) return { ...base, suggestion: null };
        const { results } = await scoreWithPanel(top.map((c) => c.id), s.type, audience);
        const best = results
          .filter((r) => r.percentile !== null && r.percentile >= THRESHOLDS.lands)
          .sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))[0];
        const c = best && top.find((x) => x.id === best.entityId);
        return { ...base, suggestion: c ? { name: c.name, percentile: best.percentile! } : null };
      } catch {
        return { ...base, suggestion: null };
      }
    }),
  );
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), items });
  return items;
}
