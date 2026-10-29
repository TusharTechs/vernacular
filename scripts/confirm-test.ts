// Confirmatory test, written after the exploratory day 1 run and before this
// run. New references, new audiences, expectations and thresholds fixed here.
// Run: npm run qloo:confirm-test
//
// Question (the product's real one): within ONE audience, does Qloo rank the
// references that belong to that audience above references that belong to a
// clearly different audience?
//
// Pass criteria (fixed in advance):
//   P1 within-audience pairwise accuracy ≥ 75% (chance = 50%)
//   P2 the lowest-scored reference in each audience×type cell is NOT one of
//      that audience's own references in ≥ 75% of cells
//   P3 brands: signal.location.query changes affinity between two cities and
//      ranks Waffle House above Trader Joe's in Atlanta but not in Seattle
//
// Uses the production tools layer (src/lib/qloo/tools.ts).

import { mkdirSync, writeFileSync } from "node:fs";
import { resolveEntity, scoreForAudience, type Audience, type ResolvedEntity } from "../src/lib/qloo/tools";
import { QlooError } from "../src/lib/qloo/client";
import type { AgeBand, EntityType } from "../src/lib/qloo/params";

type Key = "kpop_genz" | "hiphop_30s" | "classic_rock_55" | "foodie_35_44";

const AUDIENCES: Record<Key, { label: string; anchors: [string, EntityType][]; age: AgeBand }> = {
  kpop_genz: { label: "24 and younger · NewJeans + Jujutsu Kaisen", anchors: [["NewJeans", "artist"], ["Jujutsu Kaisen", "tv_show"]], age: "24_and_younger" },
  hiphop_30s: { label: "30–34 · Kendrick Lamar + Atlanta (FX)", anchors: [["Kendrick Lamar", "artist"], ["Atlanta", "tv_show"]], age: "30_to_34" },
  classic_rock_55: { label: "55 and older · Eagles + M*A*S*H", anchors: [["Eagles", "artist"], ["M*A*S*H", "tv_show"]], age: "55_and_older" },
  foodie_35_44: { label: "35–44 · The Bear + Le Creuset", anchors: [["The Bear", "tv_show"], ["Le Creuset", "brand"]], age: "35_to_44" },
};

const REFS: { q: string; type: EntityType; home: Key }[] = [
  { q: "Stray Kids", type: "artist", home: "kpop_genz" },
  { q: "BLACKPINK", type: "artist", home: "kpop_genz" },
  { q: "Olivia Rodrigo", type: "artist", home: "kpop_genz" },
  { q: "Drake", type: "artist", home: "hiphop_30s" },
  { q: "J. Cole", type: "artist", home: "hiphop_30s" },
  { q: "Fleetwood Mac", type: "artist", home: "classic_rock_55" },
  { q: "Bruce Springsteen", type: "artist", home: "classic_rock_55" },
  { q: "Vampire Weekend", type: "artist", home: "foodie_35_44" },
  { q: "Demon Slayer: Kimetsu no Yaiba", type: "tv_show", home: "kpop_genz" },
  { q: "Insecure", type: "tv_show", home: "hiphop_30s" },
  { q: "Cheers", type: "tv_show", home: "classic_rock_55" },
  { q: "The Golden Girls", type: "tv_show", home: "classic_rock_55" },
  { q: "Succession", type: "tv_show", home: "foodie_35_44" },
  { q: "Chef's Table", type: "tv_show", home: "foodie_35_44" },
  { q: "Your Name", type: "movie", home: "kpop_genz" },
  { q: "Black Panther", type: "movie", home: "hiphop_30s" },
  { q: "The Godfather", type: "movie", home: "classic_rock_55" },
  { q: "The Menu", type: "movie", home: "foodie_35_44" },
  { q: "Shein", type: "brand", home: "kpop_genz" },
  { q: "Air Jordan", type: "brand", home: "hiphop_30s" },
  { q: "Popeyes", type: "brand", home: "hiphop_30s" },
  { q: "Harley-Davidson", type: "brand", home: "classic_rock_55" },
  { q: "Williams-Sonoma", type: "brand", home: "foodie_35_44" },
  { q: "Trader Joe's", type: "brand", home: "foodie_35_44" },
];

const lines: string[] = [];
const say = (s = "") => {
  console.log(s);
  lines.push(s);
};

async function main() {
  mkdirSync(".cache/confirm-test", { recursive: true });
  say(`\n---\n\n# Confirmatory test\n\nRun ${new Date().toISOString()}. Expectations and thresholds fixed in \`scripts/confirm-test.ts\` before the run; new references and audiences, none reused from the exploratory run.\n`);

  const audiences = {} as Record<Key, Audience>;
  for (const [k, a] of Object.entries(AUDIENCES) as [Key, (typeof AUDIENCES)[Key]][]) {
    const anchors: ResolvedEntity[] = [];
    for (const [q, t] of a.anchors) {
      const r = await resolveEntity(q, t);
      if (r.entity) anchors.push(r.entity);
      else say(`- anchor not resolved: ${q}`);
    }
    audiences[k] = { label: a.label, anchors, age: a.age };
    say(`- ${a.label} → anchors resolved as ${anchors.map((x) => x.name).join(", ")}`);
  }

  const refs: { q: string; type: EntityType; home: Key; e: ResolvedEntity }[] = [];
  for (const r of REFS) {
    const res = await resolveEntity(r.q, r.type);
    if (res.entity) refs.push({ ...r, e: res.entity });
    else say(`- reference not resolved: ${r.q}`);
  }
  say(`- references resolved: ${refs.length}/${REFS.length} (${refs.map((r) => `${r.q}→${r.e.name}`).filter((s) => s.split("→")[0] !== s.split("→")[1]).join("; ") || "all names matched"})\n`);

  let pairsOk = 0, pairs = 0, cellsOk = 0, cells = 0;
  const raw: unknown[] = [];
  for (const k of Object.keys(AUDIENCES) as Key[]) {
    const row: string[] = [];
    for (const type of [...new Set(refs.map((r) => r.type))]) {
      const inType = refs.filter((r) => r.type === type);
      const { scores, evidence } = await scoreForAudience(inType.map((r) => r.e.id), type, audiences[k]);
      raw.push({ audience: k, type, scores, evidence });
      const aff = new Map(scores.map((s) => [s.entityId, s.affinity]));
      const present = inType.filter((r) => aff.has(r.e.id));
      const mine = present.filter((r) => r.home === k);
      const other = present.filter((r) => r.home !== k);
      for (const x of mine) for (const y of other) {
        pairs++;
        if (aff.get(x.e.id)! > aff.get(y.e.id)!) pairsOk++;
      }
      if (mine.length && other.length) {
        cells++;
        const lowest = present.reduce((m, r) => (aff.get(r.e.id)! < aff.get(m.e.id)! ? r : m));
        if (lowest.home !== k) cellsOk++;
        row.push(`${type}: top ${present.reduce((m, r) => (aff.get(r.e.id)! > aff.get(m.e.id)! ? r : m)).q}, bottom ${lowest.q}`);
      }
    }
    say(`- **${AUDIENCES[k].label}**: ${row.join(" · ")}`);
  }
  writeFileSync(".cache/confirm-test/scores.json", JSON.stringify(raw, null, 2));

  const p1 = pairs ? (100 * pairsOk) / pairs : 0;
  const p2 = cells ? (100 * cellsOk) / cells : 0;
  say(`\n- P1 within-audience pairwise accuracy: ${pairsOk}/${pairs} = ${p1.toFixed(0)}% · ${p1 >= 75 ? "PASS" : "FAIL"} (≥ 75%)`);
  say(`- P2 lowest-scored reference is an outsider: ${cellsOk}/${cells} cells = ${p2.toFixed(0)}% · ${p2 >= 75 ? "PASS" : "FAIL"} (≥ 75%)`);

  // P3: location on brands.
  const brands: ResolvedEntity[] = [];
  for (const q of ["Waffle House", "Trader Joe's", "Popeyes", "Whole Foods Market"]) {
    const r = await resolveEntity(q, "brand");
    if (r.entity) brands.push(r.entity);
  }
  const byCity: Record<string, Record<string, number>> = {};
  for (const city of ["Atlanta", "Seattle"]) {
    const { scores } = await scoreForAudience(brands.map((b) => b.id), "brand", { label: city, anchors: [], location: city });
    byCity[city] = Object.fromEntries(scores.map((s) => [brands.find((b) => b.id === s.entityId)!.name, Number(s.affinity.toFixed(3))]));
  }
  const wh = (c: string) => byCity[c]?.["Waffle House"];
  const tj = (c: string) => byCity[c]?.["Trader Joe's"];
  const changed = JSON.stringify(byCity.Atlanta) !== JSON.stringify(byCity.Seattle);
  const p3 = changed && wh("Atlanta") > tj("Atlanta") && !(wh("Seattle") > tj("Seattle"));
  say(`- P3 brand location: ${JSON.stringify(byCity)} · ${p3 ? "PASS" : "FAIL"}`);

  writeFileSync(".cache/confirm-test/report.md", lines.join("\n") + "\n");
  console.log("\nWrote .cache/confirm-test/report.md (the Oct 19 run's report is kept in docs/FINDINGS.md)");
}

main().catch((err) => {
  if (err instanceof QlooError) console.error(`\nQloo error [${err.code}]${err.status ? ` ${err.status}` : ""}: ${err.message}`);
  else console.error("\nFailed:", err instanceof Error ? err.stack : err);
  process.exit(1);
});
