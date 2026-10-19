import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QlooError } from "../client";
import {
  ageSkew,
  audienceSignals,
  findEquivalents,
  percentileOf,
  resolveEntity,
  scoreForAudience,
  type Audience,
  type ResolvedEntity,
} from "../tools";

const anchor: ResolvedEntity = { id: "anchor-1", name: "Bad Bunny", type: "artist", tags: [] };
const audience: Audience = { label: "Gen Z", anchors: [anchor], age: "24_and_younger", location: "Atlanta" };

let requests: URL[] = [];
function mockFetch(...bodies: { status?: number; body: unknown }[]) {
  const queue = [...bodies];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      requests.push(new URL(input));
      const next = queue.shift() ?? { body: {} };
      return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
    }),
  );
}

beforeEach(() => {
  requests = [];
  process.env.QLOO_RETRY_BASE_MS = "1";
  process.env.QLOO_API_KEY = "test-key";
  process.env.QLOO_BASE_URL = `https://example.test/${Math.random()}`; // unique host per test defeats the cache
});
afterEach(() => vi.unstubAllGlobals());

describe("audienceSignals", () => {
  it("applies location only to place-like types", () => {
    expect(audienceSignals(audience, "tv_show")["signal.location.query"]).toBeUndefined();
    expect(audienceSignals(audience, "brand")["signal.location.query"]).toBe("Atlanta");
  });
});

describe("audienceSignals with segments and tags", () => {
  it("sends segment ids and tag ids as Qloo signals", () => {
    const s = audienceSignals({ label: "x", anchors: [], segments: ["urn:audience:leisure:foodie"], tags: ["urn:tag:genre:music:reggaeton"] }, "artist");
    expect(s["signal.demographics.audiences"]).toBe("urn:audience:leisure:foodie");
    expect(s["signal.interests.tags"]).toBe("urn:tag:genre:music:reggaeton");
    expect(s["signal.interests.entities"]).toBeUndefined();
  });
});

describe("resolveEntity", () => {
  it("returns the top search result with genre tags kept", async () => {
    mockFetch({
      body: { results: [{ entity_id: "e1", name: "Seinfeld", popularity: 0.9, tags: [{ id: "urn:tag:genre:media:comedy", name: "Comedy" }] }] },
    });
    const r = await resolveEntity("Seinfeld", "tv_show");
    expect(r.entity?.id).toBe("e1");
    expect(r.entity?.tags[0].id).toContain(":genre:");
    expect(requests[0].pathname.endsWith("/search")).toBe(true);
    expect(requests[0].searchParams.get("types")).toBe("urn:entity:tv_show");
  });
});

describe("scoreForAudience", () => {
  it("sends the audience signals and reads affinity from query.affinity or top level", async () => {
    mockFetch({
      body: {
        results: {
          entities: [
            { entity_id: "e1", name: "A", query: { affinity: 0.8 } },
            { entity_id: "e2", name: "B", affinity: 0.3 },
            { entity_id: "e3", name: "C" },
          ],
        },
      },
    });
    const r = await scoreForAudience(["e1", "e2", "e3"], "tv_show", audience);
    expect(r.scores).toEqual([
      { entityId: "e1", affinity: 0.8 },
      { entityId: "e2", affinity: 0.3 },
    ]);
    const p = requests[0].searchParams;
    expect(p.get("filter.results.entities")).toBe("e1,e2,e3");
    expect(p.get("signal.interests.entities")).toBe("anchor-1");
    expect(p.get("signal.demographics.age")).toBe("24_and_younger");
    expect(p.has("signal.location.query")).toBe(false);
  });
});

describe("percentileOf", () => {
  it("ranks against the sorted baseline", () => {
    expect(percentileOf(0.5, [0.1, 0.2, 0.6, 0.9])).toBe(50);
    expect(percentileOf(1, [0.1, 0.2])).toBe(100);
    expect(percentileOf(0.5, [])).toBe(0);
  });
});

describe("ageSkew", () => {
  it("returns the age profile", async () => {
    mockFetch({ body: { results: { demographics: [{ entity_id: "e1", query: { age: { "55_and_older": 0.4 } } }] } } });
    const r = await ageSkew("e1");
    expect(r.age).toEqual({ "55_and_older": 0.4 });
    expect(requests[0].searchParams.get("filter.type")).toBe("urn:demographics");
  });
});

describe("findEquivalents", () => {
  const original: ResolvedEntity = {
    id: "orig",
    name: "Seinfeld",
    type: "tv_show",
    tags: [{ id: "urn:tag:genre:media:comedy", name: "Comedy" }, { id: "urn:tag:keyword:media:nyc", name: "NYC" }],
  };

  it("uses genre tags first and relaxes when nothing comes back", async () => {
    mockFetch(
      { body: { results: { entities: [] } } },
      { body: { results: { entities: [{ entity_id: "c1", name: "Abbott Elementary", query: { affinity: 0.7 } }] } } },
    );
    const r = await findEquivalents(original, audience);
    expect(requests[0].searchParams.get("filter.tags")).toBe("urn:tag:genre:media:comedy");
    expect(requests[0].searchParams.get("filter.exclude.entities")).toBe("orig");
    expect(requests[1].searchParams.has("filter.tags")).toBe(false);
    expect(r.relaxed).toEqual(["genre_tags"]);
    expect(r.candidates[0]).toMatchObject({ id: "c1", affinity: 0.7 });
    expect(r.evidence).toHaveLength(2);
  });
});

describe("client errors", () => {
  it("retries 429s with backoff, then reports rate limiting", async () => {
    mockFetch(...Array.from({ length: 4 }, () => ({ status: 429, body: {} })));
    await expect(resolveEntity("x", "movie")).rejects.toMatchObject({ code: "rate_limited" });
    expect(requests).toHaveLength(4);
  });

  it("recovers when a retry succeeds", async () => {
    mockFetch({ status: 429, body: {} }, { body: { results: [{ entity_id: "e1", name: "X" }] } });
    const r = await resolveEntity("x", "movie");
    expect(r.entity?.id).toBe("e1");
  });

  it("shares one request between identical concurrent calls", async () => {
    mockFetch({ body: { results: [{ entity_id: "e1", name: "X" }] } });
    const [a, b] = await Promise.all([resolveEntity("x", "movie"), resolveEntity("x", "movie")]);
    expect(a.entity?.id).toBe("e1");
    expect(b.entity?.id).toBe("e1");
    expect(requests).toHaveLength(1);
  });

  it("does not retry auth failures", async () => {
    mockFetch({ status: 401, body: { error: "No API key found in request" } });
    await expect(resolveEntity("x", "movie")).rejects.toBeInstanceOf(QlooError);
    expect(requests).toHaveLength(1);
  });
});
