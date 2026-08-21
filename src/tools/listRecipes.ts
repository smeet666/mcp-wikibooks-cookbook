/**
 * list_recipes: browse the Cookbook by cuisine, by kind of dish, or by main
 * ingredient.
 *
 * The developer gateway publishes no route that lists the members of a
 * category, so this is a search shaped to the Cookbook's own vocabulary rather
 * than a walk through a category tree. The consequence is stated in the tool's
 * description and in its notes: the answer is a ranked sample, and neither the
 * size of the category nor the completeness of the list can be claimed from it.
 */

import { z } from "zod";
import { invalidInput } from "../errors.js";
import type { CookbookClient } from "../wikibooks/client.js";
import { strictInput } from "./arguments.js";
import { ok, renderResults, searchResultSchema, toToolError } from "./shared.js";
import type { ToolResult } from "./shared.js";

export const listRecipesDescription = [
  "Browse the Wikibooks Cookbook by cuisine, by kind of dish, or by main ingredient. Give at least one of the three; giving several narrows the result.",
  "This is built on the Cookbook's search, because the route this server is allowed to use publishes no way to list the members of a category. What comes back is therefore a ranked sample and not the category itself: it is neither complete nor ordered, and its length says nothing about how many recipes the Cookbook holds on the subject.",
  "The Cookbook also holds reference pages on ingredients and techniques, and those rank alongside recipes. Open a row with get_recipe before describing it as a recipe.",
  "Use search_recipes instead when there is a dish name to look up.",
].join(" ");

export const listRecipesInput = strictInput({
  cuisine: z
    .string()
    .max(80)
    .optional()
    .describe("A cuisine or a country, such as 'Italian' or 'Thai'."),
  dish_type: z
    .string()
    .max(80)
    .optional()
    .describe("A kind of dish, such as 'soup', 'dessert' or 'bread'."),
  main_ingredient: z
    .string()
    .max(80)
    .optional()
    .describe("The ingredient a recipe is built on, such as 'chicken' or 'lentils'."),
  limit: z.number().int().min(1).max(50).default(15),
});

export const listRecipesOutput = z.object({
  query: z.string().describe("The search this server built from the arguments."),
  cuisine: z.string().nullable(),
  dish_type: z.string().nullable(),
  main_ingredient: z.string().nullable(),
  results: z.array(searchResultSchema),
  result_count: z.number().int(),
  total_available: z
    .number()
    .int()
    .nullable()
    .describe("Always null: no route reports how many recipes a category holds."),
  source: z.string(),
  notes: z.array(z.string()),
});

export type ListRecipesArgs = z.infer<typeof listRecipesInput>;

/**
 * Build the query out of the facets, in the wording the Cookbook files pages
 * under: its categories read "Italian recipes", "Recipes for dessert" and
 * "Recipes using pasta and noodles".
 */
export function buildBrowseQuery(args: {
  cuisine?: string | undefined;
  dish_type?: string | undefined;
  main_ingredient?: string | undefined;
}): string {
  const parts: string[] = [];
  const cuisine = args.cuisine?.trim();
  const dish = args.dish_type?.trim();
  const ingredient = args.main_ingredient?.trim();

  if (cuisine) {
    parts.push(`${cuisine} recipes`);
  }
  if (dish) {
    parts.push(`recipes for ${dish}`);
  }
  if (ingredient) {
    parts.push(`recipes using ${ingredient}`);
  }

  return parts.join(" ");
}

export async function runListRecipes(
  client: CookbookClient,
  args: ListRecipesArgs,
): Promise<ToolResult> {
  try {
    const query = buildBrowseQuery(args);
    if (query === "") {
      throw invalidInput(
        "Give at least one of 'cuisine', 'dish_type' or 'main_ingredient'.",
        "For example cuisine='Italian', or dish_type='soup' with main_ingredient='lentils'.",
      );
    }

    const { data, cached, skipped } = await client.search(query, args.limit, "text");

    const notes: string[] = [];
    if (cached) {
      notes.push("Served from this server's short-lived in-memory cache.");
    }
    if (skipped) {
      notes.push(
        `${skipped} row(s) came back in a shape this server could not read and were left out.`,
      );
    }

    const results = data.results.map((row) => ({
      id: row.key,
      title: row.title,
      url: row.sourceUrl,
      image_url: row.imageUrl,
      description: row.description,
      excerpt: row.excerpt,
    }));

    notes.push(
      `This is a ranked sample of what the Cookbook's search returns for "${query}", not the contents of a category. More recipes on the subject exist than are shown, and some rows may be about it rather than a recipe of it.`,
    );
    if (data.outsideCookbook > 0) {
      notes.push(
        `${data.outsideCookbook} of the ${data.asked} ranked pages belong to other books on Wikibooks and were dropped.`,
      );
    }
    if (results.length === 0) {
      notes.push(
        "Nothing came back. Try one facet rather than three, or the word the Cookbook would use for the cuisine.",
      );
    }

    const body =
      results.length === 0
        ? `Nothing in the Cookbook for ${query}.`
        : `${results.length} page(s) for ${query}:\n${renderResults(results)}`;

    return ok(
      {
        query,
        cuisine: args.cuisine ?? null,
        dish_type: args.dish_type ?? null,
        main_ingredient: args.main_ingredient ?? null,
        results,
        result_count: results.length,
        total_available: null,
        source: "Wikibooks Cookbook",
        notes,
      },
      body,
      { notes },
    );
  } catch (error) {
    return toToolError(error);
  }
}
