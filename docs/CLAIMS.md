# Claims map

Every factual claim in the README, the Devpost description and the site, with the code, data or saved output that backs it. Line numbers are for the commit this file was last updated in; numbers on the site are computed from the data files at render time.

## Scoring

| Claim | Where it's true |
|---|---|
| Each reference is ranked against ~40 well-known peers of the same type, scored for the same audience in the same request | [`tools.ts:297`](../src/lib/qloo/tools.ts#L297) (panel: `take=40`, `filter.popularity.min=0.85`), `scoreAgainst` and `scoreWithPanel` below it |
| Score = share of the panel at or below the reference's affinity | [`tools.ts:146`](../src/lib/qloo/tools.ts#L146) `percentileOf` |
| Lands is p65 or above, misses below p35 | [`score.ts:15`](../src/lib/vernacular/score.ts#L15) |
| A verdict drops a step when Qloo's demographics show the audience under-indexes (−0.2 or lower) | [`score.ts:72`](../src/lib/vernacular/score.ts#L72) |
| Raw affinity isn't comparable across audiences | [FINDINGS.md](FINDINGS.md), day 1 data test (fixed thresholds, failed) |
| Within-audience ranking passed a confirmatory test (88% pairwise) | [FINDINGS.md](FINDINGS.md#confirmatory-test), [`scripts/confirm-test.ts`](../scripts/confirm-test.ts) |
| A made-up name never borrows a real entity's score | [`names.ts:69`](../src/lib/qloo/names.ts#L69) `plausibleMatch`; edge case `fictional` in [evidence](evidence/edge-cases.txt) |

## Qloo usage

| Claim | Where it's true |
|---|---|
| Parameters are whitelisted (Qloo ignores unknown ones) | [`params.ts:51`](../src/lib/qloo/params.ts#L51); tests in [`params.test.ts`](../src/lib/qloo/__tests__/params.test.ts) |
| `signal.demographics.gender` is sent when an audience has a gender skew | [`tools.ts`](../src/lib/qloo/tools.ts) `audienceSignals`; set in the UI at [`audience-builder.tsx:251`](../src/components/audience-builder.tsx#L251), by plain-language audiences in [`audience.ts`](../src/lib/vernacular/audience.ts), and by MCP clients |
| `signal.location.query` applies to places, brands and destinations | [`tools.ts:93`](../src/lib/qloo/tools.ts#L93) |
| `urn:demographics` for age skew | [`tools.ts:160`](../src/lib/qloo/tools.ts#L160) |
| `feature.explainability`, genre tags, exclusions and a popularity floor for candidates | [`tools.ts:233`](../src/lib/qloo/tools.ts#L233) `findEquivalents` |
| `urn:heatmap` with `output.heatmap.boundary=urn:entity:locality` | [`tools.ts:399`](../src/lib/qloo/tools.ts#L399) |
| `/v2/tags` and `/v2/audiences` turn a plain-language audience into Qloo signals | [`tools.ts:366`](../src/lib/qloo/tools.ts#L366), [`audience.ts:39`](../src/lib/vernacular/audience.ts#L39) |
| Client: 1-hour cache, at most 3 requests in flight spaced 220 ms, retries honour `Retry-After` | [`client.ts:64`](../src/lib/qloo/client.ts#L64), [`:65`](../src/lib/qloo/client.ts#L65), [`:153`](../src/lib/qloo/client.ts#L153), [`:215`](../src/lib/qloo/client.ts#L215) |
| The landing sample's trace (27 Qloo calls, 7 Claude calls, 43 s) | `sample.result.stats` and the call list in [`snapshots/data.json`](../src/lib/vernacular/snapshots/data.json) |

## The swap agent

| Claim | Where it's true |
|---|---|
| A swap must come from Qloo in this run | [`agent.ts:172`](../src/lib/vernacular/agent.ts#L172) |
| It must land, or be mixed and at least 15 points above the original | [`agent.ts:220`](../src/lib/vernacular/agent.ts#L220) |
| It must be at least as well-known as the panel (popularity 0.85) unless nothing fits | [`tools.ts:219`](../src/lib/qloo/tools.ts#L219) `SWAP_POPULARITY_FLOOR`, used by `findEquivalents`; the agent's `popularity_floor` option |
| The rewrite must name it, drop the original and leave no stray article | [`agent.ts:226`](../src/lib/vernacular/agent.ts#L226), [`agent.ts:62`](../src/lib/vernacular/agent.ts#L62) `articleClash` |
| Each run is capped at 16 model turns and 40 Qloo calls | [`agent.ts:25`](../src/lib/vernacular/agent.ts#L25) |
| Factual references (credits, venues) are kept | The agent's instructions in [`agent.ts:45`](../src/lib/vernacular/agent.ts#L45); edge case `factual` in [evidence](evidence/edge-cases.txt) |
| A like-for-like swap shows the Qloo tags it shares with the original; a cross-type swap is labelled as one | [`tools.ts:192`](../src/lib/qloo/tools.ts#L192) `sharedTags`; rendered in [`reference-card.tsx`](../src/components/reference-card.tsx) |
| The extension's suggestions must share Qloo tags with the original | [`lint.ts:41`](../src/lib/vernacular/lint.ts#L41); tests in [`role.test.ts`](../src/lib/qloo/__tests__/role.test.ts) |
| One agent per sentence, in parallel | [`run.ts`](../src/lib/vernacular/run.ts) (`groups.map(runSwapAgent)`) |
| An abandoned check stops spending | [`sse.ts:36`](../src/lib/sse.ts#L36), [`agent.ts:310`](../src/lib/vernacular/agent.ts#L310) |

## Product

| Claim | Where it's true |
|---|---|
| Twelve real-world scenarios, saved so they open instantly | [`scenarios.ts:24`](../src/lib/vernacular/scenarios.ts#L24); saved runs in [`snapshots/data.json`](../src/lib/vernacular/snapshots/data.json), served by [`api/scenario/[id]/route.ts`](../src/app/api/scenario/[id]/route.ts) |
| Campaign check: up to 5 variants × 5 audiences | [`campaign.ts:12`](../src/lib/vernacular/campaign.ts#L12), [`schema.ts`](../src/lib/vernacular/schema.ts) `CampaignInputSchema` |
| Six MCP tools | [`mcp/route.ts`](../src/app/api/mcp/route.ts): `check_copy` (line 72), `build_audience`, `compare_audiences`, `check_campaign` (line 143), `where_it_lands`, `translate_reference` |
| Models: `claude-opus-5-5`, `gpt-4o-mini-tts`, `whisper-1`; `gpt-5.5` for the recognition judge | [`llm.ts:5`](../src/lib/vernacular/llm.ts#L5), [`voice.ts:11`](../src/lib/vernacular/voice.ts#L11), [`voice.ts:58`](../src/lib/vernacular/voice.ts#L58), [`recognition.ts:9`](../src/lib/vernacular/benchmark/recognition.ts#L9) |
| Twelve full checks per IP per ten minutes, queued up to 20 s when busy | [`rate-limit.ts:4`](../src/lib/rate-limit.ts#L4), [`:45`](../src/lib/rate-limit.ts#L45) |
| Map example: Kali Uchis reaches 8 of Gen Z Latin-pop fans' 10 strongest Chicago neighbourhoods, Seinfeld none; Olive Garden 9 of 10 in Los Angeles | Live Qloo heatmaps through `buildCityMap` ([`map.ts`](../src/lib/vernacular/map.ts)); visible in [`docs/screenshots/map.png`](screenshots/map.png); re-run on the map panel |
| Wrigley Field lands at p100 and Soldier Field misses at p0 for 30–34 hip-hop fans in Chicago | The saved `billboard` scenario in [`snapshots/data.json`](../src/lib/vernacular/snapshots/data.json) |

## Evidence

| Claim | Where it's true |
|---|---|
| Benchmark: p51 / p73 / p85, misses 49% / 25% / 8%, 24 of 40 wins, +11.9 (5.6 to 17.9), +27.0 without echoes | [`results.json`](../src/lib/vernacular/benchmark/results.json), computed by [`summarize.ts`](../src/lib/vernacular/benchmark/summarize.ts) (the page renders the same function) |
| Outside recognition check: 3.11 / 4.13 / 3.69; level with echoes left out (+0.03, −0.19 to +0.26) | `recognition` per reference in [`results.json`](../src/lib/vernacular/benchmark/results.json); method in [`recognition.ts`](../src/lib/vernacular/benchmark/recognition.ts) |
| The Oct 20 agent scored p88 and 3.56 recognition | [FINDINGS.md](FINDINGS.md#outside-recognition-check-oct-29); the Oct 20 results are in git history (`git show dff9ea8:src/lib/vernacular/benchmark/results.json > old.json`) and re-rate with `npm run benchmark:recognition -- old.json` |
| 16 adversarial edge cases pass | [`scripts/edge-cases.ts`](../scripts/edge-cases.ts); output in [`evidence/edge-cases.txt`](evidence/edge-cases.txt) |
| 75 unit tests in 13 files | `npm test`; CI in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| No axe-core violations on the seven main pages, light and dark; each fits 375 px | [`scripts/a11y.ts`](../scripts/a11y.ts); output in [`evidence/a11y.txt`](evidence/a11y.txt); runs in CI |
| Five simultaneous fresh checks complete: first scores 8–10 s, all within 36 s | [`scripts/load-test.ts`](../scripts/load-test.ts); output in [`evidence/load-test.txt`](evidence/load-test.txt) |
