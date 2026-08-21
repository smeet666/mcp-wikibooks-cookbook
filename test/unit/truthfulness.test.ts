/**
 * The claims an answer is allowed to make.
 *
 * Each of these exists because breaking it turns a missing fact into a stated
 * one: a null printed as a zero, a page nobody could read reported as a recipe
 * with nothing in it, or a note that never reached the text a client renders.
 */

import { describe, expect, it } from "vitest";
import { CookbookError } from "../../src/errors.js";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { getRecipeDescription, runGetRecipe } from "../../src/tools/getRecipe.js";
import { runSearchRecipes } from "../../src/tools/searchRecipes.js";
import {
  ATTRIBUTION,
  MAX_TEXT_CHARS,
  ok,
  scaledIngredientSchema,
  toToolError,
} from "../../src/tools/shared.js";
import { fixture, jsonResponse, routedFetch, silentLogger } from "./helpers.js";

function client(routes: [string, unknown][]) {
  const { fetchImpl } = routedFetch(routes);
  return new CookbookClient({
    config: { cacheTtlMs: 0, minIntervalMs: 500, maxRetries: 0 },
    logger: silentLogger,
    fetchImpl,
  });
}

describe("a null is never rendered as a value", () => {
  it("omits a time the page does not state rather than printing zero", async () => {
    const result = await runGetRecipe(client([["/page/", fixture("page-yield-range")]]), {
      id: "Cookbook:Flat_Bread",
      max_description_chars: 1200,
    } as never);
    const out = result.structuredContent as {
      total_minutes: number | null;
      difficulty: number | null;
    };

    expect(out.total_minutes).toBeNull();
    expect(out.difficulty).toBeNull();
    expect(result.content[0]!.text).not.toContain("Time:");
    expect(result.content[0]!.text).not.toContain("Difficulty:");
  });

  it("never prints a difficulty without the scale it sits on", async () => {
    const result = await runGetRecipe(client([["/page/", fixture("page-recipe")]]), {
      id: "Cookbook:Salt_Flat_Noodles",
      max_description_chars: 1200,
    } as never);
    expect(result.content[0]!.text).toContain("Difficulty: 2 of 5");
  });
});

describe("a failure is never an empty result", () => {
  it("reports a page that does not exist as an absence", async () => {
    const { fetchImpl } = routedFetch([]);
    const failing = new CookbookClient({
      config: { cacheTtlMs: 0, minIntervalMs: 500, maxRetries: 0 },
      logger: silentLogger,
      fetchImpl: (async () =>
        jsonResponse(
          { errorKey: "rest-nonexistent-title", messageTranslations: { en: "no such page" } },
          { status: 404 },
        )) as unknown as typeof fetchImpl,
    });

    const result = await runGetRecipe(failing, {
      id: "Cookbook:No_Such_Dish",
      max_description_chars: 1200,
    } as never);
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("[not_found]");
    expect(result.structuredContent).toBeUndefined();
  });

  it("reports an answer it could not read as a parse failure", async () => {
    const result = await runSearchRecipes(client([["/search/page", fixture("search-no-pages")]]), {
      query: "salt",
      search: "text",
      limit: 5,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("[parse_failure]");
  });

  it("says a rate limit is not an absence", () => {
    const error = new CookbookError("rate_limited", "slow down", {
      hint: "Wait a moment and ask again. This says nothing about whether the page exists.",
    });
    expect(toToolError(error).content[0]!.text).toContain("says nothing about whether the page");
  });
});

describe("every answer carries a link back, and the notes reach the text", () => {
  it("keeps the credit and the address when the body has to be cut", () => {
    const result = ok({}, "x".repeat(MAX_TEXT_CHARS * 2), {
      notes: ["a thing worth knowing"],
      sourceUrl: "https://en.wikibooks.org/wiki/Cookbook:X",
    });
    const text = result.content[0]!.text;

    expect(text.length).toBeLessThanOrEqual(MAX_TEXT_CHARS);
    expect(text).toContain("Note: a thing worth knowing");
    expect(text).toContain("https://en.wikibooks.org/wiki/Cookbook:X");
    expect(text).toContain("[shortened;");
  });

  it("drops notes from the tail rather than crowding out the answer", () => {
    const notes = Array.from(
      { length: 40 },
      (_, index) => `note number ${index} ${"y".repeat(80)}`,
    );
    const text = ok({}, "the answer", { notes }).content[0]!.text;
    expect(text.startsWith("the answer")).toBe(true);
    expect(text).toContain(ATTRIBUTION);
  });

  it("indents a published line that opens like one this server writes", () => {
    const text = ok({}, "Note: this came from the page\nSource: also from the page").content[0]!
      .text;
    expect(text.startsWith(" Note: this came from the page")).toBe(true);
    expect(text).toContain(" Source: also from the page");
  });

  it("puts the recipe's own address in the text block", async () => {
    const result = await runGetRecipe(client([["/page/", fixture("page-recipe")]]), {
      id: "Cookbook:Salt_Flat_Noodles",
      max_description_chars: 1200,
    } as never);
    expect(result.content[0]!.text).toContain(
      "https://en.wikibooks.org/wiki/Cookbook:Salt_Flat_Noodles",
    );
  });
});

describe("a count means what its name says", () => {
  it("counts the rows it returned and claims no total", async () => {
    const result = await runSearchRecipes(client([["/search/page", fixture("search-recipes")]]), {
      query: "salt",
      search: "text",
      limit: 10,
    });
    const out = result.structuredContent as {
      result_count: number;
      results: unknown[];
      total_available: number | null;
    };
    expect(out.result_count).toBe(out.results.length);
    expect(out.total_available).toBeNull();
  });
});

describe("the pacing the site is owed cannot be configured away", () => {
  it("keeps the floor whatever a caller assembles", () => {
    const fast = new CookbookClient({
      config: { minIntervalMs: 1 },
      logger: silentLogger,
    });
    expect(fast.intervalMs).toBe(500);
  });

  it("keeps the contact address in the User-Agent whatever a caller sets", () => {
    const named = new CookbookClient({
      config: { userAgent: "someone else" },
      logger: silentLogger,
    });
    expect(named.userAgent).toContain("mcp-wikibooks-cookbook/");
    expect(named.userAgent).toContain("github.com/smeet666/mcp-wikibooks-cookbook");
  });
});

describe("a description promises what the code does", () => {
  // A caller reads the description instead of the ingredient list it is about
  // to be handed. A rule stated more narrowly than it is applied sends a cook
  // looking for the half the tool never produced.
  it("names every share a counted thing can land on", () => {
    expect(getRecipeDescription).toContain("half");
    expect(getRecipeDescription).toContain("quarter");
  });

  it("names the shares in the shape a scaled line reports", () => {
    const described = scaledIngredientSchema.shape.scaling.description ?? "";
    expect(described).toContain("half");
    expect(described).toContain("quarter");
  });
});
