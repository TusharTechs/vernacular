// Day 1 go/no-go data test. Run: npm run qloo:data-test
//
// The expectations below are fixed before any live data is seen. The script
// measures whether Qloo's data supports Vernacular's core claim (audience-
// conditioned affinity separates references by audience) and Breakout's
// (weekly trending history flags known breakouts before they peak).
//
// Raw responses go to .cache/data-test/ (git-ignored). The summary goes to
// .cache/data-test/report.md; the Oct 19 run's summary is kept in docs/FINDINGS.md
// (aggregate results and a few examples only).

import { mkdirSync, writeFileSync } from "node:fs";
import { qlooGet, QlooError } from "../src/lib/qloo/client";
import { urn, type AgeBand, type EntityType } from "../src/lib/qloo/params";

type Tag = { id?: string; tag_id?: string; name?: string; type?: string };
type Entity = {
  entity_id: string;
  name: string;
  popularity?: number;
  tags?: Tag[];
  query?: Record<string, unknown>;
  [k: string]: unknown;
};

const RAW = ".cache/data-test";
mkdirSync(RAW, { recursive: true });
mkdirSync("docs", { recursive: true });
let calls = 0;
const log: string[] = [];
const say = (s = "") => {
  console.log(s);
  log.push(s);
};

async function get<T>(path: string, params: Record<string, string | number | undefined>, name: string) {
  calls++;
  const r = await qlooGet<T>(path, params);
  writeFileSync(`${RAW}/${String(calls).padStart(3, "0")}-${name}.json`, JSON.stringify({ params, data: r.data }, null, 2));
  return r.data;
}

// Affinity's exact JSON path is not pinned down in the docs, so try the candidates.
let affinityPath = "unknown";
function affinityOf(e: Entity): number | undefined {
  const candidates: [string, unknown][] = [
    ["query.affinity", e.query?.affinity],
    ["affinity", e.affinity],
    ["query.affinity_score", e.query?.affinity_score],
  ];
  for (const [p, v] of candidates) {
    if (typeof v === "number") {
      affinityPath = p;
      return v;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------- inputs

type Ref = { q: string; type: EntityType; home: AudienceKey };
type AudienceKey = "genz_latin_pop" | "country_45_54" | "indie_25_29" | "age_55_plus";

const REFS: Ref[] = [
  { q: "Seinfeld", type: "tv_show", home: "age_55_plus" },
  { q: "Euphoria", type: "tv_show", home: "genz_latin_pop" },
  { q: "Yellowstone", type: "tv_show", home: "country_45_54" },
  { q: "Fleabag", type: "tv_show", home: "indie_25_29" },
  { q: "Murder, She Wrote", type: "tv_show", home: "age_55_plus" },
  { q: "Top Gun", type: "movie", home: "country_45_54" },
  { q: "Lady Bird", type: "movie", home: "indie_25_29" },
  { q: "The Sound of Music", type: "movie", home: "age_55_plus" },
  { q: "Spider-Man: Across the Spider-Verse", type: "movie", home: "genz_latin_pop" },
  { q: "Frank Sinatra", type: "artist", home: "age_55_plus" },
  { q: "Karol G", type: "artist", home: "genz_latin_pop" },
  { q: "Luke Combs", type: "artist", home: "country_45_54" },
  { q: "Big Thief", type: "artist", home: "indie_25_29" },
  { q: "Peso Pluma", type: "artist", home: "genz_latin_pop" },
  { q: "Cracker Barrel", type: "brand", home: "country_45_54" },
  { q: "Glossier", type: "brand", home: "indie_25_29" },
  { q: "Buick", type: "brand", home: "age_55_plus" },
  { q: "Bass Pro Shops", type: "brand", home: "country_45_54" },
  { q: "Fenty Beauty", type: "brand", home: "genz_latin_pop" },
  { q: "Patagonia", type: "brand", home: "indie_25_29" },
];

const AUDIENCES: Record<AudienceKey, { label: string; anchors: { q: string; type: EntityType }[]; age?: AgeBand }> = {
  genz_latin_pop: { label: "Gen Z, Bad Bunny + Euphoria fans", anchors: [{ q: "Bad Bunny", type: "artist" }, { q: "Euphoria", type: "tv_show" }], age: "24_and_younger" },
  country_45_54: { label: "45–54, Garth Brooks + Yellowstone fans", anchors: [{ q: "Garth Brooks", type: "artist" }, { q: "Yellowstone", type: "tv_show" }], age: "45_to_54" },
  indie_25_29: { label: "25–29, Phoebe Bridgers + A24 fans", anchors: [{ q: "Phoebe Bridgers", type: "artist" }, { q: "Everything Everywhere All at Once", type: "movie" }], age: "25_to_29" },
  age_55_plus: { label: "55 and older, no taste anchors", anchors: [], age: "55_and_older" },
};

// Known breakouts (rough public peak) and stable controls, for the Breakout test.
const BREAKOUTS = [
  { q: "Chappell Roan", peak: "2024-08" },
  { q: "Sabrina Carpenter", peak: "2024-08" },
  { q: "Benson Boone", peak: "2024-06" },
  { q: "Doechii", peak: "2025-02" },
];
const CONTROLS = ["Taylor Swift", "Coldplay"];

// ---------------------------------------------------------------- helpers

const resolved = new Map<string, Entity>();
async function resolve(q: string, type: EntityType): Promise<Entity | undefined> {
  const key = `${type}:${q}`;
  if (resolved.has(key)) return resolved.get(key);
  const d = await get<{ results?: Entity[] }>("/search", { query: q, types: urn(type), take: 3 }, `search-${type}`);
  const top = d.results?.[0];
  if (top) resolved.set(key, top);
  return top;
}

function signalsFor(anchorIds: string[], age?: AgeBand) {
  return {
    "signal.interests.entities": anchorIds.length ? anchorIds.join(",") : undefined,
    "signal.demographics.age": age,
  };
}

const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

// ---------------------------------------------------------------- tests

async function vernacularTest() {
  say("## Vernacular: does audience-conditioned affinity separate references?\n");
  const anchorIds: Record<AudienceKey, string[]> = {} as never;
  for (const [k, a] of Object.entries(AUDIENCES) as [AudienceKey, (typeof AUDIENCES)[AudienceKey]][]) {
    const ids: string[] = [];
    for (const an of a.anchors) {
      const e = await resolve(an.q, an.type);
      if (e) ids.push(e.entity_id);
      else say(`- could not resolve anchor "${an.q}"`);
    }
    anchorIds[k] = ids;
  }

  const refEntities: { ref: Ref; e: Entity }[] = [];
  for (const ref of REFS) {
    const e = await resolve(ref.q, ref.type);
    if (!e) say(`- could not resolve reference "${ref.q}" (${ref.type})`);
    else refEntities.push({ ref, e });
  }
  say(`Resolved ${refEntities.length}/${REFS.length} references.\n`);

  // affinity[ref][audience]
  const aff = new Map<string, Partial<Record<AudienceKey, number>>>();
  const types = [...new Set(refEntities.map((r) => r.ref.type))];
  for (const type of types) {
    const ids = refEntities.filter((r) => r.ref.type === type).map((r) => r.e.entity_id);
    for (const k of Object.keys(AUDIENCES) as AudienceKey[]) {
      const d = await get<{ results?: { entities?: Entity[] } }>(
        "/v2/insights",
        { "filter.type": urn(type), ...signalsFor(anchorIds[k], AUDIENCES[k].age), "filter.results.entities": ids.join(","), take: 50 },
        `score-${type}-${k}`,
      );
      for (const e of d.results?.entities ?? []) {
        const a = affinityOf(e);
        if (a === undefined) continue;
        aff.set(e.entity_id, { ...aff.get(e.entity_id), [k]: a });
      }
    }
  }
  say(`Affinity found at \`${affinityPath}\`.\n`);

  let homeHits = 0;
  let scored = 0;
  let bigSpread = 0;
  const rows: string[] = [];
  for (const { ref, e } of refEntities) {
    const byAud = aff.get(e.entity_id) ?? {};
    const vals = Object.entries(byAud) as [AudienceKey, number][];
    if (vals.length < 2) {
      rows.push(`| ${ref.q} | ${ref.type} | ${ref.home} | not returned | – |`);
      continue;
    }
    scored++;
    const best = vals.reduce((m, v) => (v[1] > m[1] ? v : m));
    const spread = Math.max(...vals.map((v) => v[1])) - Math.min(...vals.map((v) => v[1]));
    if (best[0] === ref.home) homeHits++;
    if (spread >= 0.25) bigSpread++;
    rows.push(`| ${ref.q} | ${ref.type} | ${ref.home} | ${best[0]}${best[0] === ref.home ? " ✓" : ""} | ${spread.toFixed(2)} |`);
  }
  say("| Reference | Type | Expected home | Highest-affinity audience | Spread |");
  say("|---|---|---|---|---|");
  rows.forEach((r) => say(r));
  say("");
  say(`- Scored for ≥2 audiences: ${scored}/${refEntities.length}`);
  say(`- Highest affinity in the expected audience: ${homeHits}/${scored} (${pct(homeHits, scored)}%) · pass if ≥ 60%`);
  say(`- Spread ≥ 0.25 between audiences: ${bigSpread}/${scored} (${pct(bigSpread, scored)}%) · pass if ≥ 60%`);

  // Invariance: does scoring one reference alone match scoring it in a batch?
  const probe = refEntities.find((r) => r.ref.type === "tv_show");
  if (probe) {
    const alone = await get<{ results?: { entities?: Entity[] } }>(
      "/v2/insights",
      { "filter.type": urn("tv_show"), ...signalsFor(anchorIds.genz_latin_pop, "24_and_younger"), "filter.results.entities": probe.e.entity_id },
      "invariance-alone",
    );
    const a1 = alone.results?.entities?.[0] ? affinityOf(alone.results.entities[0]) : undefined;
    const a2 = aff.get(probe.e.entity_id)?.genz_latin_pop;
    say(`- Batch invariance (${probe.ref.q}): alone=${a1?.toFixed(4) ?? "n/a"} vs batch=${a2?.toFixed(4) ?? "n/a"}`);
  }

  // Location: does signal.location.query move a media reference?
  if (probe) {
    const loc: Record<string, number | undefined> = {};
    for (const city of ["Atlanta", "Salt Lake City"]) {
      const d = await get<{ results?: { entities?: Entity[] } }>(
        "/v2/insights",
        { "filter.type": urn("tv_show"), "signal.location.query": city, "filter.results.entities": probe.e.entity_id },
        `location-${city.replace(/\W/g, "")}`,
      );
      loc[city] = d.results?.entities?.[0] ? affinityOf(d.results.entities[0]) : undefined;
    }
    say(`- signal.location.query on a TV show (${probe.ref.q}): ${JSON.stringify(loc)}`);
  }

  // Demographics: does urn:demographics return an age profile for media entities?
  let demoOk = 0;
  const demoProbe = refEntities.filter((r) => ["tv_show", "movie", "artist"].includes(r.ref.type)).slice(0, 5);
  for (const { ref, e } of demoProbe) {
    const d = await get<{ results?: { demographics?: { query?: { age?: Record<string, number> } }[] } }>(
      "/v2/insights",
      { "filter.type": "urn:demographics", "signal.interests.entities": e.entity_id },
      `demographics-${ref.type}`,
    );
    const age = d.results?.demographics?.[0]?.query?.age;
    if (age && Object.keys(age).length) {
      demoOk++;
      const top = Object.entries(age).reduce((m, v) => (v[1] > m[1] ? v : m));
      say(`- Age skew of ${ref.q}: strongest in ${top[0]} (${top[1]})`);
    }
  }
  say(`- Demographics returned for ${demoOk}/${demoProbe.length} media references · pass if ≥ 4`);

  // Equivalents: same type, the reference's genre tags, the target audience, recognisable.
  say("\n### Equivalent candidates (for manual face-validity review)\n");
  const cases: [string, AudienceKey][] = [
    ["Seinfeld", "genz_latin_pop"],
    ["Frank Sinatra", "genz_latin_pop"],
    ["Top Gun", "indie_25_29"],
    ["Cracker Barrel", "indie_25_29"],
    ["Euphoria", "age_55_plus"],
  ];
  for (const [q, k] of cases) {
    const r = refEntities.find((x) => x.ref.q === q);
    if (!r) continue;
    const genre = (r.e.tags ?? [])
      .map((t) => t.id ?? t.tag_id)
      .filter((id): id is string => !!id && id.includes(":genre:"))
      .slice(0, 3);
    const d = await get<{ results?: { entities?: Entity[] } }>(
      "/v2/insights",
      {
        "filter.type": urn(r.ref.type),
        ...signalsFor(anchorIds[k], AUDIENCES[k].age),
        "filter.tags": genre.length ? genre.join(",") : undefined,
        "filter.popularity.min": 0.5,
        "filter.exclude.entities": r.e.entity_id,
        "feature.explainability": "true",
        take: 5,
      },
      `equivalents-${k}`,
    );
    const names = (d.results?.entities ?? []).map((e) => e.name);
    say(`- **${q}** → ${AUDIENCES[k].label} (genre tags: ${genre.length}): ${names.join(", ") || "none returned"}`);
  }
}

async function breakoutTest() {
  say("\n## Breakout: does weekly trending history flag breakouts before they peak?\n");
  for (const name of [...BREAKOUTS.map((b) => b.q), ...CONTROLS]) {
    const e = await resolve(name, "artist");
    if (!e) {
      say(`- could not resolve ${name}`);
      continue;
    }
    const d = await get<{ results?: { trending?: { date: string; population_percentile?: number; population_rank_velocity?: number }[] } }>(
      "/v2/trending",
      { "filter.type": urn("artist"), "signal.interests.entities": e.entity_id, "filter.start_date": "2023-06-01", "filter.end_date": "2026-10-12" },
      "trending-artist",
    );
    const series = (d.results?.trending ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (!series.length) {
      say(`- ${name}: no trending history returned`);
      continue;
    }
    const peak = series.reduce((m, v) => ((v.population_percentile ?? 0) > (m.population_percentile ?? 0) ? v : m));
    const known = BREAKOUTS.find((b) => b.q === name)?.peak;
    const firstRise = series.find((v) => (v.population_rank_velocity ?? 0) > 0);
    say(
      `- ${name}: ${series.length} weeks (${series[0].date} → ${series.at(-1)!.date}); data peak ${peak.date} at p${peak.population_percentile}` +
        (known ? `; public peak ~${known}; first positive velocity ${firstRise?.date ?? "none"}` : " (control)"),
    );
  }
  const noSignal = await get<{ results?: unknown }>(
    "/v2/trending",
    { "filter.type": urn("artist"), "filter.start_date": "2026-09-01", "filter.end_date": "2026-10-12", take: 10 },
    "trending-nosignal",
  ).catch((err: unknown) => ({ error: (err as Error).message }));
  say(`- Trending without an entity: ${JSON.stringify(noSignal).slice(0, 300)}`);
}

async function main() {
  const started = new Date().toISOString();
  say(`# Findings: day 1 data test\n\nRun ${started} against ${process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com"}. Expectations were fixed in \`scripts/data-test.ts\` before the run.\n`);
  await vernacularTest();
  await breakoutTest();
  say(`\nTotal Qloo calls: ${calls}. Raw responses: \`${RAW}/\` (git-ignored).`);
  writeFileSync(`${RAW}/report.md`, log.join("\n") + "\n");
  console.log(`\nWrote ${RAW}/report.md`);
}

main().catch((err) => {
  if (err instanceof QlooError) console.error(`\nQloo error [${err.code}]${err.status ? ` ${err.status}` : ""}: ${err.message}`);
  else console.error("\nFailed:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
