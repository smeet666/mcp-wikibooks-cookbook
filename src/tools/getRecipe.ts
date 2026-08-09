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
import { strictInput } from "./arguments.js";
import type { ToolResult } from "./shared.js";

export const getRecipeDescription = [
  "Read one Wikibooks Cookbook page: ingredients, equipment, steps, yield, time, difficulty, category, and the nutrition panel when the page carries one.",
  "'id' is the page key from search_recipes or list_recipes, such as 'Cookbook:Spaghetti_alla_Carbonara'. A plain dish name is accepted and the Cookbook namespace is added.",
  "Pass 'servings' to rescale: a countable thing lands on the smallest share a cook can take out of one of it, which is a whole one where half of one cannot be measured out at all, such as an egg or a whole clove, a half where half of one pours, weighs or splits, such as a can or a packet, and a quarter where a knife or the size of the thing goes further, such as an onion, a slice of bread or a jar; a measurement is moved to a smaller unit before rounding so nothing disappears; and anything that cannot be multiplied is flagged instead. Read 'scaling' on each ingredient rather than doing the arithmetic yourself.",
  "A page that groups its ingredients by what they are for, such as a cake and its glaze, states that group on every line; a page that lists them flat states null. Two lines can read alike and belong to different parts of the dish.",
  "A page offering several versions of the dish states which one each line came from in 'variant'. Those lists replace one another: one of them is used, even where the procedure says to mix all the ingredients.",
  "A measurement the page writes as a conversion template is read as the value and the unit the page wrote, and the counterpart the template computes is left out: nothing here is converted between measuring systems.",
  "A line asking for as much as is needed and giving an indication in brackets, such as 'water as required (about 1 ½ cups)', states a quantity: the indication is scaled with the recipe and the wording in front of it is left as the page wrote it. A line offering an alternative in brackets, such as '4 eggs (or 8 egg yolks)', has both branches scaled, since a cook takes one of them.",
  "The Cookbook keeps recipes and the book's own chapter indexes in one namespace, and both write 'Ingredients' over a bulleted list. A page carrying no recipe box, no recipe banner and no procedure comes back with empty lists and a note: its bullets are links to other pages rather than things to buy.",
  "A heading owns what is nested under it and stops at the next heading of its own level, so a page carrying two recipes returns the first of each part and names the rest in a note.",
  "A page that only redirects elsewhere is followed to the page it points at, and 'id' and 'redirected_from' say which page was read.",
  "Rescaling needs a yield to scale from. A page that states none comes back as published, and says so.",
  "A page yielding no quantities is answered with 'factor' 1 and a note: an empty ingredient list was multiplied by nothing.",
  "'author' and 'rating' are always null: the Cookbook is written collectively and carries no reader score.",
  "A time the page does not state is null, never zero, and never inferred from the steps. A page stating phases rather than a total, such as a fermentation and a cooking, publishes them in 'time_phases' with 'total_minutes' null: the phases measure different things and are never added.",
  "Pages are published under a licence that requires attribution; 'license' and 'url' carry what to credit.",
].join(" ");

export const getRecipeInput = strictInput({
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

/**
 * An ingredient as this page publishes it, with the part of the dish it is for.
 *
 * The group is what a recipe means by writing "2 tablespoons rum" twice: once
 * for the soak and once for the glaze. Flattened away, the list reads as a
 * mistake; kept, it reads as the recipe.
 */
const recipeIngredientSchema = scaledIngredientSchema.extend({
  group: z
    .string()
    .nullable()
    .describe(
      "The part of the dish this line is for, such as 'Glaze'. Null when the page names none. Every part is made, so a caller buys all of them.",
    ),
  variant: z
    .string()
    .nullable()
    .describe(
      "The alternative list this line belongs to, such as 'Variation II'. Null when the line belongs to the recipe itself. Lines carrying different variants replace one another: exactly one of them is used, whatever the procedure says about mixing everything.",
    ),
});

const timePhaseSchema = z.object({
  label: z
    .string()
    .nullable()
    .describe("The phase as the page names it, such as 'Fermentation'. Null when it names none."),
  text: z.string().describe("The duration in the page's own wording."),
  minutes: z
    .number()
    .nullable()
    .describe("The duration in minutes, or the lower bound of a range."),
  minutes_max: z
    .number()
    .nullable()
    .describe("The upper bound where the page gives a range, null where it gives one figure."),
});

export const getRecipeOutput = z.object({
  id: z.string().describe("The page that was read, which differs from 'id' after a redirect."),
  title: z.string(),
  url: z.string(),
  redirected_from: z
    .array(z.string())
    .describe("Redirect pages walked to reach this one. Empty when the page was reached directly."),
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
  ingredients: z.array(recipeIngredientSchema),
  equipment: z.array(z.string()),
  steps: z.array(z.string()),
  tips: z.array(z.string()).describe("Notes, tips and variations the page publishes."),
  prep_minutes: z
    .number()
    .nullable()
    .describe("The phase the page labels as preparation. Null when it labels none."),
  cook_minutes: z
    .number()
    .nullable()
    .describe("The phase the page labels as cooking. Null when it labels none."),
  total_minutes: z
    .number()
    .nullable()
    .describe(
      "The whole dish, stated only where the page states a total: one duration, or a phase the page itself calls the total. Null where the page states phases and no total, since a fermentation, a marinade or a rest is not cooking time and adding them would answer with a figure nobody published. Read 'time_phases' instead.",
    ),
  time_text: z.string().nullable().describe("The time in the page's own wording."),
  time_phases: z
    .array(timePhaseSchema)
    .describe("Each duration the page states, in the order it states them."),
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
    const { data: read, cached } = await client.getRecipe(args.id);
    // A page that cooks nothing publishes no shopping list. The Cookbook's own
    // chapter indexes write "Ingredients" over a column of links to the pages
    // behind them, and read as a recipe those links become twelve things to buy.
    const data: typeof read = read.readsAsRecipe
      ? read
      : {
          ...read,
          ingredients: [],
          unreadableIngredients: 0,
          ingredientGroups: [],
          ingredientVariants: [],
          equipment: [],
        };
    const notes: string[] = [];
    if (cached) notes.push("Served from this server's short-lived in-memory cache.");
    // Named first among the notes, and never dropped: the recipe answered is
    // not the page the caller asked for, and a caller told nothing would credit
    // the wrong address.
    const [asked, ...alsoWalked] = data.redirectedFrom;
    if (asked !== undefined) {
      notes.push(
        alsoWalked.length === 0
          ? `${asked} is a redirect, so this is ${data.key}, the page it points at.`
          : `${asked} is a redirect, and following it through ${alsoWalked.join(", ")} reached ${data.key}, whose recipe this is.`,
      );
    }

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

    if (!read.readsAsRecipe) {
      const lists = read.ingredients.length + read.equipment.length;
      notes.push(
        "This page carries no recipe: no recipe box, no recipe banner, and no procedure with steps in it. It may be a page about an ingredient, a technique or a cuisine, or an index pointing at the recipes themselves." +
          (lists > 0
            ? ` The ${lists} bulleted line(s) under its headings are the book's own links and were not read as a recipe's ingredients or equipment.`
            : "") +
          " Follow the link and read it.",
      );
    } else if (data.ingredients.length === 0) {
      const headings = data.sectionTitles.filter((title) => title !== "");
      notes.push(
        "This page reads as a recipe and publishes no ingredient list under a heading this server reads, as a list or as a table." +
          (headings.length > 0
            ? ` The headings it does publish are ${headings.map((title) => `"${title}"`).join(", ")}.`
            : "") +
          " Follow the link and read the list where the page put it.",
      );
    }
    if (data.unreadableIngredients > 0) {
      notes.push(
        `${data.unreadableIngredients} ingredient line(s) the page writes came back empty, everything on them being markup this server renders as nothing, and are missing from the list below.`,
      );
    }
    if (data.furtherSections.length > 0) {
      notes.push(
        `This page publishes further sections beside the ones read: ${data.furtherSections.map((title) => `"${title}"`).join(", ")}. A heading owns what is nested under it and stops at the next heading of its own level, so what came back is the first list of each kind. A page carrying two recipes carries the second one there.`,
      );
    }
    if (data.steps.length === 0 && data.ingredients.length > 0) {
      notes.push(
        "This page publishes ingredients but no procedure under a heading this server reads.",
      );
    }

    // Named among the first notes: a procedure reading "mix all ingredients"
    // covers one of these lists, and a caller shown the lines together buys
    // three times the fish and cooks a dish nobody wrote.
    const variants = [...new Set(data.ingredientVariants.filter((name) => name !== null))];
    if (variants.length > 0) {
      const alsoOwn = data.ingredientVariants.some((name) => name === null);
      notes.push(
        `This page publishes ${variants.length} alternative ingredient list(s), under ${variants.map((name) => `"${name}"`).join(", ")}${alsoOwn ? ", beside the list the recipe states for itself" : ""}. Each one replaces the others rather than adding to them, so one of them is used and the procedure applies to whichever it is, whatever it says about mixing all the ingredients. 'variant' on every line says which list it came from.`,
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

    const phased = data.timePhases.filter((phase) => phase.minutes !== null);
    if (data.totalMinutes === null && phased.length > 0) {
      notes.push(
        `This page states its time in phases (${phased.map((phase) => (phase.label === null ? phase.text : `${phase.label}: ${phase.text}`)).join("; ")}) and states no total, so 'total_minutes' is null. The phases are not added: a fermentation, a marinade or a rest is not cooking time, and their sum is a figure the page never published. 'time_phases' carries each one.`,
      );
    } else if (data.totalMinutes === null && data.timeText !== null) {
      notes.push(
        `The page states its time as "${data.timeText}", which is not a number of minutes.`,
      );
    }
    if (data.license) {
      notes.push(
        `Published under ${data.license.title}. Quoting the recipe means crediting Wikibooks and naming that licence.`,
      );
    }

    const groupOf = (index: number) => data.ingredientGroups[index] ?? null;
    const variantOf = (index: number) => data.ingredientVariants[index] ?? null;

    const structured = {
      id: data.key,
      title: data.title,
      url: data.sourceUrl,
      redirected_from: data.redirectedFrom,
      yield: {
        original_count: data.servings,
        original_text: data.yieldText,
        requested: args.servings ?? null,
        unit: data.yieldUnit,
        factor: Number(factor.toPrecision(3)),
      },
      ingredients: ingredients.map((entry, index) => ({
        ...toScaledIngredientOut(entry),
        group: groupOf(index),
        variant: variantOf(index),
      })),
      equipment: data.equipment,
      steps: data.steps,
      tips: data.tips,
      prep_minutes: data.prepMinutes,
      cook_minutes: data.cookMinutes,
      total_minutes: data.totalMinutes,
      time_text: data.timeText,
      time_phases: data.timePhases.map((phase) => ({
        label: phase.label,
        text: phase.text,
        minutes: phase.minutes,
        minutes_max: phase.minutesMax,
      })),
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

    return ok(structured, renderRecipe(data.title, structured, ingredients, groupOf, variantOf), {
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
  groupOf: (index: number) => string | null,
  variantOf: (index: number) => string | null,
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

  const shown = (entry: ScaledIngredient) =>
    `${entry.text}${entry.scaling === "unscaled" ? " (not adjusted)" : ""}`;

  const own = ingredients.filter((_entry, index) => variantOf(index) === null);
  if (own.length > 0) {
    lines.push("", "Ingredients:");
    // The group is printed as it changes rather than on every line: a recipe
    // that calls for the same quantity in two of its parts reads as a repeat
    // without it, and as a soak and a glaze with it.
    let printed: string | null = null;
    ingredients.forEach((entry, index) => {
      if (variantOf(index) !== null) return;
      const group = groupOf(index);
      if (group !== null && group !== printed) lines.push(`  ${group}:`);
      printed = group;
      const indent = group === null ? "  " : "    ";
      lines.push(`${indent}${shown(entry)}`);
    });
  }

  // The alternatives stand under a heading of their own and never inside the
  // list above: run together, they read as one order of shopping, and the
  // procedure that says to mix everything then covers all of them at once.
  const alternatives = [
    ...new Set(
      ingredients.map((_entry, index) => variantOf(index)).filter((name) => name !== null),
    ),
  ];
  if (alternatives.length > 0) {
    lines.push("", `Alternative ingredient lists, one of which is used instead of the others:`);
    for (const name of alternatives) {
      lines.push(`  ${name}:`);
      ingredients.forEach((entry, index) => {
        if (variantOf(index) === name) lines.push(`    ${shown(entry)}`);
      });
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
