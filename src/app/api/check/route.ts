// POST /api/check: runs one Vernacular check and streams progress as
// server-sent events (one JSON CheckEvent per `data:` line).

import { readJson, streamEvents } from "@/lib/sse";
import { slimEvent } from "@/lib/vernacular/slim";
import { runCheck } from "@/lib/vernacular/run";
import { CheckInputSchema } from "@/lib/vernacular/schema";
import type { CheckEvent } from "@/lib/vernacular/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const parsed = CheckInputSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Send the copy and audience as JSON." }, { status: 400 });
  }
  return streamEvents<CheckEvent>(req, (send, signal) => runCheck(parsed.data, (e) => send(slimEvent(e)), signal));
}
