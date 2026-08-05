/**
 * A dish the Cookbook names without holding it.
 *
 * A full-text search matches a page that lists a dish among others as readily
 * as a page that cooks it. Rows whose titles say nothing of the dish are worth
 * a word, because a caller handed two links and no caveat concludes that the
 * recipe exists somewhere behind them.
 */

import { describe, expect, it } from "vitest";
import { runSearchRecipes } from "../../src/tools/searchRecipes.js";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { routedFetch, silentLogger } from "./helpers.js";

function search(query: string, pages: Array<{ key: string; title: string }>) {
  const { fetchImpl } = routedFetch([
    ["/search/page", { pages: pages.map((page, index) => ({ id: index, ...page })) }],
  ]);
  const client = new CookbookClient({
    config: { cacheTtlMs: 0, minIntervalMs: 500, maxRetries: 0 },
    logger: silentLogger,
    fetchImpl,
  });
  return runSearchRecipes(client, { query, search: "text", limit: 10 });
}

const MENTIONS_ONLY = [
  { key: "Cookbook:Cuisine_of_Spain", title: "Cookbook:Cuisine of Spain" },
  { key: "Cookbook:Custard", title: "Cookbook:Custard" },
];

describe("a search whose rows only mention the dish", () => {
  it("says the term was matched inside the text rather than in a title", async () => {
    const result = await search("crema catalana", MENTIONS_ONLY);
    const notes = (result.structuredContent as { notes: string[] }).notes.join(" ");
    expect(notes).toMatch(/mention/i);
  });

  it("says a page naming a dish need not hold a recipe for it", async () => {
    const result = await search("crema catalana", MENTIONS_ONLY);
    const notes = (result.structuredContent as { notes: string[] }).notes.join(" ");
    expect(notes).toMatch(/does not (?:mean|hold)|need not hold/i);
  });

  it("carries the caveat into the text a thin client renders", async () => {
    const result = await search("crema catalana", MENTIONS_ONLY);
    expect(result.content[0]!.text).toMatch(/mention/i);
  });

  it("stays quiet when a title names the dish", async () => {
    const result = await search("carbonara", [
      {
        key: "Cookbook:Spaghetti_alla_Carbonara",
        title: "Cookbook:Spaghetti alla Carbonara",
      },
    ]);
    const notes = (result.structuredContent as { notes: string[] }).notes.join(" ");
    expect(notes).not.toMatch(/mention/i);
  });

  it("counts the rows it is talking about", async () => {
    const result = await search("crema catalana", [
      { key: "Cookbook:Crema_Catalana_II", title: "Cookbook:Crema Catalana II" },
      ...MENTIONS_ONLY,
    ]);
    const notes = (result.structuredContent as { notes: string[] }).notes.join(" ");
    expect(notes).toMatch(/2 of the 3 rows/i);
  });
});
