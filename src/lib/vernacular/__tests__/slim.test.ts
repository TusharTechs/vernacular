import { describe, expect, it } from "vitest";
import { slimResult } from "../slim";
import type { CheckResult } from "../types";

const tag = { id: "urn:tag:genre:qloo:comedy", name: "Comedy", type: "urn:tag:genre:qloo" };
const entity = { id: "E1", name: "Seinfeld", type: "tv_show" as const, tags: [tag, tag, tag] };

const result = {
  input: { text: "x", audience: { label: "A", anchors: [], tags: [{ id: "urn:tag:genre:music:reggaeton", name: "Reggaeton" }] } },
  audience: { label: "A", anchors: [entity] },
  references: [{ id: "r1", span: "Seinfeld", entity, percentile: 40 }],
  swaps: [{ referenceId: "r1", replacement: { ...entity, id: "E2", name: "Derry Girls", percentile: 100, affinity: 0.9 } }],
  kept: [],
  rewrittenText: "x",
  stats: { qlooCalls: 1, llmCalls: 1, ms: 1 },
} as unknown as CheckResult;

describe("slimResult", () => {
  it("drops entity tags but keeps the audience's own tags and everything else", () => {
    const s = slimResult(result);
    expect(s.references[0].entity!.tags).toEqual([]);
    expect(s.swaps[0].replacement.tags).toEqual([]);
    expect(s.audience.anchors[0].tags).toEqual([]);
    expect(s.input.audience.tags).toHaveLength(1);
    expect(s.references[0].percentile).toBe(40);
    expect(result.references[0].entity!.tags).toHaveLength(3); // the original isn't mutated
  });
});
