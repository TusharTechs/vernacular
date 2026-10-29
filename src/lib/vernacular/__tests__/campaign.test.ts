import { describe, expect, it } from "vitest";
import { cellFor } from "../campaign";
import { parseCsv, variantsFromCsv } from "../csv";
import type { ExtractedReference, ScoredReference } from "../types";

const ref = (query: string, type: ExtractedReference["type"] = "tv_show"): ExtractedReference => ({
  id: query,
  span: query,
  query,
  type,
  role: "",
  sentence: "",
});
const scored = (r: ExtractedReference, percentile: number | null, verdict: ScoredReference["verdict"]): ScoredReference => ({
  ...r,
  entity: { id: r.query, name: r.query, type: r.type, tags: [] },
  percentile,
  affinity: null,
  ageSkew: null,
  verdict,
  notes: [],
  evidence: [],
});

describe("cellFor", () => {
  it("averages the measured percentiles and counts verdicts, sharing scores across variants", () => {
    const a = ref("Cheers");
    const b = ref("Fleetwood Mac", "artist");
    const c = ref("Nowhere Band", "artist");
    const byKey = new Map([
      ["tv_show|cheers", scored(a, 20, "misses")],
      ["artist|fleetwood mac", scored(b, 70, "lands")],
      ["artist|nowhere band", scored(c, null, "unmeasured")],
    ]);
    const cell = cellFor(1, 2, [a, b, c], byKey);
    expect(cell).toMatchObject({ variant: 1, audience: 2, fit: 45, counts: { lands: 1, mixed: 0, misses: 1, unmeasured: 1 } });
    expect(cell.refs.map((r) => r.verdict)).toEqual(["misses", "lands", "unmeasured"]);
  });
  it("has no fit when nothing was measured", () => {
    expect(cellFor(0, 0, [], new Map()).fit).toBeNull();
  });
});

describe("variantsFromCsv", () => {
  it("reads a copy column with quoted commas and newlines, and a name column", () => {
    const csv = 'name,copy\nRock,"Like a Fleetwood Mac record, and Cheers"\nPop,"Like a Bad Bunny drop\nand Euphoria"\n';
    expect(variantsFromCsv(csv)).toEqual([
      { name: "Rock", text: "Like a Fleetwood Mac record, and Cheers" },
      { name: "Pop", text: "Like a Bad Bunny drop\nand Euphoria" },
    ]);
  });
  it("takes the last column when there is no header, and names variants A, B…", () => {
    expect(variantsFromCsv("x,First ad\ny,Second ad")).toEqual([
      { name: "Variant A", text: "First ad" },
      { name: "Variant B", text: "Second ad" },
    ]);
  });
  it("keeps at most five variants and handles escaped quotes", () => {
    expect(parseCsv('a,"say ""hi"""')).toEqual([["a", 'say "hi"']]);
    expect(variantsFromCsv(Array.from({ length: 8 }, (_, i) => `ad ${i}`).join("\n"))).toHaveLength(5);
  });
});
