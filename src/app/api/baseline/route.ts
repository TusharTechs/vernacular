// POST /api/baseline: Claude alone (no Qloo) adapts the copy; Qloo then scores its picks.

import { admit } from "@/lib/rate-limit";
import { publicMessage, readJson } from "@/lib/sse";
import { runBaseline } from "@/lib/vernacular/baseline";
import { CheckInputSchema } from "@/lib/vernacular/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: Request) {
  const parsed = CheckInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const admission = admit(ip);
  if (!admission.ok) return Response.json({ error: admission.message }, { status: admission.status });
  try {
    return Response.json(await runBaseline(parsed.data.text, parsed.data.audience));
  } catch (err) {
    console.error("baseline failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: publicMessage(err) }, { status: 500 });
  } finally {
    admission.release();
  }
}
