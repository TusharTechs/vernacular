# Findings: what we tested before and while building

Vernacular rests on one bet: that Qloo's taste data, conditioned on an audience, can tell which cultural references land with that audience and which don't. Before writing the product we tested that bet against the live hackathon API, with pass thresholds written into the scripts before each run. This is the log, failures included.

| Date | What | Script | Result |
|---|---|---|---|
| Oct 19 | Exploratory data test | [`scripts/data-test.ts`](../scripts/data-test.ts) | The pre-set test **failed**; the failure showed raw affinity can't be compared across audiences |
| Oct 19 | Confirmatory test, new references and audiences | [`scripts/confirm-test.ts`](../scripts/confirm-test.ts) | **Passed** all three pre-set thresholds; the scoring method was built on it |
| Oct 20 | Public benchmark, 8 copies × 5 audiences | [`scripts/benchmark.ts`](../scripts/benchmark.ts) | See [/benchmark](https://vernacular-lime.vercel.app/benchmark) |
| Oct 29 | Outside recognition check on the benchmark | [`scripts/benchmark-recognition.ts`](../scripts/benchmark-recognition.ts) | See [the last section](#outside-recognition-check-oct-29) |

Raw Qloo responses stay out of the repository (`.cache/` is git-ignored); this log keeps only names, derived scores and verdicts.

## Day 1 verdict (Oct 19, 2026)

**Vernacular: GO. Breakout (a second idea, built on Qloo's trending data): NO-GO, dropped.**

| Test | Result |
|---|---|
| Exploratory run, cross-audience "home" test (fixed before the run) | **FAIL**: 35% vs ≥ 60%. The test design was wrong; see below. |
| Same data, within-audience ranking (after the fact, so not counted as a pass) | 82% of pairs correct (chance 50%) |
| **Confirmatory run**, new references and audiences, thresholds fixed in advance | **PASS**: P1 88% pairwise (97/110), P2 94% of lowest-scored references are outsiders (15/16), P3 location moves brand affinity in the expected direction |
| Breakout: `/v2/trending` history | **FAIL**: only 20 weeks returned (since 2026-05-28) regardless of `filter.start_date`. Percentile is about 0.11 for every artist tested, controls included. Velocity is never positive. There is no basis for a backtest. |

## What we learned about the API (hackathon host, Oct 19)

- `affinity` lives at `entity.query.affinity`.
- **Raw affinity is not comparable across audiences.** Each signal set has its own baseline: the mean of the same references ranged from 0.67 to 0.89 by audience. Compare references *within* one audience (rank or percentile), never raw values across audiences. This is why the exploratory "home" test failed.
- Entities passed as signals are dropped from results, so a reference that is also an anchor never comes back. The product must handle "this reference is one of the audience's anchors" explicitly.
- Scoring with `filter.results.entities` is invariant to batch composition (0.8352 alone vs in a batch).
- `signal.location.query` returned no entities for a TV show. For brands it works, but with location as the only signal, affinities saturate near 0.99. Location must be combined with anchors and age to discriminate.
- `urn:demographics` returns relative age and gender skew for media entities (5/5). Some results are surprising and need a confidence note in the UI: Olive Garden skews 25–29; the 1984 *Murder, She Wrote* skews 30–34.
- `/v2/trending` requires `signal.interests.entities`; without it the API returns 400.
- Search can resolve to a near-name entity ("Air Jordan" → "Air Jordan Product Line"; "Your Name" → "Your Name."). The UI must show the resolved entity for user confirmation.
- `findEquivalents` live: explainability is returned. The relaxation path works (Frank Sinatra → Gen Z needed the genre tags dropped). Candidates are plausible for the audience but don't always match the reference's *role* (a crooner swapped for SZA). The agent must choose among candidates using the sentence's context, and the popularity floor needs tuning for recognisability.

## Product decisions from this

1. Score = the reference's **percentile within the target audience**, against an audience baseline of same-type entities, plus its age skew. Never compare raw affinity across audiences.
2. Location is a modifier for places and brands only, always combined with anchors.
3. The resolved entity is shown for confirmation before scoring.
4. Breakout is dropped. Trending may still appear as a small "rising" badge if the 20-week series shows meaningful variation later.

---

# Findings: day 1 data test

Run 2026-10-19T17:53:26.971Z against https://hackathon.api.qloo.com. Expectations were fixed in `scripts/data-test.ts` before the run.

## Vernacular: does audience-conditioned affinity separate references?

Resolved 20/20 references.

Affinity found at `query.affinity`.

| Reference | Type | Expected home | Highest-affinity audience | Spread |
|---|---|---|---|---|
| Seinfeld | tv_show | age_55_plus | age_55_plus ✓ | 0.11 |
| Euphoria | tv_show | genz_latin_pop | indie_25_29 | 0.33 |
| Yellowstone | tv_show | country_45_54 | age_55_plus | 0.15 |
| Fleabag | tv_show | indie_25_29 | indie_25_29 ✓ | 0.32 |
| Murder, She Wrote | tv_show | age_55_plus | genz_latin_pop | 0.14 |
| Top Gun | movie | country_45_54 | age_55_plus | 0.16 |
| Lady Bird | movie | indie_25_29 | genz_latin_pop | 0.36 |
| The Sound of Music | movie | age_55_plus | genz_latin_pop | 0.21 |
| Spider-Man: Across the Spider-Verse | movie | genz_latin_pop | indie_25_29 | 0.38 |
| Frank Sinatra | artist | age_55_plus | age_55_plus ✓ | 0.19 |
| Karol G | artist | genz_latin_pop | genz_latin_pop ✓ | 0.38 |
| Luke Combs | artist | country_45_54 | age_55_plus | 0.09 |
| Big Thief | artist | indie_25_29 | indie_25_29 ✓ | 0.40 |
| Peso Pluma | artist | genz_latin_pop | genz_latin_pop ✓ | 0.31 |
| Cracker Barrel | brand | country_45_54 | age_55_plus | 0.26 |
| Glossier | brand | indie_25_29 | genz_latin_pop | 0.24 |
| Buick | brand | age_55_plus | indie_25_29 | 0.17 |
| Bass Pro Shops | brand | country_45_54 | age_55_plus | 0.19 |
| Fenty Beauty | brand | genz_latin_pop | genz_latin_pop ✓ | 0.25 |
| Patagonia | brand | indie_25_29 | age_55_plus | 0.02 |

- Scored for ≥2 audiences: 20/20
- Highest affinity in the expected audience: 7/20 (35%) · pass if ≥ 60%
- Spread ≥ 0.25 between audiences: 9/20 (45%) · pass if ≥ 60%
- Batch invariance (Seinfeld): alone=0.8352 vs batch=0.8352
- signal.location.query on a TV show (Seinfeld): {}
- Age skew of Seinfeld: strongest in 55_and_older (0.279)
- Age skew of Euphoria: strongest in 24_and_younger (0.62)
- Age skew of Yellowstone: strongest in 55_and_older (0.52)
- Age skew of Fleabag: strongest in 35_to_44 (0.53)
- Age skew of Murder, She Wrote: strongest in 30_to_34 (0.4040000000000001)
- Demographics returned for 5/5 media references · pass if ≥ 4

### Equivalent candidates (for manual face-validity review)

- **Seinfeld** → Gen Z, Bad Bunny + Euphoria fans (genre tags: 2): Generation, Betty, On My Block, I May Destroy You, Heartbreak High
- **Frank Sinatra** → Gen Z, Bad Bunny + Euphoria fans (genre tags: 3): none returned
- **Top Gun** → 25–29, Phoebe Bridgers + A24 fans (genre tags: 3): Dune: Part Two, Saltburn, Doctor Strange in the Multiverse of Madness, Spider-Man: Across the Spider-Verse, Turning Red
- **Cracker Barrel** → 25–29, Phoebe Bridgers + A24 fans (genre tags: 1): Starbucks, Planet Hollywood, Taco Bell, Peet's Coffee & Tea, McDonald's
- **Euphoria** → 55 and older, no taste anchors (genre tags: 3): Game of Thrones, Breaking Bad, Stranger Things, The Walking Dead, Sherlock

## Breakout: does weekly trending history flag breakouts before they peak?

- Chappell Roan: 20 weeks (2026-05-28 → 2026-10-08); data peak 2026-05-28 at p0.11252062062269458; public peak ~2024-08; first positive velocity none
- Sabrina Carpenter: 20 weeks (2026-05-28 → 2026-10-08); data peak 2026-05-28 at p0.11274624184909383; public peak ~2024-08; first positive velocity none
- Benson Boone: 20 weeks (2026-05-28 → 2026-10-08); data peak 2026-05-28 at p0.110141166871831; public peak ~2024-06; first positive velocity none
- Doechii: 20 weeks (2026-05-28 → 2026-10-08); data peak 2026-05-28 at p0.11132314203634945; public peak ~2025-02; first positive velocity none
- Taylor Swift: 20 weeks (2026-05-28 → 2026-10-08); data peak 2026-05-28 at p0.11307538592446476 (control)
- Coldplay: 20 weeks (2026-05-28 → 2026-10-08); data peak 2026-05-28 at p0.1129581457621718 (control)
- Trending without an entity: {"error":"Qloo returned 400. {\"errors\":[{\"message\":\"signal.interests.entities is required\",\"path\":\"signal.interests.entities.ids\"}]}"}

Total Qloo calls: 66. Raw responses: `.cache/data-test/` (git-ignored).

---

# Confirmatory test

Run 2026-10-19T17:55:55.738Z. Expectations and thresholds fixed in `scripts/confirm-test.ts` before the run; new references and audiences, none reused from the exploratory run.

- 24 and younger · NewJeans + Jujutsu Kaisen → anchors resolved as NewJeans, Jujutsu Kaisen
- 30–34 · Kendrick Lamar + Atlanta (FX) → anchors resolved as Kendrick Lamar, Atlanta
- 55 and older · Eagles + M*A*S*H → anchors resolved as Eagles, M*A*S*H
- 35–44 · The Bear + Le Creuset → anchors resolved as The Bear, Le Creuset
- references resolved: 24/24 (Stray Kids→STRAY KIDS; Your Name→Your Name.; Air Jordan→Air Jordan Product Line)

- **24 and younger · NewJeans + Jujutsu Kaisen**: artist: top BLACKPINK, bottom Bruce Springsteen · tv_show: top Demon Slayer: Kimetsu no Yaiba, bottom Cheers · movie: top Your Name, bottom The Godfather · brand: top Air Jordan, bottom Williams-Sonoma
- **30–34 · Kendrick Lamar + Atlanta (FX)**: artist: top J. Cole, bottom Bruce Springsteen · tv_show: top Insecure, bottom Chef's Table · movie: top Your Name, bottom Black Panther · brand: top Air Jordan, bottom Williams-Sonoma
- **55 and older · Eagles + M*A*S*H**: artist: top Bruce Springsteen, bottom J. Cole · tv_show: top Cheers, bottom Chef's Table · movie: top Your Name, bottom Black Panther · brand: top Harley-Davidson, bottom Trader Joe's
- **35–44 · The Bear + Le Creuset**: artist: top Vampire Weekend, bottom Stray Kids · tv_show: top Demon Slayer: Kimetsu no Yaiba, bottom The Golden Girls · movie: top The Menu, bottom Black Panther · brand: top Williams-Sonoma, bottom Harley-Davidson

- P1 within-audience pairwise accuracy: 97/110 = 88% · PASS (≥ 75%)
- P2 lowest-scored reference is an outsider: 15/16 cells = 94% · PASS (≥ 75%)
- P3 brand location: {"Atlanta":{"Whole Foods Market":0.999,"Waffle House":0.999,"Trader Joe's":0.998,"Popeyes":0.989},"Seattle":{"Trader Joe's":1,"Whole Foods Market":0.999,"Waffle House":0.923}} · PASS

---

# Outside recognition check (Oct 29)

**Why.** In the benchmark, Qloo is both Vernacular's source and the grader, and a percentile can't tell a household name from a title an audience over-indexes on but mostly hasn't heard of. We wanted a check that Qloo doesn't control.

**How.** [`scripts/benchmark-recognition.ts`](../scripts/benchmark-recognition.ts) sends every reference from every version of every benchmark pair to a model from a different family (`gpt-5.5-2026-04-23`; Claude also wrote the Claude-alone versions, so a Claude judge would be marking its own picks). Per audience, the names are de-duplicated and shuffled, with no sign of which version used them, and rated 1–5: would a typical member of this audience recognise it and feel good about it in an ad aimed at them? Ratings are stored per reference in [`results.json`](../src/lib/vernacular/benchmark/results.json); [`summarize.ts`](../src/lib/vernacular/benchmark/summarize.ts) computes the comparisons.

**What it found on the Oct 20 run.** Vernacular's swaps were less recognisable than Claude alone's: 3.56 against 3.82 with the brief's own examples left out (−0.20 per pair, 95% interval −0.42 to +0.01; 10 wins, 13 ties, 17 losses). The lowest-rated swaps were real Qloo picks the audience over-indexes on but few would know: *The I-Land* and *The Knick* for 45–54 country fans, *Southpaw* and *Moonrise Kingdom* for 55+ classic-rock fans. Candidates had a popularity floor of 0.6, well below the 0.85 floor of the well-known peers they're ranked against.

**What we changed.** One rule, chosen on principle rather than tuned to the judge: a swap must be at least as well-known as the panel it's ranked against (`SWAP_POPULARITY_FLOOR = 0.85` in [`tools.ts`](../src/lib/qloo/tools.ts)). When nothing at that floor fits, the search lowers it to 0.6 while keeping the original's genre tags, before it gives up on the genre. The agent can still lower the floor itself, and is told to only when nothing at the default fits the role.

**After re-running the benchmark on the current code** (same corpus and audiences; Oct 20 ratings redone in the same way, which reproduced them to within 0.01):

| | Oct 20 agent | Current agent |
|---|---|---|
| Mean percentile (Qloo) | p88 | p85 |
| References that miss (Qloo) | 4% | 8% |
| Recognition, all references (outside judge, /5) | 3.56 | 3.69 |
| Recognition vs Claude alone, brief examples left out | −0.20 (10 W / 13 T / 17 L) | +0.03 (17 W / 9 T / 13 L) |

So the swaps are now about as recognisable as Claude's own picks (the difference is within noise), while still scoring well above them on Qloo (p85 against p73; +27 points per pair with the brief's examples left out). The price was three percentile points and a few more references left as misses where nothing well-known fits.

**Limits.** The judge is a model, not a human panel, and models may share a bias toward the famous names a model picks, which would favour Claude alone's versions. Counting the 36 times Claude alone repeated the brief's own examples (Bad Bunny for Bad Bunny fans), which the judge rightly rates highly, Claude alone still leads on recognition (4.13 against 3.69). Those echoes also score p100 on Qloo by definition, which is why both views are reported.
