/**
 * search_recipes and list_recipes against the contract.
 *
 * The two claims under test are the ones the author flagged: the gateway
 * publishes neither a total nor a second page, and list_recipes is a search
 * wearing a category's clothes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listRecipesInput,
  listRecipesOutput,
  runListRecipes,
} from "../../src/tools/listRecipes.js";
import {
  runSearchRecipes,
  searchRecipesInput,
  searchRecipesOutput,
} from "../../src/tools/searchRecipes.js";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { silentLogger } from "./helpers.js";
import { gatewayFetch, readFixture, structuredOf, textOf } from "./spec.helpers.js";

const EPOCH = new Date("2026-01-01T00:00:00.000Z");
const AMPLE_MS = 300_000;

interface Ran {
  structured: Record<string, unknown>;
  text: string;
  isError: boolean;
  urls: string[];
}

async function run(
  tool: "search" | "list",
  args: Record<string, unknown>,
  fixtureName: string,
  status = 200,
): Promise<Ran> {
  const { fetchImpl, urls } = gatewayFetch({ search: readFixture(fixtureName), status });
  const client = new CookbookClient({
    fetchImpl,
    logger: silentLogger,
    config: { maxRetries: 1 } as never,
  });
  const pending =
    tool === "search"
      ? runSearchRecipes(client, searchRecipesInput.parse(args))
      : runListRecipes(client, listRecipesInput.parse(args));
  const held = pending.catch(() => undefined);
  await vi.advanceTimersByTimeAsync(AMPLE_MS);
  await held;
  const result = await pending;
  if (result.isError) {
    return { structured: {}, text: textOf(result), isError: true, urls };
  }
  return { structured: structuredOf(result), text: textOf(result), isError: false, urls };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(EPOCH);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the envelope search_recipes returns", () => {
  it("carries the fields the recipe contract names", async () => {
    const { structured } = await run("search", { query: "salt" }, "search-recipes");
    expect(Object.keys(structured).sort()).toEqual([
      "notes",
      "query",
      "result_count",
      "results",
      "source",
      "total_available",
    ]);
    expect(() => searchRecipesOutput.parse(structured)).not.toThrow();
  });

  it("gives every row an id a caller can take back, and a link", async () => {
    const { structured } = await run("search", { query: "salt" }, "search-recipes");
    for (const row of structured.results as Record<string, unknown>[]) {
      expect(typeof row.id).toBe("string");
      expect((row.id as string).length).toBeGreaterThan(0);
      expect(row.url).toMatch(/^https:\/\//);
      expect(row).toHaveProperty("image_url");
      expect(row).toHaveProperty("title");
    }
  });

  it("honours the limit it was given", async () => {
    const { structured } = await run("search", { query: "salt", limit: 2 }, "search-recipes");
    expect((structured.results as unknown[]).length).toBeLessThanOrEqual(2);
    expect(structured.result_count).toBe((structured.results as unknown[]).length);
  });
});

describe("no number is presented as a total", () => {
  it("reports total_available as null", async () => {
    const { structured } = await run("search", { query: "salt" }, "search-recipes");
    expect(structured.total_available).toBeNull();
  });

  it("counts only the rows it returned", async () => {
    const { structured } = await run("search", { query: "salt" }, "search-recipes");
    expect(structured.result_count).toBe((structured.results as unknown[]).length);
  });

  it("never uses the word total in the text a client renders", async () => {
    const { text } = await run("search", { query: "salt" }, "search-recipes");
    expect(text).not.toMatch(/\btotal\b/i);
    expect(text).not.toMatch(/\bof \d+ (results|pages|recipes)\b/i);
    expect(text).not.toMatch(/\ball \d+\b/i);
  });

  it("does not describe the returned rows as everything the Cookbook holds", async () => {
    const { text } = await run("search", { query: "salt" }, "search-recipes");
    expect(text).not.toMatch(/only \d+ (recipes|pages)/i);
    expect(text).not.toMatch(/\bthere are \d+\b/i);
  });
});

describe("what was dropped is said", () => {
  it("counts the rows that belong to another book", async () => {
    const { structured } = await run("search", { query: "salt" }, "search-recipes");
    const notes = (structured.notes as string[]).join(" ");
    expect(notes).toMatch(/belong to other books/i);
  });

  it("counts the rows it could not read", async () => {
    const { structured } = await run("search", { query: "salt" }, "search-recipes");
    const notes = (structured.notes as string[]).join(" ");
    expect(notes).toMatch(/could not read/i);
  });

  it("warns that a row may be a reference page rather than a recipe", async () => {
    const { structured } = await run("search", { query: "salt" }, "search-recipes");
    expect((structured.notes as string[]).join(" ")).toMatch(/reference page|get_recipe/i);
  });

  it("puts its notes in the text block", async () => {
    const { structured, text } = await run("search", { query: "salt" }, "search-recipes");
    const rendered = (structured.notes as string[]).filter((note) => text.includes(note));
    expect(rendered.length).toBeGreaterThan(0);
    for (const note of rendered) {
      expect(text).toContain(`Note: ${note}`);
    }
    expect(text.trimEnd().split("\n").pop()).toMatch(/^Source: Wikibooks Cookbook/);
  });
});

describe("an absence is an absence and a failure is a failure", () => {
  it("returns no rows, and no error, when the Cookbook holds nothing", async () => {
    const { structured, isError } = await run("search", { query: "zzz" }, "search-empty");
    expect(isError).toBe(false);
    expect(structured.results).toEqual([]);
    expect(structured.result_count).toBe(0);
    expect((structured.notes as string[]).join(" ")).toMatch(/nothing in the cookbook/i);
  });

  it("reports an answer it cannot read as parse_failure rather than as nothing found", async () => {
    const { text, isError } = await run("search", { query: "salt" }, "search-no-pages");
    expect(isError).toBe(true);
    expect(text).toMatch(/parse_failure/);
    expect(text).not.toMatch(/nothing in the cookbook/i);
  });

  it("reports throttling as rate_limited, never as an empty result", async () => {
    const { text, isError } = await run("search", { query: "salt" }, "search-recipes", 429);
    expect(isError).toBe(true);
    expect(text).toMatch(/rate_limited/);
    expect(text).not.toMatch(/nothing in the cookbook/i);
  });

  it("refuses an empty query rather than answering it", async () => {
    const { text, isError } = await run("search", { query: "   " }, "search-recipes");
    expect(isError).toBe(true);
    expect(text).toMatch(/invalid_input/);
  });
});

describe("list_recipes does not claim to enumerate a category", () => {
  it("says the answer is a sample of a search", async () => {
    const { structured } = await run("list", { cuisine: "Italian" }, "search-recipes");
    const notes = (structured.notes as string[]).join(" ");
    expect(notes).toMatch(/sample/i);
    expect(notes).toMatch(/not the (contents of a )?category/i);
  });

  it("says its length proves nothing about how many recipes exist", async () => {
    const { structured } = await run("list", { cuisine: "Italian" }, "search-recipes");
    expect((structured.notes as string[]).join(" ")).toMatch(
      /more recipes.*exist|says nothing about how many/i,
    );
  });

  it("carries that caveat into the text block, not only the payload", async () => {
    const { text } = await run("list", { cuisine: "Italian" }, "search-recipes");
    expect(text).toMatch(/Note:.*sample/i);
  });

  it("reports total_available as null", async () => {
    const { structured } = await run("list", { dish_type: "soup" }, "search-recipes");
    expect(structured.total_available).toBeNull();
    expect(() => listRecipesOutput.parse(structured)).not.toThrow();
  });

  it("shows the query it built from the facets", async () => {
    const { structured } = await run(
      "list",
      { cuisine: "Thai", main_ingredient: "lentils" },
      "search-recipes",
    );
    expect(structured.query).toMatch(/Thai/);
    expect(structured.query).toMatch(/lentils/);
    expect(structured.cuisine).toBe("Thai");
    expect(structured.dish_type).toBeNull();
    expect(structured.main_ingredient).toBe("lentils");
  });

  it("refuses a call with no facet rather than listing the whole Cookbook", async () => {
    const { text, isError } = await run("list", {}, "search-recipes");
    expect(isError).toBe(true);
    expect(text).toMatch(/invalid_input/);
  });

  it("never uses the word total in the text a client renders", async () => {
    const { text } = await run("list", { cuisine: "Italian" }, "search-recipes");
    expect(text).not.toMatch(/\btotal\b/i);
  });
});

describe("the two searches read different indexes", () => {
  it("asks a different route for a title search", async () => {
    const byText = await run("search", { query: "salt", search: "text" }, "search-recipes");
    const byTitle = await run("search", { query: "salt", search: "title" }, "search-recipes");
    expect(byText.urls[0]).not.toBe(byTitle.urls[0]);
  });

  it("names the project identifier and a contact address on every request", async () => {
    const { fetchImpl } = gatewayFetch({ search: readFixture("search-recipes") });
    const calls: Record<string, unknown>[] = [];
    const spy = (async (input: unknown, init: RequestInit) => {
      calls.push((init?.headers ?? {}) as Record<string, unknown>);
      return fetchImpl(input as string, init);
    }) as unknown as typeof fetch;
    const client = new CookbookClient({ fetchImpl: spy, logger: silentLogger });
    const pending = runSearchRecipes(client, searchRecipesInput.parse({ query: "salt" }));
    const held = pending.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(AMPLE_MS);
    await held;
    await pending;
    const agent = String((calls[0]?.["User-Agent"] ?? calls[0]?.["user-agent"] ?? "") as string);
    expect(agent).toMatch(/mcp-wikibooks-cookbook/);
    expect(agent).toMatch(/github\.com\/smeet666\/mcp-wikibooks-cookbook/);
  });
});
