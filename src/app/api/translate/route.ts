// POST /api/translate (SSE): one reference, translated for each audience preset.

import { readJson, streamEvents } from "@/lib/sse";
import { AUDIENCE_PRESETS } from "@/lib/vernacular/presets";
import { TranslateInputSchema } from "@/lib/vernacular/schema";
import { translate, type TranslateEvent } from "@/lib/vernacular/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: Request) {
  const parsed = TranslateInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Type a reference." }, { status: 400 });
  return streamEvents<TranslateEvent>(req, (send) => translate(parsed.data.query, AUDIENCE_PRESETS.map((p) => p.spec), send));
}
