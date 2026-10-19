// Voiceover transcription with OpenAI's speech-to-text. Server-only: reads
// OPENAI_API_KEY. whisper-1 is used because it is the model that returns
// per-segment timestamps, which let each voiceover line attach to its frame.
// Docs: https://developers.openai.com/api/docs/guides/speech-to-text

export const MAX_AUDIO_BYTES = 4_400_000; // below common serverless body limits

export interface VoiceSegment {
  start: number;
  end: number;
  text: string;
}

export class TranscriptionError extends Error {}

export async function transcribe(audio: Blob): Promise<{ text: string; segments: VoiceSegment[] }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new TranscriptionError("Voiceover transcription isn't configured on this server.");
  if (audio.size > MAX_AUDIO_BYTES) throw new TranscriptionError("The audio is too long to transcribe here. Use a clip under two minutes.");

  const form = new FormData();
  form.append("file", audio, "voiceover.wav");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    console.error("transcription failed:", res.status, detail);
    if (res.status === 429) throw new TranscriptionError("The transcription service is busy. Try again in a minute.");
    throw new TranscriptionError("Couldn't transcribe the voiceover.");
  }
  const data = (await res.json()) as { text?: string; segments?: { start: number; end: number; text: string }[] };
  const segments = (data.segments ?? [])
    .map((s) => ({ start: Math.max(0, s.start), end: Math.max(0, s.end), text: s.text.trim() }))
    .filter((s) => s.text);
  return { text: (data.text ?? "").trim(), segments };
}
