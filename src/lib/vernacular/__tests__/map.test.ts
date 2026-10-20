import { describe, expect, it } from "vitest";
import { areaKm2, parseWkt, thin } from "../../qloo/geo";
import { neighbourhoods, overlapOf } from "../map";

// A ~1.1 km × 1.1 km square near downtown Chicago.
const square = (lon: number, lat: number, d = 0.01) =>
  `POLYGON ((${lon} ${lat}, ${lon + d} ${lat}, ${lon + d} ${lat + d}, ${lon} ${lat + d}, ${lon} ${lat}))`;

describe("WKT parsing", () => {
  it("reads polygons and the outer ring of each multipolygon part", () => {
    expect(parseWkt(square(-87.6, 41.8))[0]).toHaveLength(5);
    const multi = "MULTIPOLYGON (((0 0, 1 0, 1 1, 0 0), (0.2 0.2, 0.3 0.2, 0.3 0.3, 0.2 0.2)), ((5 5, 6 5, 6 6, 5 5)))";
    const rings = parseWkt(multi);
    expect(rings).toHaveLength(2);
    expect(rings[1][0]).toEqual([5, 5]);
    expect(parseWkt("POINT (-87.7 41.8)")).toEqual([]);
  });

  it("measures area at city scale and thins dense outlines", () => {
    expect(areaKm2(parseWkt(square(-87.6, 41.8)))).toBeCloseTo(0.92, 1);
    const dense = Array.from({ length: 200 }, (_, i) => [-87.6 + i * 0.0001, 41.8] as [number, number]);
    expect(thin(dense).length).toBeLessThan(20);
  });
});

describe("neighbourhood filtering", () => {
  const loc = (id: string, name: string, affinity: number, boundary: string) => ({ id, name, affinity, boundary });

  it("keeps real neighbourhoods near the city, strongest first", () => {
    const hoods = neighbourhoods("Chicago", [
      loc("a", "Hermosa", 0.9, square(-87.73, 41.92)),
      loc("b", "Belmont Cragin", 1, square(-87.76, 41.93)),
      loc("c", "Cook County", 0.95, square(-87.7, 41.9, 0.5)),
      loc("d", "Lake View Township", 0.8, square(-87.65, 41.94)),
      loc("e", "Chicago", 0.99, square(-87.65, 41.88)),
      loc("f", "Little Village", 0.7, "POINT (-87.7 41.84)"),
      loc("g", "Faraway", 0.6, square(-80, 30)),
      loc("h", "Pilsen", 0.5, square(-87.66, 41.85)),
    ]);
    expect(hoods.map((h) => h.name)).toEqual(["Belmont Cragin", "Hermosa", "Pilsen"]);
  });

  it("counts how many of the audience's top neighbourhoods a reference reaches", () => {
    const audience = Array.from({ length: 12 }, (_, i) => `n${i}`);
    expect(overlapOf(audience, ["n0", "n3", "n11", "x"])).toBe(2);
    expect(overlapOf(audience, [])).toBe(0);
  });
});
