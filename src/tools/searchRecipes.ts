/**
 * search_recipes: find a page in the Cookbook by dish or by ingredient.
 *
 * The Cookbook shares a wiki with every other book on Wikibooks, and the search
 * index does not stop at its edge. Rows from elsewhere are dropped, and how
 * many were dropped is reported, because a short list is otherwise read as a
 * rare dish rather than as a query that wandered.
 */

import { z } from "zod";
import type { CookbookClient } from "../wikibooks/client.js";
import { ok, renderResults, searchResultSchema, toToolError } from "./shared.js";
import type { ToolResult } from "./shared.js";

export const searchRecipesDescription = [
  "Search the Wikibooks Cookbook for a recipe, by dish name or by an ingredient it uses.",
  "'text' searches the whole of each page, which is what finds a dish from an ingredient inside it; 'title' matches the page name only, which is exact and misses a dish the Cookbook names differently.",
  "The Cookbook also holds reference pages on ingredients, techniques and cuisines, and those rank alongside recipes: a row is a page, and only get_recipe can say whether it carries an ingredient list.",
  "A full-text row can be a page that merely names the dish: when the titles do not say the words searched for, the notes say so, because the Cookbook links to dishes it does not hold.",
  "'total_available' is null because the search route reports no total and offers no second page. Narrow the query rather than asking for more.",
  "Every row carries an 'id', which get_recipe takes.",
].join(" ");

export const searchRecipesInput = z.object({
  query: z
    .string()
    .min(1)
    .max(300)
    .describe("A dish, such as 'carbonara', or an ingredient, such as 'guanciale'."),
  search: z
    .enum(["text", "title"])
    .default("text")
    .describe("'text' reads the whole page; 'title' matches the page name only."),
  limit: z.number().int().min(1).max(50).default(10),
});

export const searchRecipesOutput = z.object({
  query: z.string(),
  results: z.array(searchResultSchema),
  result_count: z.number().int().describe("Rows returned by this call."),
  total_available: z
    .number()
    .int()
    .nullable()
    .describe("Always null: the search route publishes no total and no paging."),
  source: z.string(),
  notes: z.array(z.string()),
});

export type SearchRecipesArgs = z.infer<typeof searchRecipesInput>;

/**
 * Whether a page title names what was searched for.
 *
 * A full-text search ranks a page listing a dish among a country's specialities
 * beside a page cooking it, and the two are told apart by whether the title
 * says the words. Accents, punctuation and the namespace are dropped, and words
 * of two letters are ignored, so "cuisine of Spain" does not pass for
 * "crema catalana" on the strength of an "of".
 */
function titleCarries(title: string, query: string): boolean {
  const fold = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ");

  const haystack = ` ${fold(title.replace(/^Cookbook:/i, ""))} `;
  const words = fold(query)
    .split(" ")
    .filter((word) => word.length > 2);
  if (words.length === 0) return true;
  return words.every((word) => haystack.includes(` ${word}`));
}

export async function runSearchRecipes(
  client: CookbookClient,
  args: SearchRecipesArgs,
): Promise<ToolResult> {
  try {
    const { data, cached, skipped } = await client.search(args.query, args.limit, args.search);

    const notes: string[] = [];
    if (cached) notes.push("Served from this server's short-lived in-memory cache.");
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

    if (data.outsideCookbook > 0) {
      notes.push(
        `${data.outsideCookbook} of the ${data.asked} ranked pages belong to other books on Wikibooks and were dropped.`,
      );
    }
    if (results.length === 0) {
      notes.push(
        "Nothing in the Cookbook matches. Try the ingredient rather than the dish, or the English name the Cookbook would use.",
      );
    } else {
      notes.push(
        "A row can be a reference page on an ingredient or a technique rather than a recipe. Open it with get_recipe before describing it as one.",
      );
      const mentions = results.filter((row) => !titleCarries(row.title, args.query)).length;
      if (mentions > 0) {
        notes.push(
          `${mentions} of the ${results.length} rows matched "${args.query}" inside the page rather than in the title, so they mention the dish. ` +
            "A page that mentions a dish need not hold a recipe for it, and the Cookbook links to dishes it does not carry.",
        );
      }
    }
    if (args.search === "title" && results.length === 0) {
      notes.push("A title search matches the page name only; 'text' reads inside the pages.");
    }

    const body =
      results.length === 0
        ? `Nothing in the Cookbook for "${args.query}".`
        : `${results.length} page(s) for "${args.query}":\n${renderResults(results)}`;

    return ok(
      {
        query: args.query,
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
