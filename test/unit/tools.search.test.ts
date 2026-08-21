import { describe, expect, it } from "vitest";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { buildBrowseQuery, runListRecipes } from "../../src/tools/listRecipes.js";
import { runSearchRecipes } from "../../src/tools/searchRecipes.js";
import { fixture, routedFetch, silentLogger } from "./helpers.js";

function client(routes: [string, unknown][]) {
  const { fetchImpl, calls } = routedFetch(routes);
  return {
    calls,
    client: new CookbookClient({
      config: { cacheTtlMs: 0, minIntervalMs: 500, maxRetries: 0 },
      logger: silentLogger,
      fetchImpl,
    }),
  };
}

const SEARCH = [["/search/page", fixture("search-recipes")]] as [string, unknown][];

describe("search_recipes", () => {
  it("returns the Cookbook rows with the id get_recipe takes", async () => {
    const { client: wikibooks } = client(SEARCH);
    const result = await runSearchRecipes(wikibooks, { query: "salt", search: "text", limit: 10 });
    const structured = result.structuredContent as {
      results: Array<{ id: string; url: string; image_url: string | null }>;
      result_count: number;
      total_available: number | null;
      source: string;
    };

    expect(structured.results.map((row) => row.id)).toEqual([
      "Cookbook:Salt_Flat_Noodles",
      "Cookbook:Orchard_Butter",
    ]);
    expect(structured.result_count).toBe(2);
    expect(structured.source).toBe("Wikibooks Cookbook");
    expect(structured.results[0]!.url).toContain("en.wikibooks.org/wiki/");
  });

  it("reports no total rather than passing the row count off as one", async () => {
    const { client: wikibooks } = client(SEARCH);
    const result = await runSearchRecipes(wikibooks, { query: "salt", search: "text", limit: 10 });
    expect((result.structuredContent as { total_available: unknown }).total_available).toBeNull();
  });

  it("says how many ranked pages belonged to another book", async () => {
    const { client: wikibooks } = client(SEARCH);
    const result = await runSearchRecipes(wikibooks, { query: "salt", search: "text", limit: 10 });
    const notes = (result.structuredContent as { notes: string[] }).notes;
    expect(notes.some((note) => note.includes("other books on Wikibooks"))).toBe(true);
  });

  it("warns that a row may be a reference page rather than a recipe", async () => {
    const { client: wikibooks } = client(SEARCH);
    const result = await runSearchRecipes(wikibooks, { query: "salt", search: "text", limit: 10 });
    const notes = (result.structuredContent as { notes: string[] }).notes;
    expect(notes.some((note) => note.includes("reference page"))).toBe(true);
  });

  it("asks the gateway for more rows than the caller wants, because rows get dropped", async () => {
    const { client: wikibooks, calls } = client(SEARCH);
    await runSearchRecipes(wikibooks, { query: "salt", search: "text", limit: 5 });
    expect(calls[0]!.url).toContain("limit=15");
  });

  it("scopes the query to the Cookbook", async () => {
    const { client: wikibooks, calls } = client(SEARCH);
    await runSearchRecipes(wikibooks, { query: "salt", search: "text", limit: 5 });
    expect(calls[0]!.url).toContain("q=Cookbook%3A+salt");
  });

  it("reads titles only when asked to", async () => {
    const { client: wikibooks, calls } = client([["/search/title", fixture("search-recipes")]]);
    await runSearchRecipes(wikibooks, { query: "Noodles", search: "title", limit: 5 });
    expect(calls[0]!.url).toContain("/search/title");
  });

  it("calls an empty result an absence and suggests what to do", async () => {
    const { client: wikibooks } = client([["/search/page", fixture("search-empty")]]);
    const result = await runSearchRecipes(wikibooks, { query: "zzz", search: "text", limit: 5 });
    const structured = result.structuredContent as { result_count: number; notes: string[] };
    expect(structured.result_count).toBe(0);
    expect(result.isError).toBeUndefined();
    expect(structured.notes.some((note) => note.includes("Nothing in the Cookbook"))).toBe(true);
  });

  it("reports an unreadable answer as a failure rather than as an empty list", async () => {
    const { client: wikibooks } = client([["/search/page", fixture("search-no-pages")]]);
    const result = await runSearchRecipes(wikibooks, { query: "salt", search: "text", limit: 5 });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("[parse_failure]");
  });

  it("refuses a query with nothing in it rather than searching for nothing", async () => {
    const { client: wikibooks } = client(SEARCH);
    const result = await runSearchRecipes(wikibooks, { query: "   ", search: "text", limit: 5 });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("[invalid_input]");
  });
});

describe("buildBrowseQuery", () => {
  it("uses the wording the Cookbook files pages under", () => {
    expect(buildBrowseQuery({ cuisine: "Italian" })).toBe("Italian recipes");
    expect(buildBrowseQuery({ dish_type: "soup" })).toBe("recipes for soup");
    expect(buildBrowseQuery({ main_ingredient: "lentils" })).toBe("recipes using lentils");
  });

  it("joins the facets a caller gives together", () => {
    expect(buildBrowseQuery({ cuisine: "Thai", main_ingredient: "chicken" })).toBe(
      "Thai recipes recipes using chicken",
    );
  });

  it("is empty when no facet was given", () => {
    expect(buildBrowseQuery({})).toBe("");
  });
});

describe("list_recipes", () => {
  it("says the answer is a ranked sample and not a category", async () => {
    const { client: wikibooks } = client(SEARCH);
    const result = await runListRecipes(wikibooks, { cuisine: "Salt Flat", limit: 15 });
    const notes = (result.structuredContent as { notes: string[] }).notes;
    expect(notes.some((note) => note.includes("not the contents of a category"))).toBe(true);
  });

  it("reports no total, because no route counts a category", async () => {
    const { client: wikibooks } = client(SEARCH);
    const result = await runListRecipes(wikibooks, { cuisine: "Salt Flat", limit: 15 });
    expect((result.structuredContent as { total_available: unknown }).total_available).toBeNull();
  });

  it("refuses to browse with no facet at all", async () => {
    const { client: wikibooks } = client(SEARCH);
    const result = await runListRecipes(wikibooks, { limit: 15 });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("[invalid_input]");
  });

  it("echoes the facets it was given and the query it built", async () => {
    const { client: wikibooks } = client(SEARCH);
    const result = await runListRecipes(wikibooks, { dish_type: "soup", limit: 5 });
    expect(result.structuredContent).toMatchObject({
      query: "recipes for soup",
      cuisine: null,
      dish_type: "soup",
      main_ingredient: null,
    });
  });
});
