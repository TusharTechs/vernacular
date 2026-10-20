// POST /api/lint: fast culture lint for the browser extension and the /anywhere demo.
// CORS is open so the extension's content script can call it from any page; it
// takes only the text and an audience, and returns names and scores.

import { admit } from "@/lib/rate-limit";
import { publicMessage, readJson } from "@/lib/sse";
import { lint } from "@/lib/vernacular/lint";
import { AUDIENCE_PRESETS } from "@/lib/vernacular/presets";
import { LintInputSchema } from "@/lib/vernacular/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const parsed = LintInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400, headers: CORS });
  const spec = typeof parsed.data.audience === "string" ? AUDIENCE_PRESETS.find((p) => p.id === parsed.data.audience)?.spec : parsed.data.audience;
  if (!spec) return Response.json({ error: "Unknown audience preset." }, { status: 400, headers: CORS });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const admission = admit(ip, "audience");
  if (!admission.ok) return Response.json({ error: admission.message }, { status: admission.status, headers: CORS });
  try {
    const items = await lint(parsed.data.text, spec);
    return Response.json({ audience: spec.label, items }, { headers: CORS });
  } catch (err) {
    console.error("lint failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: publicMessage(err) }, { status: 500, headers: CORS });
  } finally {
    admission.release();
  }
}
