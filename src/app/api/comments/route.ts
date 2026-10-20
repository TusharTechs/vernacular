// POST /api/comments: a simulated comment section for the post, before and after swaps.

import { admit } from "@/lib/rate-limit";
import { publicMessage, readJson } from "@/lib/sse";
import { predictComments } from "@/lib/vernacular/comments";
import { CommentInputSchema } from "@/lib/vernacular/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: Request) {
  const parsed = CommentInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const admission = admit(ip, "audience");
  if (!admission.ok) return Response.json({ error: admission.message }, { status: admission.status });
  try {
    return Response.json(await predictComments(parsed.data));
  } catch (err) {
    console.error("comments failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: publicMessage(err) }, { status: 500 });
  } finally {
    admission.release();
  }
}
