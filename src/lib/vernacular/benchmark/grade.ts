// The benchmark's grader: every final text, whoever wrote it, goes through the
// same pass: extract its references, then score each on Qloo for the audience.

import type { Audience } from "../../qloo/tools";
import { extractReferences } from "../extract";
import { scoreReferences } from "../score";
import type { ScoredReference } from "../types";
import type { GradedRef } from "./types";

export function toGraded(refs: ScoredReference[]): GradedRef[] {
  return refs.map((r) => ({ span: r.span, name: r.entity?.name ?? null, type: r.type, percentile: r.percentile, verdict: r.verdict }));
}

export async function gradeText(text: string, audience: Audience): Promise<GradedRef[]> {
  return toGraded(await scoreReferences(await extractReferences(text), audience));
}
