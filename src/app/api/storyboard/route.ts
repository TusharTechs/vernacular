// POST /api/storyboard: read storyboard panels or sampled video frames into
// timestamped shot notes. The client then runs the normal check on them.

import { admit } from "@/lib/rate-limit";
import { publicMessage, readJson } from "@/lib/sse";
import { StoryboardInputSchema } from "@/lib/vernacular/schema";
import { readStoryboard } from "@/lib/vernacular/storyboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: Request) {
  const parsed = StoryboardInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Send the frames as JSON." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const admission = admit(ip, "vision");
  if (!admission.ok) return Response.json({ error: admission.message }, { status: admission.status });
  try {
    return Response.json(await readStoryboard(parsed.data.frames, parsed.data.voiceover, parsed.data.voiceSegments));
  } catch (err) {
    console.error("storyboard failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: publicMessage(err) }, { status: 500 });
  } finally {
    admission.release();
  }
}
