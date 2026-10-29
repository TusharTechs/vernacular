// POST /api/campaign: scores up to 5 ad variants for up to 5 audiences and streams
// the grid one audience column at a time.

import { readJson, streamEvents } from "@/lib/sse";
import { runCampaign, type CampaignEvent } from "@/lib/vernacular/campaign";
import { CampaignInputSchema } from "@/lib/vernacular/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const parsed = CampaignInputSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Send the variants and audiences as JSON." }, { status: 400 });
  }
  return streamEvents<CampaignEvent>(req, (send, signal) => runCampaign(parsed.data, send, signal));
}
