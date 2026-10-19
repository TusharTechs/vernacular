// Storyboards and video: Claude's vision reads each frame into a timestamped
// shot note that names the cultural references actually visible (brands,
// signage, posters, screens, on-screen text). The normal check then runs on
// those notes, so scoring and swaps stay grounded in Qloo exactly as for copy.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claude, FALLBACK, MODEL, RefusalError } from "./llm";

export const MAX_FRAMES = 16;
export const MAX_FRAME_BYTES = 600_000;

export interface FrameInput {
  /** data:image/jpeg;base64,... or data:image/png;base64,... */
  image: string;
  /** Seconds into the video, if the frame came from one. */
  t?: number;
}

export interface Shot {
  index: number;
  label: string;
  note: string;
}

const Reading = z.object({
  shots: z.array(
    z.object({
      index: z.number().int().describe("0-based frame index, in the order given."),
      description: z
        .string()
        .describe("One or two plain sentences: what the shot shows, naming every visible brand, title, venue, poster, product or on-screen reference exactly as written."),
      on_screen_text: z
        .string()
        .describe("A voiceover line or other legible text only if it names a cultural reference your note doesn't already mention, verbatim, at most 25 words. Usually empty."),
    }),
  ),
});

const SYSTEM = `You are reading frames from an ad storyboard or video so its cultural references can be checked for a target audience.

For each frame, write a short shot note the way a director would, e.g. "Friends pile onto a couch while the TV plays a Seinfeld marathon." Name every specific cultural reference you can actually see: brand names and logos, shop or restaurant signage, TV or film titles on screens and posters, album covers, book covers, venues, landmarks and products. Copy names exactly as written in the frame.

Storyboards often carry written captions, panel numbers and voiceover lines. Fold their meaning into the note instead of transcribing them, and skip panel numbers and frame furniture. Don't say "storyboard panel" or describe the drawing style.

Rules:
- Never identify a real person from their face or body. Mention a person by name only if their name is written in the frame (a caption, a poster, a name tag).
- Don't guess at brands you can't read or clearly recognise from a logo. Describe them generically instead ("a coffee chain cup").
- Keep it factual; no marketing commentary.`;

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function parseDataUrl(url: string) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if (!m) throw new Error("Frames must be JPEG, PNG or WebP images.");
  if (m[2].length * 0.75 > MAX_FRAME_BYTES) throw new Error("One of the frames is too large. Use images under 600 KB.");
  return { media_type: m[1] as "image/jpeg" | "image/png" | "image/webp", data: m[2] };
}

/** Turn frames (and an optional voiceover) into shot notes the check can run on. */
export async function readStoryboard(frames: FrameInput[], voiceover?: string) {
  if (!frames.length) throw new Error("Add at least one frame or image.");
  if (frames.length > MAX_FRAMES) throw new Error(`Use up to ${MAX_FRAMES} frames.`);
  const images = frames.map((f) => parseDataUrl(f.image));

  const content: ({ type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } })[] = [];
  frames.forEach((f, i) => {
    content.push({ type: "text", text: `Frame ${i}${typeof f.t === "number" ? ` at ${clock(f.t)}` : ""}:` });
    content.push({ type: "image", source: { type: "base64", ...images[i] } });
  });
  content.push({ type: "text", text: "Describe each frame as instructed, one entry per frame, in order." });

  const response = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(Reading) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new RefusalError(response.stop_details?.category);
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Could not read the frames.");

  const shots: Shot[] = parsed.shots
    .filter((s) => s.index >= 0 && s.index < frames.length)
    .sort((a, b) => a.index - b.index)
    .map((s) => {
      const t = frames[s.index].t;
      const label = typeof t === "number" ? clock(t) : `Panel ${s.index + 1}`;
      const description = s.description.trim().replace(/\s+/g, " ");
      const sentence = /[.!?]$/.test(description) ? description : `${description}.`;
      const onScreen = s.on_screen_text.trim().replace(/\s+/g, " ").replace(/[“”"]/g, "'").slice(0, 200);
      const text = onScreen ? ` On screen: “${onScreen}”.` : "";
      return { index: s.index, label, note: `[${label}] ${sentence}${text}` };
    });

  const vo = voiceover?.trim() ? `\n\nVoiceover: ${voiceover.trim()}` : "";
  return { shots, text: shots.map((s) => s.note).join("\n") + vo };
}
