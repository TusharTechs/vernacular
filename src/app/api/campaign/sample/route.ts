// GET /api/campaign/sample: the example campaign the /campaign page opens on.
// Served from the saved snapshot (npm run snapshot); if the example has changed
// since, a live run cached server-side for a day.

import { unstable_cache } from "next/cache";
import { collectCampaign, SAMPLE_CAMPAIGN } from "@/lib/vernacular/campaign";
import { campaignSnapshot } from "@/lib/vernacular/snapshots";

export const runtime = "nodejs";
export const maxDuration = 300;

const cached = unstable_cache(() => collectCampaign(SAMPLE_CAMPAIGN), ["campaign-sample-v1"], { revalidate: 60 * 60 * 24 });

export async function GET() {
  const saved = campaignSnapshot();
  if (saved) return Response.json(saved);
  try {
    return Response.json(await cached());
  } catch (err) {
    console.error("campaign sample failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "The example campaign isn't available right now." }, { status: 503 });
  }
}
