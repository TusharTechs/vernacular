// POST /api/map: where in a city the audience lives, and where each reference's fans live.

import { admit } from "@/lib/rate-limit";
import { publicMessage, readJson } from "@/lib/sse";
import { buildCityMap } from "@/lib/vernacular/map";
import { MapInputSchema } from "@/lib/vernacular/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const parsed = MapInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid map request." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const admission = admit(ip, "audience");
  if (!admission.ok) return Response.json({ error: admission.message }, { status: admission.status });
  try {
    const { city, audience, references } = parsed.data;
    const map = await buildCityMap(city, audience, references);
    // Evidence ids are server-side detail; the client only needs the request count.
    const { evidence, ...rest } = map;
    return Response.json({ ...rest, qlooCalls: evidence.length });
  } catch (err) {
    console.error("map failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: publicMessage(err) }, { status: 500 });
  } finally {
    admission.release();
  }
}
