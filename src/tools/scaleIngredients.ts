/**
 * scale_ingredients: rescale an arbitrary ingredient list, offline.
 *
 * This tool makes no network request. It exposes the quantity parser on its
 * own, so a list a caller already holds can be rescaled with the same care
 * about what is and is not safe to multiply.
 */

import { z } from "zod";
import { invalidInput } from "../errors.js";
import { scaleIngredients } from "../recipe/scale.js";
import {
  SCALING_CAVEAT,
  ok,
  scaledIngredientSchema,
  toScaledIngredientOut,
  toToolError,
} from "./shared.js";
import { strictInput } from "./arguments.js";
import type { ToolResult } from "./shared.js";

const CLAMPED_UP = /clamped up/i;

export const scaleIngredientsDescription = [
  "Rescale a list of English ingredient lines. This contacts no website and works on a list from anywhere, including one the user pasted in.",
  "Give either 'factor' directly, or 'from_servings' and 'to_servings' and the factor is computed.",
  "Grams, millilitres, ounces and pounds are multiplied and rounded to what a scale can show; a quantity that would fall below one is moved to a smaller unit first, so it never rounds away to nothing.",
  "Countable things land where a kitchen can follow, and what decides is the content rather than the container: a can, a packet, a sheet of gelatine or a spoon lands on a half, because half of one pours, weighs or cuts. An egg, a yolk, a white, a zest or a whole clove lands on a whole one, since there is no half of it to measure out, which is what stops an answer like '2.4 eggs'. A bottle, a jar, a block and a slice go one step further, to the quarter, as a whole food a knife shares out does.",
  "An approximate measure is scaled as a count, so a pinch taken from 6 servings to 25 is 4 pinches; the note gives the everyday equivalence, and the quantity stays in the unit the line used. That covers the gestures, such as a pinch, a dash, a glug or a handful, and anything named after what holds it, such as a capful or a spoonful.",
  "A line with no quantity at all comes back untouched and flagged.",
  "A bracketed equivalent, as in '450 g (1 pound)', is scaled with the amount it restates rather than left to contradict it, and so is one written after a slash, as in '500 g / 1.1 lb'.",
  "A line offering a choice, as in '2 tablespoons butter OR 30 g margarine', has both branches scaled, so whichever one the cook takes carries the same share.",
  "Prefer this over doing the arithmetic yourself.",
].join(" ");

export const scaleIngredientsInput = strictInput({
  ingredients: z
    .array(z.string().max(300))
    .min(1)
    .max(100)
    .describe(
      "Ingredient lines, for example ['450 g (1 pound) spaghetti', '5 egg yolks', 'Salt'].",
    ),
  factor: z
    .number()
    .positive()
    .max(100)
    .optional()
    .describe("Multiplier to apply. Use this or the from/to pair."),
  from_servings: z
    .number()
    .positive()
    .max(500)
    .optional()
    .describe("How many servings the list is written for."),
  to_servings: z.number().positive().max(500).optional().describe("How many servings are wanted."),
});

export const scaleIngredientsOutput = z.object({
  factor: z.number(),
  ingredients: z.array(scaledIngredientSchema),
  scaled_count: z.number().int().describe("Lines whose arithmetic came out exact."),
  rounded_count: z
    .number()
    .int()
    .describe("Lines whose value was moved to stay usable, not lines that could have been."),
  unscaled_count: z.number().int().describe("Lines carrying nothing that can be multiplied."),
  notes: z.array(z.string()),
});

export type ScaleIngredientsArgs = z.infer<typeof scaleIngredientsInput>;

/**
 * Print a factor without rounding it out of existence.
 *
 * Two decimals turn 0.001 into "0", which states that nothing was applied while
 * every quantity in the list was divided by a thousand.
 */
function formatFactor(factor: number): string {
  return String(Number(factor.toPrecision(3)));
}

export function runScaleIngredients(args: ScaleIngredientsArgs): ToolResult {
  try {
    const notes: string[] = [];
    let factor: number;

    if (args.factor !== undefined) {
      factor = args.factor;
      if (args.from_servings !== undefined || args.to_servings !== undefined) {
        notes.push(
          "'factor' was given alongside 'from_servings'/'to_servings'. 'factor' was applied and the " +
            "pair ignored; send only one of the two to remove the ambiguity.",
        );
      }
    } else if (args.from_servings !== undefined && args.to_servings !== undefined) {
      factor = args.to_servings / args.from_servings;
    } else {
      throw invalidInput(
        "Provide either 'factor', or both 'from_servings' and 'to_servings'.",
        "For example from_servings=6 and to_servings=4, or factor=0.667.",
      );
    }

    const ingredients = scaleIngredients(args.ingredients, { factor });
    const counts = {
      scaled: ingredients.filter((entry) => entry.scaling === "scaled").length,
      rounded: ingredients.filter((entry) => entry.scaling === "rounded").length,
      unscaled: ingredients.filter((entry) => entry.scaling === "unscaled").length,
      clamped: ingredients.filter((entry) => CLAMPED_UP.test(entry.note ?? "")).length,
    };

    if (counts.rounded > 0) {
      notes.push(
        `${counts.rounded} quantity(ies) were rounded to stay usable rather than left as fractions.`,
      );
    }
    if (counts.unscaled > 0) {
      notes.push(
        `${counts.unscaled} line(s) carry no usable quantity and were returned unchanged; adjust to taste.`,
      );
    }
    if (counts.clamped > 0) {
      notes.push(
        `${counts.clamped} quantity(ies) fell below the smallest amount worth measuring and were clamped up, ` +
          "so their proportions no longer match the original list.",
      );
    }
    notes.push(SCALING_CAVEAT);

    const structured = {
      factor: Number(factor.toPrecision(3)),
      ingredients: ingredients.map(toScaledIngredientOut),
      scaled_count: counts.scaled,
      rounded_count: counts.rounded,
      unscaled_count: counts.unscaled,
      notes,
    };

    const lines = ingredients
      .map((entry) => `- ${entry.text}${entry.scaling === "unscaled" ? " (not adjusted)" : ""}`)
      .join("\n");

    return ok(structured, `Factor ${formatFactor(factor)}:\n${lines}`, { notes });
  } catch (error) {
    return toToolError(error);
  }
}
