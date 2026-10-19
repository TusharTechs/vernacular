import { z } from "zod";
import { AGE_BANDS, ENTITY_TYPES } from "../qloo/params";
import { MAX_TEXT_CHARS } from "./limits";

const Text = z
  .string()
  .trim()
  .min(1, "Paste some copy to check.")
  .max(MAX_TEXT_CHARS, `Copy is limited to ${MAX_TEXT_CHARS.toLocaleString()} characters.`);

export const AudienceSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    anchors: z.array(z.object({ query: z.string().trim().min(1).max(80), type: z.enum(ENTITY_TYPES) })).max(5),
    age: z.enum(AGE_BANDS).optional(),
    gender: z.enum(["male", "female"]).optional(),
    location: z.string().trim().max(80).optional(),
    segments: z
      .array(z.object({ id: z.string().regex(/^urn:audience:[a-z_]+:[a-z0-9_]+$/), name: z.string().max(80) }))
      .max(3)
      .optional(),
    tags: z
      .array(z.object({ id: z.string().regex(/^urn:tag:[a-z0-9_:]+$/), name: z.string().max(80) }))
      .max(3)
      .optional(),
  })
  .refine(
    (a) => a.anchors.length > 0 || a.age || a.segments?.length || a.tags?.length,
    "Describe the audience with at least one thing they love, a segment or an age band.",
  );

export const AudienceDescriptionSchema = z.object({
  description: z.string().trim().min(3, "Describe the audience in a few words.").max(300, "Keep the description under 300 characters."),
});

export const StoryboardInputSchema = z.object({
  frames: z
    .array(z.object({ image: z.string().startsWith("data:image/").max(900_000), t: z.number().min(0).max(600).optional() }))
    .min(1, "Add at least one frame or image.")
    .max(16, "Use up to 16 frames."),
  voiceover: z.string().max(1500, "Keep the voiceover under 1,500 characters.").optional(),
  voiceSegments: z
    .array(z.object({ start: z.number().min(0).max(600), end: z.number().min(0).max(600), text: z.string().max(300) }))
    .max(80)
    .optional(),
});

export const CheckInputSchema = z.object({ text: Text, audience: AudienceSchema });

export const TourInputSchema = z.object({
  text: Text,
  audiences: z.array(AudienceSchema).min(2, "Pick at least 2 audiences to compare.").max(5, "Tour Mode compares up to 5 audiences."),
});
