/**
 * One request per route, against the real gateway.
 *
 * Held behind an environment variable, because the rest of the suite must not
 * depend on a network or on what somebody edited on the wiki this morning.
 * These assertions name shapes rather than contents for the same reason.
 *
 *   WB_LIVE=1 npm run test:live
 */

import { describe, expect, it } from "vitest";
import { CookbookClient } from "../../src/wikibooks/client.js";

const live = process.env.WB_LIVE === "1" ? describe : describe.skip;

live("the Wikimedia gateway", () => {
  const client = new CookbookClient({ config: { cacheTtlMs: 0 } });

  it("answers a full-text search with Cookbook pages", async () => {
    const { data } = await client.search("carbonara", 5, "text");
    expect(data.results.length).toBeGreaterThan(0);
    for (const row of data.results) {
      expect(row.key.startsWith("Cookbook:")).toBe(true);
      expect(row.sourceUrl).toContain("en.wikibooks.org/wiki/");
    }
  });

  it("answers a title search", async () => {
    const { data } = await client.search("Pasta", 5, "title");
    expect(data.results.length).toBeGreaterThan(0);
  });

  it("reads a recipe page with its ingredients and its licence", async () => {
    const { data } = await client.getRecipe("Cookbook:Spaghetti alla Carbonara");
    expect(data.title).toContain("Carbonara");
    expect(data.ingredients.length).toBeGreaterThan(0);
    expect(data.steps.length).toBeGreaterThan(0);
    expect(data.license?.url).toContain("creativecommons.org");
  });

  it("reads a recipe whose ingredients are laid out as a table", async () => {
    const { data } = await client.getRecipe("Cookbook:Crème Brûlée II");
    expect(data.ingredients.length).toBeGreaterThan(0);
    // Every row of such a table names an ingredient, and the quantity sits in
    // whichever column suits it. A row read as a percentage would carry a "%".
    for (const line of data.ingredients) expect(line).not.toMatch(/%/);
    expect(data.ingredients.some((line) => /yolk/i.test(line))).toBe(true);
  });

  it("calls a page that does not exist an absence", async () => {
    await expect(client.getRecipe("Cookbook:No Such Dish At All XYZ")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
