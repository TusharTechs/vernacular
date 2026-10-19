import { z } from "zod";
import { AGE_BANDS, ENTITY_TYPES } from "../qloo/params";
import { MAX_TEXT_CHARS } from "./limits";

export const CheckInputSchema = z.object({
  text: z.string().trim().min(1, "Paste some copy to check.").max(MAX_TEXT_CHARS, `Copy is limited to ${MAX_TEXT_CHARS.toLocaleString()} characters.`),
  audience: z
    .object({
      label: z.string().trim().min(1).max(80),
      anchors: z
        .array(z.object({ query: z.string().trim().min(1).max(80), type: z.enum(ENTITY_TYPES) }))
        .max(5),
      age: z.enum(AGE_BANDS).optional(),
      gender: z.enum(["male", "female"]).optional(),
      location: z.string().trim().max(80).optional(),
    })
    .refine((a) => a.anchors.length > 0 || a.age, "Describe the audience with at least one thing they love or an age band."),
});
