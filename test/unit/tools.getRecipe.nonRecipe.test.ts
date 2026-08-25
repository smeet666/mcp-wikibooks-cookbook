/**
 * What a page has to carry before its lists are called a recipe's.
 *
 * The Cookbook keeps recipes and the book's own navigation in one namespace,
 * and both write "Ingredients" over a bulleted list. A contents page whose
 * bullets are chapter links is not a shopping list; a page with a recipe box,
 * a banner and numbered steps is a recipe whatever its ingredients are filed
 * under.
 */

import { describe, expect, it } from "vitest";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { runGetRecipe } from "../../src/tools/getRecipe.js";
import { fixture, routedFetch, silentLogger } from "./helpers.js";

async function read(page: string, id: string) {
  const { fetchImpl } = routedFetch([["/page/", fixture(page)]]);
  const client = new CookbookClient({
    config: { cacheTtlMs: 0, minIntervalMs: 500, maxRetries: 0 },
    logger: silentLogger,
    fetchImpl,
  });
  const result = await runGetRecipe(client, { id, max_description_chars: 1200 } as never);
  return result.structuredContent as {
    ingredients: Array<{ text: string }>;
    equipment: string[];
    notes: string[];
  };
}

describe("a contents page", () => {
  it("hands back no ingredients and no equipment", async () => {
    const out = await read("page-index", "Cookbook:Orchard_Contents");
    expect(out.ingredients).toEqual([]);
    expect(out.equipment).toEqual([]);
  });

  it("says the page carries no recipe rather than that it publishes ingredients", async () => {
    const out = await read("page-index", "Cookbook:Orchard_Contents");
    expect(out.notes.some((note) => note.includes("publishes ingredients"))).toBe(false);
    expect(out.notes.some((note) => /carries no recipe/i.test(note))).toBe(true);
  });
});

describe("a recipe whose ingredients sit under a heading this parser does not read", () => {
  it("does not suggest the page may be something other than a recipe", async () => {
    const out = await read("page-unread-heading", "Cookbook:Orchard_Loaf");
    expect(out.ingredients).toEqual([]);
    expect(out.notes.some((note) => note.includes("rather than a recipe"))).toBe(false);
  });

  it("names the headings the page does publish, so the list can be found", async () => {
    const out = await read("page-unread-heading", "Cookbook:Orchard_Loaf");
    expect(out.notes.some((note) => note.includes("What you need"))).toBe(true);
  });
});
