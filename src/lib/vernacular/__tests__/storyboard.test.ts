import { describe, expect, it } from "vitest";
import { assignLines } from "../storyboard";

describe("assignLines", () => {
  const frames = [1.25, 3.75, 6.25, 8.75, 11.25, 13.75]; // six frames sampled from a 15 s video

  it("puts each voiceover line on the frame it plays over", () => {
    const lines = [
      { start: 0, end: 3.4, text: "This summer…" },
      { start: 3.4, end: 6.3, text: "Funnier than the Friends reunion special." },
      { start: 6.3, end: 9.0, text: "Louder than a Garth Brooks stadium show." },
      { start: 12.0, end: 13.6, text: "Tickets go fast." },
    ];
    const out = assignLines(frames, lines);
    expect(out.get(0)).toEqual(["This summer…"]);
    expect(out.get(1)).toEqual(["Funnier than the Friends reunion special."]);
    expect(out.get(3)).toEqual(["Louder than a Garth Brooks stadium show."]);
    expect(out.get(5)).toEqual(["Tickets go fast."]);
  });

  it("keeps several lines in one shot in order and normalises quotes", () => {
    const out = assignLines([2, 10], [
      { start: 0, end: 1, text: "A “quoted” line" },
      { start: 1, end: 2, text: "then another" },
    ]);
    expect(out.get(0)).toEqual(["A 'quoted' line", "then another"]);
  });
});
