// GET /api/sample: a real check of the landing-page sample. Served from the saved
// snapshot (npm run snapshot) so first-time visitors see results instantly; if the
// sample copy has changed since, a live check cached server-side for a day.

import { unstable_cache } from "next/cache";
import { AUDIENCE_PRESETS, SAMPLE_COPY } from "@/lib/vernacular/presets";
import { runCheck } from "@/lib/vernacular/run";
import { slimResult } from "@/lib/vernacular/slim";
import { sampleSnapshot } from "@/lib/vernacular/snapshots";

export const runtime = "nodejs";
export const maxDuration = 120;

const cachedSample = unstable_cache(
  async () => ({ checkedAt: new Date().toISOString(), result: await runCheck({ text: SAMPLE_COPY[0].text, audience: AUDIENCE_PRESETS[0].spec }) }),
  ["landing-sample-v1"],
  { revalidate: 60 * 60 * 24 },
);

export async function GET() {
  const saved = sampleSnapshot();
  if (saved) return Response.json(saved);
  try {
    const d = await cachedSample();
    return Response.json({ ...d, result: slimResult(d.result) });
  } catch (err) {
    console.error("sample failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "The sample isn't available right now." }, { status: 503 });
  }
}
