import type { EntityType } from "../../qloo/params";
import type { Verdict } from "../types";
import type { Fidelity } from "./judge";

/** One reference in a final text, graded by the same extract → score pass for every arm. */
export interface GradedRef {
  span: string;
  name: string | null;
  type: EntityType;
  percentile: number | null;
  verdict: Verdict;
  /** Outside check: 1–5 from a non-Claude model, blind to which version used it (see recognition.ts). */
  recognition?: number;
}

export interface Arm {
  text: string;
  refs: GradedRef[];
}

export interface PairResult {
  copyId: string;
  audienceId: string;
  original: Arm;
  claude: Arm & { fidelity: Fidelity | null; changes: number };
  vernacular: Arm & { fidelity: Fidelity | null; changes: number; swaps: { from: string; to: string; percentile: number | null }[] };
  stats: { qlooCalls: number; ms: number };
}

export interface BenchmarkRun {
  corpusVersion: number;
  ranAt: string;
  model: string;
  copy: { id: string; label: string; text: string }[];
  audiences: { id: string; label: string; anchors: string[] }[];
  pairs: PairResult[];
  /** Model that rated recognition, when that pass has been run. */
  recognitionModel?: string;
}
