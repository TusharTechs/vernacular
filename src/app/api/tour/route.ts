// POST /api/tour: scores one piece of copy for 2–5 audiences and streams each
// audience's column as it finishes.

import { readJson, streamEvents } from "@/lib/sse";
import { TourInputSchema } from "@/lib/vernacular/schema";
import { runTour, type TourEvent } from "@/lib/vernacular/tour";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const parsed = TourInputSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Send the copy and audiences as JSON." }, { status: 400 });
  }
  return streamEvents<TourEvent>(req, (send) => runTour(parsed.data, send));
}
