// POST /api/voice: read copy aloud (AI voice) and return per-word timings for the Dial Test.

import { admit } from "@/lib/rate-limit";
import { readJson } from "@/lib/sse";
import { TranscriptionError } from "@/lib/vernacular/transcribe";
import { VoiceInputSchema } from "@/lib/vernacular/schema";
import { voice, VOICE } from "@/lib/vernacular/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: Request) {
  const parsed = VoiceInputSchema.safeParse(await readJson(req));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Nothing to read." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const admission = admit(ip, "vision");
  if (!admission.ok) return Response.json({ error: admission.message }, { status: admission.status });
  try {
    const v = await voice(parsed.data.text);
    return Response.json({ ...v, model: VOICE.model, voice: VOICE.voice });
  } catch (err) {
    console.error("voice failed:", err instanceof Error ? err.message : err);
    const message = err instanceof TranscriptionError ? err.message : "Couldn't generate the voice.";
    return Response.json({ error: message }, { status: 500 });
  } finally {
    admission.release();
  }
}
