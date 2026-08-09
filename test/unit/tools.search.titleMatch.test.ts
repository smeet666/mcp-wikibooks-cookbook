/**
 * What a title search may claim about where a row matched.
 *
 * A title search reads page names and nothing else. A row whose name does not
 * carry the words asked for was reached under another name the wiki files the
 * page under, and saying the words were found inside the page describes a read
 * that never happened.
 */

import { describe, expect, it } from "vitest";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { runSearchRecipes } from "../../src/tools/searchRecipes.js";
import { fixture, routedFetch, silentLogger } from "./helpers.js";

async function search(mode: "text" | "title") {
  const { fetchImpl } = routedFetch([
    ["/search/title", fixture("search-recipes")],
    ["/search/page", fixture("search-recipes")],
  ]);
  const client = new CookbookClient({
    config: { cacheTtlMs: 0, minIntervalMs: 500, maxRetries: 0 },
    logger: silentLogger,
    fetchImpl,
  });
  const result = await runSearchRecipes(client, { query: "aubergine", search: mode, limit: 10 });
  return (result.structuredContent as { notes: string[] }).notes;
}

describe("a title search", () => {
  it("never says a row matched inside the page", async () => {
    const notes = await search("title");
    expect(notes.some((note) => note.includes("inside the page"))).toBe(false);
  });

  it("says the page is filed under another name", async () => {
    const notes = await search("title");
    expect(notes.some((note) => /another name/i.test(note))).toBe(true);
  });
});

describe("a full-text search", () => {
  it("still says which rows matched inside the page", async () => {
    const notes = await search("text");
    expect(notes.some((note) => note.includes("inside the page"))).toBe(true);
  });
});
