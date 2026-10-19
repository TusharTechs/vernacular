import type { AgeBand, EntityType } from "../qloo/params";
import type { AgeProfile, Evidence, ResolvedEntity } from "../qloo/tools";
import type { Change } from "./diff";

/** What the user asks Vernacular to check. */
export interface CheckInput {
  text: string;
  audience: AudienceSpec;
}

export interface AudienceSpec {
  label: string;
  /** Things this audience is known to love, resolved through Qloo search. 1–5. */
  anchors: { query: string; type: EntityType }[];
  age?: AgeBand;
  gender?: "male" | "female";
  /** City or neighbourhood; applied to place and brand references only. */
  location?: string;
  /** Qloo audience segments (life stage, interests, communities…). */
  segments?: { id: string; name: string }[];
  /** Qloo tags (genres, styles, cuisines…) the audience is into. */
  tags?: { id: string; name: string }[];
}

/** A cultural reference the model found in the text. */
export interface ExtractedReference {
  id: string;
  /** Exact substring of the input text. */
  span: string;
  /** Search query for Qloo, e.g. "Seinfeld". */
  query: string;
  type: EntityType;
  /** What the reference is doing in the sentence, e.g. "shorthand for a binge-worthy sitcom". */
  role: string;
  sentence: string;
}

export type Verdict = "lands" | "mixed" | "misses" | "unmeasured";

export interface ScoredReference extends ExtractedReference {
  entity: ResolvedEntity | null;
  /** 0–100: standing among well-known entities of the same type, for this audience. */
  percentile: number | null;
  affinity: number | null;
  ageSkew: AgeProfile | null;
  verdict: Verdict;
  /** Plain-language reasons, each backed by a call in `evidence`. */
  notes: string[];
  evidence: Evidence[];
}

export interface Swap {
  referenceId: string;
  replacement: ResolvedEntity & { percentile: number | null; affinity: number | null };
  rewrittenSentence: string;
  /** Just this swap's edit, so it can be shown and applied independently of other swaps. */
  change: Change;
  /** Qloo explainability: how much each audience anchor drove the replacement's affinity. */
  drivers: { name: string; share: number }[];
  rationale: string;
  evidence: Evidence[];
}

export interface Kept {
  referenceId: string;
  reason: string;
}

export interface CheckResult {
  input: CheckInput;
  audience: { label: string; anchors: ResolvedEntity[]; age?: AgeBand; location?: string };
  references: ScoredReference[];
  swaps: Swap[];
  kept: Kept[];
  rewrittenText: string;
  stats: { qlooCalls: number; llmCalls: number; ms: number };
}

/** Progress events for the streaming UI. */
export type CheckEvent =
  | { type: "audience"; anchors: ResolvedEntity[] }
  | { type: "extracted"; references: ExtractedReference[] }
  | { type: "scored"; reference: ScoredReference }
  | { type: "agent_step"; message: string }
  | { type: "swap"; swap: Swap }
  | { type: "kept"; kept: Kept }
  | { type: "done"; result: CheckResult }
  | { type: "error"; message: string };
