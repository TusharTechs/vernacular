// Saved checks for the landing sample and every gallery scenario, written by
// `npm run snapshot`. Serving these makes the gallery open instantly and keeps
// what a visitor sees identical to the README and screenshots. Each one is a
// real run (slimmed: names, scores, verdicts, swaps and the Qloo call log);
// "Re-run live" on the page runs the same copy fresh.

import { SAMPLE_COPY, AUDIENCE_PRESETS } from "../presets";
import { SCENARIOS } from "../scenarios";
import { SAMPLE_CAMPAIGN, type CampaignResult } from "../campaign";
import type { TranslateEvent } from "../translate";
import type { CheckResult } from "../types";
import data from "./data.json";

export interface Snapshot {
  checkedAt: string;
  result: CheckResult;
}

export interface TranslateSnapshot {
  checkedAt: string;
  query: string;
  events: TranslateEvent[];
}

export const SAMPLE_TRANSLATION = "Seinfeld";

const saved = data as unknown as { sample?: Snapshot; scenarios?: Record<string, Snapshot>; campaign?: CampaignResult; translate?: TranslateSnapshot };

/** A snapshot only counts if it was made from the copy and audience the site shows today. */
function current(snap: Snapshot | undefined, text: string, audienceLabel: string): Snapshot | null {
  if (!snap) return null;
  const input = snap.result.input;
  return input.text === text && input.audience.label === audienceLabel ? snap : null;
}

export function sampleSnapshot(): Snapshot | null {
  return current(saved.sample, SAMPLE_COPY[0].text, AUDIENCE_PRESETS[0].spec.label);
}

export function scenarioSnapshot(id: string): Snapshot | null {
  const s = SCENARIOS.find((x) => x.id === id);
  return s ? current(saved.scenarios?.[id], s.text, s.audience.label) : null;
}

export function campaignSnapshot(): CampaignResult | null {
  const c = saved.campaign;
  return c && JSON.stringify(c.input.variants) === JSON.stringify(SAMPLE_CAMPAIGN.variants) ? c : null;
}

export function translateSnapshot(): TranslateSnapshot | null {
  return saved.translate?.query === SAMPLE_TRANSLATION ? saved.translate : null;
}
