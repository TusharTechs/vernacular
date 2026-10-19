import { describe, expect, it } from "vitest";
import { decodeShare, encodeShare, scoreOf, type ShareSummary } from "../share";

const sample: ShareSummary = {
  audience: "Gen Z Latin-pop fans",
  refs: [
    { name: "Seinfeld", verdict: "mixed", percentile: 40, swap: "Derry Girls", swapPercentile: 100 },
    { name: "Olive Garden", verdict: "misses", percentile: 0, swap: "Hard Rock", swapPercentile: 48 },
    { name: "Frank Sinatra", verdict: "lands", percentile: 70 },
  ],
};

describe("share tokens", () => {
  it("round-trips, including non-ASCII names", () => {
    const s = { ...sample, audience: "Fans de reggaetón" };
    expect(decodeShare(encodeShare(s))).toEqual({ ...s, refs: s.refs.map((r) => ({ ...r, swapPercentile: r.swapPercentile ?? null })) });
  });

  it("rejects tampered or malformed tokens", () => {
    expect(decodeShare("not a token!")).toBeNull();
    expect(decodeShare(encodeShare(sample).slice(0, -6) + "AAAAAA")).toBeNull();
    const bad = btoa(JSON.stringify({ a: "x", r: [{ n: "y", v: "z", p: 500 }] })).replace(/=+$/, "");
    expect(decodeShare(bad)).toBeNull();
  });
});

describe("scoreOf", () => {
  it("counts lands before and after swaps and averages percentiles", () => {
    const s = scoreOf(sample);
    expect(s.total).toBe(3);
    expect(s.lands).toBe(1);
    expect(s.afterLands).toBe(2);
    expect(s.before).toBe(37);
    expect(s.after).toBe(73);
    expect(s.headline).toBe("Lost in translation with Gen Z Latin-pop fans.");
  });
});
