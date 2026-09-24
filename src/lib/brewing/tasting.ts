import { z } from "zod";

/** Quick taste tags (§31), stored as stable keys and translated in the UI. */
export const TASTE_TAGS = [
  "SOUR",
  "BITTER",
  "SWEET",
  "BALANCED",
  "WEAK",
  "STRONG",
  "DRY",
  "ASTRINGENT",
  "HOLLOW",
  "JUICY",
  "CLEAN",
  "MUDDY",
] as const;
export type TasteTag = (typeof TASTE_TAGS)[number];

export const TASTE_ATTRIBUTES = ["acidity", "sweetness", "bitterness", "body", "clarity", "aftertaste"] as const;
export type TasteAttribute = (typeof TASTE_ATTRIBUTES)[number];

const score = z.number().int().min(1).max(5);
const optionalScore = z.preprocess((value) => (value === "" || value === undefined ? null : value), score.nullable());

export const tastingInput = z.object({
  rating: score,
  wouldBrewAgain: z.boolean().nullable().default(null),
  tags: z
    .array(z.enum(TASTE_TAGS))
    .max(TASTE_TAGS.length)
    .default([])
    .transform((tags) => [...new Set(tags)]),
  acidity: optionalScore.default(null),
  sweetness: optionalScore.default(null),
  bitterness: optionalScore.default(null),
  body: optionalScore.default(null),
  clarity: optionalScore.default(null),
  aftertaste: optionalScore.default(null),
  notes: z
    .string()
    .trim()
    .max(4000)
    .nullable()
    .default(null)
    .transform((notes) => notes || null),
});
export type TastingInput = z.infer<typeof tastingInput>;

/** "Best" is transparent (§63): the most recent brew rated 4 or better. */
export const GOOD_RATING = 4;
