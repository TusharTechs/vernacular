import { describe, expect, it } from "vitest";
import { alignWords, reactionAt, timeAt } from "../dial";

const text = "Picture a Seinfeld marathon, and Frank Sinatra night at the lounge.";
const spoken = [
  { word: "Picture", start: 0, end: 0.4 },
  { word: "a", start: 0.4, end: 0.5 },
  { word: "Seinfeld", start: 0.5, end: 1.0 },
  { word: "marathon,", start: 1.0, end: 1.6 },
  // "and" was not transcribed
  { word: "Frank", start: 2.0, end: 2.3 },
  { word: "Sinatra", start: 2.3, end: 2.9 },
  { word: "night", start: 2.9, end: 3.2 },
  { word: "at", start: 3.2, end: 3.3 },
  { word: "the", start: 3.3, end: 3.4 },
  { word: "lounge.", start: 3.4, end: 4.0 },
];

describe("Dial Test alignment", () => {
  const words = alignWords(text, spoken, 4.2);

  it("times every word of the text, interpolating ones the transcript missed", () => {
    expect(words).toHaveLength(11);
    const and = words[4];
    expect(text.slice(and.start, and.end)).toBe("and");
    expect(and.t0).toBeGreaterThan(1.6);
    expect(and.t0).toBeLessThan(2.0);
  });

  it("finds when a reference is spoken", () => {
    expect(timeAt(words, text.indexOf("Seinfeld"))).toBe(0.5);
    expect(timeAt(words, text.indexOf("Frank Sinatra"))).toBe(2.0);
  });
});

describe("reaction curve", () => {
  it("swings toward each reference's percentile and settles back to neutral", () => {
    const beats = [{ t: 1, score: 10 }, { t: 5, score: 95 }];
    expect(reactionAt(beats, 0)).toBeCloseTo(50, 0);
    expect(reactionAt(beats, 1)).toBeCloseTo(10, 0);
    expect(reactionAt(beats, 5)).toBeGreaterThan(85); // the earlier miss is still fading
    expect(reactionAt(beats, 20)).toBeCloseTo(50, 0);
    expect(reactionAt([{ t: 1, score: null }], 1)).toBe(50);
  });
});
