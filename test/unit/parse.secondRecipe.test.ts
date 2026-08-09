/**
 * A page carrying a second recipe says so.
 *
 * A heading owns what is nested under it and stops at the next heading of its
 * own level, so a second ingredient list beside the first is outside the read.
 * Returning the first list alone is defensible; returning it as though it were
 * the whole page is not.
 */

import { describe, expect, it } from "vitest";
import { toRecipePage } from "../../src/wikibooks/parse.js";
import { runGetRecipe } from "../../src/tools/getRecipe.js";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { fixture, routedFetch, silentLogger } from "./helpers.js";

describe("a page carrying two recipes", () => {
  it("names the sections it did not read", () => {
    const read = toRecipePage(fixture("page-two-recipes"), "https://example.invalid/page");
    expect(read.ingredients).toEqual(["200 g late fruit", "100 g pale sugar"]);
    expect(read.furtherSections).toEqual(["Ingredients (baked)", "Procedure (baked)"]);
  });

  it("tells the caller a further list stands beside the one returned", async () => {
    const { fetchImpl } = routedFetch([["/page/", fixture("page-two-recipes")]]);
    const client = new CookbookClient({
      config: { cacheTtlMs: 0, minIntervalMs: 500, maxRetries: 0 },
      logger: silentLogger,
      fetchImpl,
    });
    const result = await runGetRecipe(client, {
      id: "Cookbook:Orchard_Pudding",
      max_description_chars: 1200,
    } as never);
    const notes = (result.structuredContent as { notes: string[] }).notes;
    expect(notes.some((note) => note.includes("Ingredients (baked)"))).toBe(true);
  });
});
