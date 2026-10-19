// Smoke test for the Qloo hackathon API.
// Run: npm run qloo:smoke   (reads QLOO_API_KEY from .env.local)
//
// Proves: auth works, /search resolves entities, /v2/insights scores a known
// entity for two contrasting audiences, and shows where `affinity` lives in
// the live response. Raw responses go to .cache/smoke/ (git-ignored, because
// Qloo data must not be committed to a public repo).

import { mkdirSync, writeFileSync } from "node:fs";
import { qlooGet, QlooError } from "../src/lib/qloo/client";
import { urn } from "../src/lib/qloo/params";

type Entity = { entity_id: string; name: string; popularity?: number; [k: string]: unknown };

const OUT = ".cache/smoke";
mkdirSync(OUT, { recursive: true });
const save = (name: string, data: unknown) => writeFileSync(`${OUT}/${name}.json`, JSON.stringify(data, null, 2));

function findPaths(obj: unknown, needle: string, prefix = ""): string[] {
  if (!obj || typeof obj !== "object") return [];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const p = prefix ? `${prefix}.${k}` : k;
    const here = k.toLowerCase().includes(needle) && typeof v !== "object" ? [`${p} = ${v}`] : [];
    return [...here, ...findPaths(v, needle, p)];
  });
}

async function search(query: string, type: Parameters<typeof urn>[0]) {
  const r = await qlooGet<{ results: Entity[] }>("/search", { query, types: urn(type), take: 3 });
  save(`search-${type}-${query.replace(/\W+/g, "_")}`, r.data);
  const top = r.data.results?.[0];
  console.log(`  /search "${query}" (${type}) → ${r.data.results?.length ?? 0} results in ${r.meta.ms} ms`);
  for (const e of r.data.results ?? []) console.log(`     · ${e.name}  id=${e.entity_id}  popularity=${e.popularity ?? "?"}`);
  if (!top) throw new Error(`No search result for "${query}"`);
  return top;
}

async function main() {
  console.log("Qloo smoke test →", process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com");

  console.log("\n1. Resolve references and an audience anchor");
  const seinfeld = await search("Seinfeld", "tv_show");
  const euphoria = await search("Euphoria", "tv_show");
  const anchor = await search("Bad Bunny", "artist");

  console.log("\n2. Score the references for two audiences (same anchor, different age band)");
  const results: Record<string, unknown> = {};
  for (const age of ["24_and_younger", "55_and_older"] as const) {
    const r = await qlooGet<{ results?: { entities?: Entity[] } }>("/v2/insights", {
      "filter.type": urn("tv_show"),
      "signal.interests.entities": anchor.entity_id,
      "signal.demographics.age": age,
      "filter.results.entities": `${seinfeld.entity_id},${euphoria.entity_id}`,
    });
    save(`insights-score-${age}`, r.data);
    const ents = r.data.results?.entities ?? [];
    console.log(`  age=${age} → ${ents.length} entities in ${r.meta.ms} ms`);
    for (const e of ents) {
      console.log(`     · ${e.name}`);
      for (const p of findPaths(e, "affinity")) console.log(`         ${p}`);
    }
    results[age] = ents.map((e) => ({ name: e.name, affinity: findPaths(e, "affinity") }));
  }

  console.log("\n3. Age skew of one reference (urn:demographics)");
  const demo = await qlooGet("/v2/insights", {
    "filter.type": "urn:demographics",
    "signal.interests.entities": seinfeld.entity_id,
  });
  save("insights-demographics-seinfeld", demo.data);
  console.log(`  ${JSON.stringify(demo.data).slice(0, 400)}…`);

  console.log(`\nOK. Raw responses saved in ${OUT}/ (git-ignored).`);
}

main().catch((err) => {
  if (err instanceof QlooError) console.error(`\nQloo error [${err.code}]${err.status ? ` ${err.status}` : ""}: ${err.message}`);
  else console.error("\nFailed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
