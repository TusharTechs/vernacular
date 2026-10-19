// GET /api/sample: a real check of the landing-page sample, cached server-side
// for a day so first-time visitors see results instantly. Qloo allows private
// server-side caching; nothing here is written to the repository.

import { unstable_cache } from "next/cache";
import { AUDIENCE_PRESETS, SAMPLE_COPY } from "@/lib/vernacular/presets";
import { runCheck } from "@/lib/vernacular/run";

export const runtime = "nodejs";
export const maxDuration = 120;

const cachedSample = unstable_cache(
  async () => ({ checkedAt: new Date().toISOString(), result: await runCheck({ text: SAMPLE_COPY[0].text, audience: AUDIENCE_PRESETS[0].spec }) }),
  ["landing-sample-v1"],
  { revalidate: 60 * 60 * 24 },
);

export async function GET() {
  try {
    return Response.json(await cachedSample());
  } catch (err) {
    console.error("sample failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "The sample isn't available right now." }, { status: 503 });
  }
}
