import { describe, expect, it } from "vitest";
import { bootstrapCi, pairScore, summarize } from "../benchmark/summarize";
import type { Arm, PairResult } from "../benchmark/types";

const arm = (...ps: (number | null)[]): Arm => ({
  text: "",
  refs: ps.map((p, i) => ({ span: `r${i}`, name: `R${i}`, type: "artist", percentile: p, verdict: p === null ? "unmeasured" : p >= 65 ? "lands" : p < 35 ? "misses" : "mixed" })),
});

const pair = (audienceId: string, o: Arm, c: Arm, v: Arm): PairResult => ({
  copyId: "x",
  audienceId,
  original: o,
  claude: { ...c, fidelity: { meaning: 4, natural: 5, note: "None" }, changes: 2 },
  vernacular: { ...v, fidelity: { meaning: 5, natural: 4, note: "None" }, changes: 1, swaps: [] },
  stats: { qlooCalls: 30, ms: 40000 },
});

describe("benchmark summary", () => {
  it("scores a text by its measured references only", () => {
    expect(pairScore(arm(20, null, 80))).toBe(50);
    expect(pairScore(arm(null))).toBeNull();
  });

  it("pools references per arm and compares arms pair by pair", () => {
    const s = summarize(
      [pair("a", arm(10, 90), arm(50, 90), arm(80, 90)), pair("b", arm(0), arm(70), arm(70))],
      [{ id: "a" }, { id: "b" }],
    );
    expect(s.arms.original).toMatchObject({ measured: 3, meanPercentile: 33.3, missRate: 0.667 });
    expect(s.arms.vernacular.landRate).toBe(1);
    expect(s.paired).toMatchObject({ n: 2, meanDiff: 7.5, wins: 1, ties: 1, losses: 0 });
    expect(s.byAudience.find((x) => x.audienceId === "a")).toMatchObject({ original: 50, claude: 70, vernacular: 85 });
    expect(s.fidelity.claude).toEqual({ meaning: 4, natural: 5 });
    expect(s.changes).toEqual({ claude: 2, vernacular: 1 });
  });

  it("separates references that only echo the brief's own examples", () => {
    const echo = arm(90);
    echo.refs[0] = { ...echo.refs[0], name: "Bad Bunny", percentile: 100, verdict: "lands" };
    const s = summarize([pair("a", arm(10), { ...echo, refs: [...echo.refs, ...arm(40).refs] }, arm(80))], [{ id: "a", anchors: ["Bad Bunny"] }]);
    expect(s.arms.claude).toMatchObject({ echoes: 1, meanPercentile: 70, meanWithoutEchoes: 40 });
    expect(s.paired.meanDiff).toBe(10);
    expect(s.pairedWithoutEchoes.meanDiff).toBe(40);
  });

  it("gives a stable bootstrap interval that contains the mean", () => {
    const diffs = [5, 12, -3, 20, 8, 15, 0, 9];
    const ci = bootstrapCi(diffs)!;
    expect(bootstrapCi(diffs)).toEqual(ci);
    expect(ci[0]).toBeLessThan(8.25);
    expect(ci[1]).toBeGreaterThan(8.25);
    expect(bootstrapCi([3])).toBeNull();
  });
});
