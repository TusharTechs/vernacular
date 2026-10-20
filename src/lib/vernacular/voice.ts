// Dial Test audio: read copy aloud with OpenAI text-to-speech, then time every
// word by transcribing that audio with word timestamps, so references can be
// placed on the timeline exactly where they are spoken. Server-only.
// Docs: https://developers.openai.com/api/docs/guides/text-to-speech
//       https://developers.openai.com/api/docs/guides/speech-to-text

import { createHash } from "node:crypto";
import { TranscriptionError } from "./transcribe";

export const MAX_VOICE_CHARS = 1200;
export const VOICE = { model: "gpt-4o-mini-tts", voice: "marin" } as const;

export interface SpokenWord {
  word: string;
  start: number;
  end: number;
}

export interface Voiced {
  /** base64 MP3 */
  audio: string;
  words: SpokenWord[];
  duration: number;
}

const cache = new Map<string, Voiced>();
const CACHE_MAX = 60;

function key() {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new TranscriptionError("The voice isn't configured on this server.");
  return k;
}

async function speak(text: string): Promise<ArrayBuffer> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: VOICE.model,
      voice: VOICE.voice,
      input: text,
      instructions: "Read this like a confident, warm radio ad. Natural pace, clear names, no exaggeration.",
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    console.error("speech failed:", res.status, (await res.text()).slice(0, 200));
    throw new TranscriptionError(res.status === 429 ? "The voice service is busy. Try again in a minute." : "Couldn't generate the voice.");
  }
  return res.arrayBuffer();
}

async function timeWords(audio: ArrayBuffer): Promise<{ words: SpokenWord[]; duration: number }> {
  const form = new FormData();
  form.append("file", new Blob([audio], { type: "audio/mpeg" }), "read.mp3");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    console.error("word timing failed:", res.status, (await res.text()).slice(0, 200));
    throw new TranscriptionError("Couldn't time the voice.");
  }
  const data = (await res.json()) as { duration?: number; words?: SpokenWord[] };
  const words = (data.words ?? []).filter((w) => w.word?.trim()).map((w) => ({ word: w.word.trim(), start: w.start, end: w.end }));
  return { words, duration: data.duration ?? words.at(-1)?.end ?? 0 };
}

export async function voice(text: string): Promise<Voiced> {
  const id = createHash("sha1").update(text).digest("hex");
  const hit = cache.get(id);
  if (hit) return hit;
  const audio = await speak(text);
  const { words, duration } = await timeWords(audio);
  const out: Voiced = { audio: Buffer.from(audio).toString("base64"), words, duration };
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(id, out);
  return out;
}
