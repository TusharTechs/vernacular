import { describe, expect, it } from "vitest";
import { THRESHOLDS, verdictFor } from "../score";

describe("verdictFor", () => {
  it("is unmeasured without a percentile", () => {
    expect(verdictFor(null, null).verdict).toBe("unmeasured");
  });

  it("maps percentiles onto the thresholds", () => {
    expect(verdictFor(THRESHOLDS.lands, null).verdict).toBe("lands");
    expect(verdictFor(THRESHOLDS.misses, null).verdict).toBe("mixed");
    expect(verdictFor(THRESHOLDS.misses - 1, null).verdict).toBe("misses");
  });

  it("downgrades one step when the audience's age band under-indexes", () => {
    const skew = { "24_and_younger": -0.5, "55_and_older": 0.4 };
    expect(verdictFor(80, skew, "24_and_younger").verdict).toBe("mixed");
    expect(verdictFor(50, skew, "24_and_younger").verdict).toBe("misses");
    expect(verdictFor(50, skew, "24_and_younger").notes.join(" ")).toContain("strongest with 55 and older");
  });

  it("ignores age skew when the audience has no age band", () => {
    expect(verdictFor(80, { "24_and_younger": -0.9 }).verdict).toBe("lands");
  });

  it("words the extremes plainly", () => {
    expect(verdictFor(100, null).notes[0]).toContain("every well-known peer");
    expect(verdictFor(0, null).notes[0]).toContain("lower");
  });
});
