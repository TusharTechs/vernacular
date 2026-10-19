// POST /api/audience: turn a plain description into an audience built from Qloo signals.

import { admit } from "@/lib/rate-limit";
import { publicMessage, readJson } from "@/lib/sse";
import { proposeAudience } from "@/lib/vernacular/audience";
import { AudienceDescriptionSchema } from "@/lib/vernacular/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = AudienceDescriptionSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Describe the audience." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const admission = admit(ip, "audience");
  if (!admission.ok) return Response.json({ error: admission.message }, { status: admission.status });
  try {
    return Response.json(await proposeAudience(parsed.data.description));
  } catch (err) {
    console.error("audience failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: publicMessage(err) }, { status: 500 });
  } finally {
    admission.release();
  }
}
