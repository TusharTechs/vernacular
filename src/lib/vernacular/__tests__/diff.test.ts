import { describe, expect, it } from "vitest";
import { applyChange, changeOf, contextOf } from "../diff";

const original =
  "Picture a Seinfeld marathon with a live crowd, dinner like a Friday at Olive Garden, and a sing-along that feels like Frank Sinatra night.";

describe("changeOf", () => {
  it("isolates the replaced words", () => {
    const c = changeOf(original, original.replace("Olive Garden", "Hard Rock"));
    expect(c.before).toBe("Olive Garden,");
    expect(c.after).toBe("Hard Rock,");
  });

  it("captures multi-word edits", () => {
    const c = changeOf("Smoother than a Fleetwood Mac album.", "Smoother than a Frank Ocean album.");
    expect(c.before).toBe("Fleetwood Mac");
    expect(c.after).toBe("Frank Ocean");
  });
});

describe("applyChange", () => {
  it("applies any subset of chained swaps independently", () => {
    const s1 = original.replace("Seinfeld", "Derry Girls");
    const s2 = s1.replace("Olive Garden", "Hard Rock"); // agent rewrote from s1
    const c1 = changeOf(original, s1);
    const c2 = changeOf(s1, s2);
    expect(applyChange(original, c2)).toBe(original.replace("Olive Garden", "Hard Rock")); // only the second
    expect(applyChange(applyChange(original, c1), c2)).toBe(s2); // both
    expect(applyChange(original, c1)).toBe(s1); // only the first
  });

  it("leaves text alone when the change no longer applies", () => {
    const c = changeOf("a Seinfeld night", "a Derry Girls night");
    expect(applyChange("nothing here", c)).toBe("nothing here");
  });
});

describe("contextOf", () => {
  it("trims long context with ellipses", () => {
    const c = changeOf(original, original.replace("Frank Sinatra", "Kali Uchis"));
    const ctx = contextOf(c, 3);
    expect(ctx.lead.startsWith("…")).toBe(true);
    expect(ctx.tail).toBe(" night.");
  });
});
