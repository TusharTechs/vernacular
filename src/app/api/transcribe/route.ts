// POST /api/transcribe: multipart form with an "audio" WAV extracted in the
// browser. Returns the voiceover text with per-segment timestamps.

import { admit } from "@/lib/rate-limit";
import { MAX_AUDIO_BYTES, TranscriptionError, transcribe } from "@/lib/vernacular/transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: Request) {
  let audio: FormDataEntryValue | null = null;
  try {
    audio = (await req.formData()).get("audio");
  } catch {
    return Response.json({ error: "Send the audio as multipart form data." }, { status: 400 });
  }
  if (!(audio instanceof Blob) || audio.size === 0) return Response.json({ error: "No audio received." }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "The audio is too long to transcribe here. Use a clip under two minutes." }, { status: 413 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const admission = admit(ip, "vision");
  if (!admission.ok) return Response.json({ error: admission.message }, { status: admission.status });
  try {
    return Response.json(await transcribe(audio));
  } catch (err) {
    const message = err instanceof TranscriptionError ? err.message : "Couldn't transcribe the voiceover.";
    if (!(err instanceof TranscriptionError)) console.error("transcribe failed:", err);
    return Response.json({ error: message }, { status: 502 });
  } finally {
    admission.release();
  }
}
