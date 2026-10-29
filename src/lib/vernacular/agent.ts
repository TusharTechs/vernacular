// Step 3: the swap agent. For each weak reference, Claude searches Qloo for
// equivalents the audience over-indexes on, verifies them, and rewrites the
// sentence, or keeps the original and says why. Every candidate it can submit
// must have come from a Qloo call in this run and passed verification.

import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  ageSkew,
  findEquivalents,
  scoreWithPanel,
  searchTags,
  sharedTags,
  SWAP_POPULARITY_FLOOR,
  type Audience,
  type Equivalent,
  type Evidence,
} from "../qloo/tools";
import { ENTITY_TYPES } from "../qloo/params";
import { changeOf } from "./diff";
import { claude, FALLBACK, MODEL, RefusalError } from "./llm";
import { verdictFor } from "./score";
import type { CheckEvent, Kept, ScoredReference, Swap, Verdict } from "./types";

export const AGENT_LIMITS = { maxIterations: 16, maxQlooCalls: 40 } as const;

interface Verified {
  candidate: Equivalent;
  percentile: number | null;
  affinity: number | null;
  verdict: Verdict;
  notes: string[];
  evidence: Evidence[];
}

const SYSTEM = `You are Vernacular's swap agent. Copy is being adapted for a specific audience. Some cultural references in it score poorly with that audience on Qloo's taste graph. For each weak reference, find a replacement this audience actually loves, verify it, and rewrite the sentence in the same voice.

How to work:
1. Call find_equivalents for the reference. By default it filters to the original's genre tags. If the results don't fit the reference's role in the sentence (a crooner swapped for a rapper, a sitcom for a drama), call search_tags to find tags that capture the role (e.g. "sitcom", "crooner", "steakhouse") and call find_equivalents again with those tag_ids.
   Some references can't be replaced like for like. A director usually stands for a visual style, a public figure for a trait, and Qloo's people results lean heavily toward musicians. When same-type candidates don't fit the role, call find_equivalents with a different type (e.g. a movie or tv_show for a director, a tv_show or brand for a personality) and rephrase only as much as the new type needs ("looks like a Wes Anderson film" → "looks like a scene from <film>").
2. Pick up to 3 candidates that fit the role and would read naturally, and call verify_candidates. Each candidate's shared_with_original lists the Qloo tags it shares with the original; overlap there is evidence it plays the same role.
3. Call submit_swap with the best verified candidate. It must score "lands", or at least "mixed" and clearly above the original. If nothing qualifies after a couple of attempts, call keep_reference and explain plainly.

Rules:
- Keep a reference that states a fact rather than making a comparison: credits ("from the studio that made X", "from the director of X"), sponsors and partners, where the product is sold, or where the event actually takes place. Swapping it would make the copy untrue, so call keep_reference and say so.
- Only use candidates returned by find_equivalents in this run. Never invent or rename entities.
- When the reference is a yardstick ("funnier than X", "as strong as X", "bigger than X"), the replacement must be a household name for this audience. Prefer the most widely known candidate that lands over a niche one that scores a little higher; Qloo's popularity numbers don't capture this, so use your judgment.
- The rewritten sentence must keep the original's meaning, tone and length, change only what the swap needs, and name the replacement the way people actually say it: Qloo's spelling or its common short form ("NBA", not "National Basketball Association").
- Fix the grammar around the new name: "a The White Lotus marathon" must become "a White Lotus marathon".
- If two references share a sentence, rewrite from the sentence's current version, which submit_swap returns.
- Finish every reference you were given with exactly one submit_swap or keep_reference.`;

/** Does the sentence name the entity, by its first words or its usual acronym ("NBA")? */
export function namesEntity(sentence: string, name: string) {
  const words = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ");
  const said = ` ${sentence.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const acronym = words.filter((w) => !["of", "the", "and", "a"].includes(w)).map((w) => w[0]).join("");
  return said.includes(words.slice(0, 2).join(" ")) || (acronym.length >= 2 && said.includes(` ${acronym} `));
}

/** "like a The White Lotus marathon": an article left in front of a title that brings its own. */
export function articleClash(before: string, after: string): string | null {
  const clash = /\b(a|an)\s+the\b/i;
  const m = clash.exec(after);
  if (!m || clash.test(before)) return null;
  return `"${m[0]}" doesn't read naturally. Drop "${m[1]}" or rephrase around the title.`;
}

export async function runSwapAgent(
  text: string,
  weak: ScoredReference[],
  audience: Audience,
  emit: (e: CheckEvent) => void,
  signal?: AbortSignal,
): Promise<{ swaps: Swap[]; kept: Kept[]; llmCalls: number }> {
  const swaps: Swap[] = [];
  const kept: Kept[] = [];
  if (!weak.length) return { swaps, kept, llmCalls: 0 };

  const byId = new Map(weak.map((w) => [w.id, w]));
  const candidates = new Map<string, Map<string, Equivalent>>(); // ref -> candidate id -> entity
  const verified = new Map<string, Map<string, Verified>>();
  const evidenceFor = new Map<string, Evidence[]>();
  const currentSentence = new Map<string, string>(); // original sentence -> latest version
  const done = new Set<string>();
  let qlooCalls = 0;

  const ref = (id: string) => {
    const r = byId.get(id);
    if (!r) throw new Error(`Unknown reference_id "${id}". Valid ids: ${[...byId.keys()].join(", ")}`);
    if (done.has(id)) throw new Error(`Reference ${id} is already finished.`);
    return r;
  };
  const spend = (n: number) => {
    if (qlooCalls + n > AGENT_LIMITS.maxQlooCalls) {
      throw new Error("Qloo call budget for this run is used up. Finish the remaining references with keep_reference.");
    }
    qlooCalls += n;
  };
  const addEvidence = (id: string, ev: Evidence[]) => evidenceFor.set(id, [...(evidenceFor.get(id) ?? []), ...ev]);
  const safe = (fn: () => Promise<string>) => async () => {
    try {
      return await fn();
    } catch (e) {
      return JSON.stringify({ error: (e as Error).message });
    }
  };

  const searchTagsTool = betaZodTool({
    name: "search_tags",
    description: "Search Qloo's tag taxonomy by keyword to find tags that capture a reference's role (genre, style, cuisine). Returns tag ids usable in find_equivalents.",
    inputSchema: z.object({ query: z.string().describe("A short keyword, e.g. 'sitcom' or 'crooner'.") }),
    run: (input) =>
      safe(async () => {
        spend(1);
        emit({ type: "agent_step", message: `Searching Qloo tags for "${input.query}"` });
        const { tags } = await searchTags(input.query);
        return JSON.stringify(tags.map((t) => ({ id: t.id, name: t.name, applies_to: t.appliesTo })));
      })(),
  });

  const findTool = betaZodTool({
    name: "find_equivalents",
    description: "Ask Qloo for entities this audience over-indexes on, of the reference's type unless you pass another, optionally constrained to tag ids. Returns candidates with their affinity for the audience.",
    inputSchema: z.object({
      reference_id: z.string(),
      type: z.enum(ENTITY_TYPES).optional().describe("Look in a different entity type when like-for-like can't fill the role. Omit for the reference's own type."),
      tag_ids: z.array(z.string()).max(4).optional().describe("Tag ids from search_tags. Omit to use the original's genre tags."),
      popularity_floor: z.number().min(0.2).max(0.95).optional().describe(`Minimum Qloo popularity, 0–1. Higher means more recognisable. Default ${SWAP_POPULARITY_FLOOR}, the floor of the well-known peers swaps are ranked against; lower it only when nothing at the default fits the role.`),
    }),
    run: (input) =>
      safe(async () => {
        const r = ref(input.reference_id);
        spend(3);
        const type = input.type ?? r.type;
        emit({
          type: "agent_step",
          message: type === r.type
            ? `Looking for ${type.replace("_", " ")} equivalents to ${r.entity?.name ?? r.span}`
            : `Looking for a ${type.replace("_", " ")} that could stand in for ${r.entity?.name ?? r.span}`,
        });
        const res = await findEquivalents(r.entity!, audience, { take: 8, popularityFloor: input.popularity_floor ?? SWAP_POPULARITY_FLOOR, tagIds: input.tag_ids, type });
        qlooCalls += res.evidence.length - 3; // reconcile with actual calls made
        addEvidence(r.id, res.evidence);
        const map = candidates.get(r.id) ?? new Map();
        for (const c of res.candidates) map.set(c.id, c);
        candidates.set(r.id, map);
        return JSON.stringify({
          relaxed_constraints: res.relaxed,
          candidates: res.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            popularity: c.popularity && Number(c.popularity.toFixed(2)),
            affinity: c.affinity && Number(c.affinity.toFixed(3)),
            tags: c.tags.slice(0, 6).map((t) => t.name),
            shared_with_original: sharedTags(r.entity!, c),
          })),
        });
      })(),
  });

  const verifyTool = betaZodTool({
    name: "verify_candidates",
    description: "Score up to 3 candidates for this audience exactly the way the original was scored (percentile among well-known peers, plus age skew).",
    inputSchema: z.object({ reference_id: z.string(), candidate_ids: z.array(z.string()).min(1).max(3) }),
    run: (input) =>
      safe(async () => {
        const r = ref(input.reference_id);
        const pool = candidates.get(r.id) ?? new Map<string, Equivalent>();
        const unknown = input.candidate_ids.filter((id) => !pool.has(id));
        if (unknown.length) throw new Error(`Not returned by find_equivalents for ${r.id}: ${unknown.join(", ")}`);
        spend(new Set(input.candidate_ids.map((id) => pool.get(id)!.type)).size + (audience.age ? input.candidate_ids.length : 0));
        emit({ type: "agent_step", message: `Verifying ${input.candidate_ids.map((id) => pool.get(id)!.name).join(", ")}` });
        // Each candidate is ranked among well-known peers of its own type.
        const types = [...new Set(input.candidate_ids.map((id) => pool.get(id)!.type))];
        const scored = await Promise.all(
          types.map((t) => scoreWithPanel(input.candidate_ids.filter((id) => pool.get(id)!.type === t), t, audience)),
        );
        const results = scored.flatMap((x) => x.results);
        const evidence = scored.flatMap((x) => x.evidence);
        addEvidence(r.id, evidence);
        const out = [];
        for (const id of input.candidate_ids) {
          const s = results.find((x) => x.entityId === id);
          const skew = audience.age ? await ageSkew(id) : null;
          if (skew) addEvidence(r.id, [skew.evidence]);
          const v = verdictFor(s?.percentile ?? null, skew?.age ?? null, audience.age);
          const entry: Verified = {
            candidate: pool.get(id)!,
            percentile: s?.percentile ?? null,
            affinity: s?.affinity ?? null,
            verdict: v.verdict,
            notes: v.notes,
            evidence: [...evidence, ...(skew ? [skew.evidence] : [])],
          };
          const vm = verified.get(r.id) ?? new Map();
          vm.set(id, entry);
          verified.set(r.id, vm);
          out.push({ id, name: entry.candidate.name, percentile: entry.percentile, verdict: entry.verdict, notes: entry.notes });
        }
        return JSON.stringify({ original: { name: r.entity?.name, percentile: r.percentile, verdict: r.verdict }, candidates: out });
      })(),
  });

  const submitTool = betaZodTool({
    name: "submit_swap",
    description: "Replace the reference with a verified candidate and give the rewritten sentence.",
    inputSchema: z.object({
      reference_id: z.string(),
      candidate_id: z.string(),
      rewritten_sentence: z.string(),
      rationale: z.string().describe("One sentence for the user on why this swap fits, citing the verified score."),
    }),
    run: (input) =>
      safe(async () => {
        const r = ref(input.reference_id);
        const v = verified.get(r.id)?.get(input.candidate_id);
        if (!v) throw new Error("Verify this candidate with verify_candidates before submitting it.");
        const better =
          v.verdict === "lands" ||
          (v.verdict === "mixed" && (v.percentile ?? 0) >= (r.percentile ?? 0) + 15);
        if (!better) {
          throw new Error(`${v.candidate.name} scores ${v.verdict} (${v.percentile}); it must land, or be mixed and clearly above the original (${r.percentile}).`);
        }
        if (!namesEntity(input.rewritten_sentence, v.candidate.name)) throw new Error(`The rewritten sentence must name ${v.candidate.name}.`);
        if (input.rewritten_sentence.includes(r.span)) throw new Error(`The rewritten sentence still contains "${r.span}".`);
        const clash = articleClash(currentSentence.get(r.sentence) ?? r.sentence, input.rewritten_sentence);
        if (clash) throw new Error(clash);

        const raw = (v.candidate.explainability as { "signal.interests.entities"?: { entity_id: string; score: number }[] } | undefined)?.[
          "signal.interests.entities"
        ];
        const drivers = (raw ?? [])
          .map((d) => ({ name: audience.anchors.find((a) => a.id === d.entity_id)?.name ?? "", share: d.score }))
          .filter((d) => d.name)
          .sort((a, b) => b.share - a.share);
        const swap: Swap = {
          drivers,
          shared: r.entity ? sharedTags(r.entity, v.candidate) : [],
          referenceId: r.id,
          replacement: { ...v.candidate, percentile: v.percentile, affinity: v.affinity },
          rewrittenSentence: input.rewritten_sentence,
          change: changeOf(currentSentence.get(r.sentence) ?? r.sentence, input.rewritten_sentence),
          rationale: input.rationale,
          evidence: evidenceFor.get(r.id) ?? [],
        };
        currentSentence.set(r.sentence, input.rewritten_sentence);
        swaps.push(swap);
        done.add(r.id);
        emit({ type: "swap", swap });
        const sibling = weak.find((w) => !done.has(w.id) && w.sentence === r.sentence);
        return JSON.stringify({ ok: true, current_sentence: input.rewritten_sentence, next_in_same_sentence: sibling?.id ?? null });
      })(),
  });

  const keepTool = betaZodTool({
    name: "keep_reference",
    description: "Keep the original reference when no verified candidate is clearly better or none fits the sentence.",
    inputSchema: z.object({ reference_id: z.string(), reason: z.string() }),
    run: (input) =>
      safe(async () => {
        const r = ref(input.reference_id);
        const k = { referenceId: r.id, reason: input.reason };
        kept.push(k);
        done.add(r.id);
        emit({ type: "kept", kept: k });
        return JSON.stringify({ ok: true });
      })(),
  });

  const brief = weak.map((w) => ({
    reference_id: w.id,
    reference: w.span,
    qloo_entity: w.entity?.name,
    type: w.type,
    role: w.role,
    sentence: currentSentence.get(w.sentence) ?? w.sentence,
    percentile: w.percentile,
    verdict: w.verdict,
    notes: w.notes,
  }));
  const audienceText = [
    audience.label,
    audience.anchors.length ? `loves ${audience.anchors.map((a) => a.name).join(", ")}` : null,
    audience.age ? `age ${audience.age.replaceAll("_", " ")}` : null,
    audience.location ? `in ${audience.location}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const runner = claude().beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: (process.env.VERNACULAR_AGENT_EFFORT as "low" | "medium") ?? "low" },
    max_iterations: AGENT_LIMITS.maxIterations,
    system: SYSTEM,
    tools: [searchTagsTool, findTool, verifyTool, submitTool, keepTool],
    messages: [
      {
        role: "user",
        content: `Audience: ${audienceText}\n\nFull copy, for voice:\n<copy>\n${text}\n</copy>\n\nWeak references to handle:\n${JSON.stringify(brief, null, 2)}`,
      },
    ],
  });

  let llmCalls = 0;
  for await (const message of runner) {
    if (signal?.aborted) break; // the visitor left; stop spending on this run
    llmCalls++;
    if (message.stop_reason === "refusal") throw new RefusalError(message.stop_details?.category);
  }

  for (const w of weak) {
    if (!done.has(w.id)) {
      const k = { referenceId: w.id, reason: "The agent ran out of steps before reaching this reference." };
      kept.push(k);
      emit({ type: "kept", kept: k });
    }
  }
  return { swaps, kept, llmCalls };
}

