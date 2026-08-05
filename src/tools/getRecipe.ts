/**
 * get_recipe: read one Cookbook page as a recipe, optionally rescaled.
 *
 * Two things decide whether the answer is honest. A page in the Cookbook is not
 * necessarily a recipe: ingredient and technique pages sit in the same
 * namespace, and one returned with empty lists has to say so rather than look
 * like a recipe with nothing in it. And rescaling needs a number to scale from,
 * so a page whose box states no yield is returned as published, with the reason.
 */

import { z } from "zod";
import type { CookbookClient } from "../wikibooks/client.js";
import { passthroughIngredients, scaleIngredients } from "../recipe/scale.js";
import type { ScaledIngredient } from "../recipe/scale.js";
import {
  SCALING_CAVEAT,
  ok,
  scaledIngredientSchema,
  toScaledIngredientOut,
  toToolError,
  truncate,
} from "./shared.js";
import type { ToolResult } from "./shared.js";

export const getRecipeDescription = [
  "Read one Wikibooks Cookbook page: ingredients, equipment, steps, yield, time, difficulty, category, and the nutrition panel when the page carries one.",
  "'id' is the page key from search_recipes or list_recipes, such as 'Cookbook:Spaghetti_alla_Carbonara'. A plain dish name is accepted and the Cookbook namespace is added.",
  "Pass 'servings' to rescale: countable things land on whole or half units, a measurement is moved to a smaller unit before rounding so nothing disappears, and anything that cannot be multiplied is flagged instead. Read 'scaling' on each ingredient rather than doing the arithmetic yourself.",
  "Rescaling needs a yield to scale from. A page that states none comes back as published, and says so.",
  "A page yielding no quantities is answered with 'factor' 1 and a note: an empty ingredient list was multiplied by nothing.",
  "'author' and 'rating' are always null: the Cookbook is written collectively and carries no reader score.",
  "A time the page does not state is null, never zero, and never inferred from the steps.",
  "Pages are published under a licence that requires attribution; 'license' and 'url' carry what to credit.",
].join(" ");

export const getRecipeInput = z.object({
  id: z
    .string()
    .min(1)
    .max(300)
    .describe("Page key from a search, such as 'Cookbook:Spaghetti_alla_Carbonara'."),
  servings: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe("Rescale the ingredients to this many servings."),
  max_description_chars: z.number().int().min(100).max(20_000).default(1200),
});

const nutritionSchema = z.object({
  serving_size: z.string().nullable(),
  servings: z.string().nullable(),
  calories: z.string().nullable(),
  calories_from_fat: z.string().nullable(),
  total_fat: z.string().nullable(),
  saturated_fat: z.string().nullable(),
  cholesterol: z.string().nullable(),
  sodium: z.string().nullable(),
  carbohydrates: z.string().nullable(),
  fiber: z.string().nullable(),
  sugars: z.string().nullable(),
  protein: z.string().nullable(),
  vitamin_a: z.string().nullable(),
  vitamin_c: z.string().nullable(),
  calcium: z.string().nullable(),
  iron: z.string().nullable(),
});

export const getRecipeOutput = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string(),
  yield: z.object({
    original_count: z
      .number()
      .nullable()
      .describe("The published yield as a number, when it is one."),
    original_text: z.string().nullable().describe("The yield in the page's own wording."),
    requested: z.number().nullable().describe("What the caller asked for, null when nothing was."),
    unit: z
      .string()
      .nullable()
      .describe("What the yield counts when it is not servings, such as 'balls'."),
    factor: z
      .number()
      .describe("What the quantities were multiplied by. 1 when nothing was scaled."),
  }),
  ingredients: z.array(scaledIngredientSchema),
  equipment: z.array(z.string()),
  steps: z.array(z.string()),
  tips: z.array(z.string()).describe("Notes, tips and variations the page publishes."),
  prep_minutes: z.number().nullable(),
  cook_minutes: z.number().nullable(),
  total_minutes: z.number().nullable(),
  time_text: z.string().nullable().describe("The time in the page's own wording."),
  category: z.string().nullable(),
  categories: z.array(z.string()).describe("Every category the page files itself under."),
  difficulty: z.number().nullable(),
  difficulty_max: z.number().describe("The scale 'difficulty' sits on."),
  energy: z.string().nullable().describe("Energy per serving as the page states it."),
  author: z.string().nullable().describe("Always null: the Cookbook is written collectively."),
  rating: z.number().nullable().describe("Always null: the Cookbook carries no reader score."),
  nutrition: nutritionSchema.nullable(),
  description: z.string().nullable(),
  attribution: z.string(),
  license: z.object({ title: z.string(), url: z.string() }).nullable(),
  revised_at: z.string().nullable(),
  source: z.string(),
  notes: z.array(z.string()),
});

export type GetRecipeArgs = z.infer<typeof getRecipeInput>;

export async function runGetRecipe(
  client: CookbookClient,
  args: GetRecipeArgs,
): Promise<ToolResult> {
  try {
    const { data, cached } = await client.getRecipe(args.id);
    const notes: string[] = [];
    if (cached) notes.push("Served from this server's short-lived in-memory cache.");

    const counted = data.yieldUnit ?? "servings";
    let factor = 1;
    let ingredients: ScaledIngredient[];

    if (args.servings === undefined) {
      ingredients = passthroughIngredients(data.ingredients);
    } else if (data.ingredients.length === 0) {
      // A factor describes what happened to a list of quantities. With no list,
      // announcing one would state a multiplication that never took place
      // beside an empty `ingredients`, and the two cannot both be true.
      ingredients = [];
      notes.push(
        `No quantities could be read off this page, so nothing was multiplied and the ${args.servings} ${counted} asked for were not applied.`,
      );
    } else if (data.servings === null) {
      ingredients = passthroughIngredients(data.ingredients);
      notes.push(
        data.yieldText === null
          ? `This page states no yield, so there is nothing to scale from and the quantities are as published. ${args.servings} servings were asked for.`
          : `This page states its yield as "${data.yieldText}", which is not a single number to scale from, so the quantities are as published.`,
      );
    } else {
      factor = args.servings / data.servings;
      ingredients = scaleIngredients(data.ingredients, { factor });
      notes.push(
        `Quantities were multiplied by ${formatFactor(factor)}, from ${data.servings} to ${args.servings} ${counted}.`,
      );
    }

    if (data.ingredients.length === 0) {
      notes.push(
        "This page publishes no ingredient list under a heading this server reads, as a list or as a table. It may be a page about an ingredient, a technique or a cuisine rather than a recipe. Follow the link and read it.",
      );
    }
    if (data.steps.length === 0 && data.ingredients.length > 0) {
      notes.push(
        "This page publishes ingredients but no procedure under a heading this server reads.",
      );
    }

    const rounded = ingredients.filter((entry) => entry.scaling === "rounded").length;
    const unscaled = ingredients.filter((entry) => entry.scaling === "unscaled").length;
    if (rounded > 0) {
      notes.push(
        `${rounded} quantity(ies) were rounded to stay usable rather than left as fractions.`,
      );
    }
    if (unscaled > 0) {
      notes.push(
        `${unscaled} line(s) carry no quantity that can be multiplied and were returned as published.`,
      );
    }
    if (factor !== 1) notes.push(SCALING_CAVEAT);
    if (data.totalMinutes === null && data.timeText !== null) {
      notes.push(
        `The page states its time as "${data.timeText}", which is not a number of minutes.`,
      );
    }
    if (data.license) {
      notes.push(
        `Published under ${data.license.title}. Quoting the recipe means crediting Wikibooks and naming that licence.`,
      );
    }

    const structured = {
      id: data.key,
      title: data.title,
      url: data.sourceUrl,
      yield: {
        original_count: data.servings,
        original_text: data.yieldText,
        requested: args.servings ?? null,
        unit: data.yieldUnit,
        factor: Number(factor.toPrecision(3)),
      },
      ingredients: ingredients.map(toScaledIngredientOut),
      equipment: data.equipment,
      steps: data.steps,
      tips: data.tips,
      // The recipe box gives one duration for the whole dish and never splits
      // it, so inventing a preparation and a cooking half would be this server
      // making a claim the page does not.
      prep_minutes: null,
      cook_minutes: null,
      total_minutes: data.totalMinutes,
      time_text: data.timeText,
      category: data.category,
      categories: data.categories,
      difficulty: data.difficulty,
      difficulty_max: data.difficultyMax,
      energy: data.energy,
      author: null,
      rating: null,
      nutrition: data.nutrition
        ? {
            serving_size: data.nutrition.servingSize,
            servings: data.nutrition.servings,
            calories: data.nutrition.calories,
            calories_from_fat: data.nutrition.caloriesFromFat,
            total_fat: data.nutrition.totalFat,
            saturated_fat: data.nutrition.saturatedFat,
            cholesterol: data.nutrition.cholesterol,
            sodium: data.nutrition.sodium,
            carbohydrates: data.nutrition.carbohydrates,
            fiber: data.nutrition.fiber,
            sugars: data.nutrition.sugars,
            protein: data.nutrition.protein,
            vitamin_a: data.nutrition.vitaminA,
            vitamin_c: data.nutrition.vitaminC,
            calcium: data.nutrition.calcium,
            iron: data.nutrition.iron,
          }
        : null,
      description: data.description ? truncate(data.description, args.max_description_chars) : null,
      attribution: "Wikibooks Cookbook contributors",
      license: data.license,
      revised_at: data.revisedAt,
      source: "Wikibooks Cookbook",
      notes,
    };

    return ok(structured, renderRecipe(data.title, structured, ingredients), {
      notes,
      sourceUrl: data.sourceUrl,
    });
  } catch (error) {
    return toToolError(error);
  }
}

/**
 * Print a factor without rounding it out of existence.
 *
 * Two decimals turn 0.001 into "0", which states that nothing was applied while
 * every quantity in the list was divided by a thousand.
 */
function formatFactor(factor: number): string {
  return String(Number(factor.toPrecision(3)));
}

function renderRecipe(
  title: string,
  structured: {
    yield: { original_text: string | null; requested: number | null; unit: string | null };
    time_text: string | null;
    difficulty: number | null;
    difficulty_max: number;
    category: string | null;
    equipment: string[];
    steps: string[];
    nutrition: { serving_size: string | null; calories: string | null } | null;
  },
  ingredients: ScaledIngredient[],
): string {
  const counted = structured.yield.unit ?? "servings";
  // A requested yield is worth printing when quantities went with it. On an
  // empty list it would head a recipe for a number of people the page never
  // gave amounts for.
  const rescaled = structured.yield.requested !== null && ingredients.length > 0;
  const head = [
    title,
    structured.category ? `Category: ${structured.category}` : "",
    rescaled
      ? `Yield: ${structured.yield.requested} ${counted} (published as ${structured.yield.original_text ?? "no yield"})`
      : structured.yield.original_text
        ? `Yield: ${structured.yield.original_text}${structured.yield.unit ? "" : " servings"}`
        : "",
    structured.time_text ? `Time: ${structured.time_text}` : "",
    structured.difficulty === null
      ? ""
      : `Difficulty: ${structured.difficulty} of ${structured.difficulty_max}`,
  ].filter(Boolean);

  const lines = [...head];

  if (ingredients.length > 0) {
    lines.push("", "Ingredients:");
    for (const entry of ingredients) {
      lines.push(`  ${entry.text}${entry.scaling === "unscaled" ? " (not adjusted)" : ""}`);
    }
  }
  if (structured.equipment.length > 0) {
    lines.push("", "Equipment:");
    for (const item of structured.equipment) lines.push(`  ${item}`);
  }
  if (structured.steps.length > 0) {
    lines.push("", "Procedure:");
    structured.steps.forEach((step, index) => lines.push(`  ${index + 1}. ${step}`));
  }
  if (structured.nutrition) {
    const facts = [
      structured.nutrition.serving_size ? `per ${structured.nutrition.serving_size}` : "",
      structured.nutrition.calories ? `${structured.nutrition.calories} calories` : "",
    ].filter(Boolean);
    if (facts.length > 0) lines.push("", `Nutrition as published: ${facts.join(", ")}`);
  }

  return lines.join("\n");
}
