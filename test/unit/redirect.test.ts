/**
 * Following a redirect, and saying that one was followed.
 *
 * A redirect page carries a pointer and no recipe. Reading it as a recipe
 * produces a page with a title, no ingredients and no steps, which is the shape
 * of a dish the Cookbook does not hold: the answer would be an absence the wiki
 * never stated. The pointer is followed to the page a reader would land on, and
 * the hop is named so the caller knows which page was read.
 *
 * The clock is fake and pinned, so the pacing between hops costs no real time.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookbookError } from "../../src/errors.js";
import { getRecipeInput, runGetRecipe } from "../../src/tools/getRecipe.js";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { captureAsync, fixture, settle, silentLogger } from "./helpers.js";

const EPOCH = new Date("2026-01-01T00:00:00.000Z");
const AMPLE_MS = 300_000;

const LICENCE = {
  url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
  title: "Creative Commons Attribution-Share Alike 4.0",
};

/**
 * A redirect as the gateway sends one: the pointer in the wikitext, and the
 * address of the page it points at alongside it.
 */
function redirectDocument(key: string, target: string, options: { path?: boolean } = {}): unknown {
  return {
    id: 1,
    key,
    title: key.replace(/_/g, " "),
    latest: { id: 1, timestamp: "2026-01-01T00:00:00Z" },
    content_model: "wikitext",
    license: LICENCE,
    source: `#REDIRECT [[${target.replace(/_/g, " ")}]]`,
    ...(options.path === false
      ? {}
      : { redirect_target: `/w/rest.php/v1/page/${encodeURIComponent(target)}?redirect=no` }),
  };
}

/** Answers each page request from a table keyed by the page key it asks for. */
function clientFor(pages: Record<string, unknown>): { client: CookbookClient; urls: string[] } {
  const urls: string[] = [];
  const fetchImpl = (async (input: unknown) => {
    const url = String(input);
    urls.push(url);
    const hit = Object.entries(pages).find(([key]) => url.endsWith(encodeURIComponent(key)));
    return new Response(JSON.stringify(hit ? hit[1] : {}), {
      status: hit ? 200 : 404,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  return {
    urls,
    client: new CookbookClient({
      fetchImpl,
      logger: silentLogger,
      config: { maxRetries: 0 },
    }),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(EPOCH);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a page that redirects", () => {
  const pages = {
    "Cookbook:Salt_Noodles": redirectDocument(
      "Cookbook:Salt_Noodles",
      "Cookbook:Salt_Flat_Noodles",
    ),
    "Cookbook:Salt_Flat_Noodles": fixture("page-recipe"),
  };

  it("reads the page the redirect points at", async () => {
    const { client } = clientFor(pages);
    const { data } = await settle(client.getRecipe("Cookbook:Salt_Noodles"), AMPLE_MS);

    expect(data.key).toBe("Cookbook:Salt_Flat_Noodles");
    expect(data.ingredients.length).toBeGreaterThan(0);
    expect(data.steps.length).toBeGreaterThan(0);
  });

  it("names the page it was sent from, so the caller sees the hop", async () => {
    const { client } = clientFor(pages);
    const { data } = await settle(client.getRecipe("Cookbook:Salt_Noodles"), AMPLE_MS);

    expect(data.redirectedFrom).toEqual(["Cookbook:Salt_Noodles"]);
  });

  it("follows a pointer the gateway sends without an address of its own", async () => {
    const { client } = clientFor({
      "Cookbook:Salt_Noodles": redirectDocument(
        "Cookbook:Salt_Noodles",
        "Cookbook:Salt_Flat_Noodles",
        { path: false },
      ),
      "Cookbook:Salt_Flat_Noodles": fixture("page-recipe"),
    });
    const { data } = await settle(client.getRecipe("Cookbook:Salt_Noodles"), AMPLE_MS);

    expect(data.key).toBe("Cookbook:Salt_Flat_Noodles");
  });

  it("leaves the list empty for a page that is not a redirect", async () => {
    const { client } = clientFor({ "Cookbook:Salt_Flat_Noodles": fixture("page-recipe") });
    const { data } = await settle(client.getRecipe("Cookbook:Salt_Flat_Noodles"), AMPLE_MS);

    expect(data.redirectedFrom).toEqual([]);
  });

  it("walks a chain of two before it reaches the recipe", async () => {
    const { client } = clientFor({
      "Cookbook:Carbonara_Sauce": redirectDocument(
        "Cookbook:Carbonara_Sauce",
        "Cookbook:Salt_Noodles",
      ),
      ...pages,
    });
    const { data } = await settle(client.getRecipe("Cookbook:Carbonara_Sauce"), AMPLE_MS);

    expect(data.key).toBe("Cookbook:Salt_Flat_Noodles");
    expect(data.redirectedFrom).toEqual(["Cookbook:Carbonara_Sauce", "Cookbook:Salt_Noodles"]);
  });
});

describe("a chain that reaches no recipe", () => {
  it("refuses a loop rather than returning the shell it ends on", async () => {
    const { client } = clientFor({
      "Cookbook:Loop_A": redirectDocument("Cookbook:Loop_A", "Cookbook:Loop_B"),
      "Cookbook:Loop_B": redirectDocument("Cookbook:Loop_B", "Cookbook:Loop_A"),
    });
    const outcome = await captureAsync(() => settle(client.getRecipe("Cookbook:Loop_A"), AMPLE_MS));

    expect(outcome.threw).toBe(true);
    const error = outcome.error as CookbookError;
    expect(error).toBeInstanceOf(CookbookError);
    expect(error.code).toBe("parse_failure");
    expect(error.message).toContain("Cookbook:Loop_A");
    expect(error.message).toContain("Cookbook:Loop_B");
  });

  it("stops a chain that keeps going, naming where it stopped", async () => {
    const pages: Record<string, unknown> = {};
    for (let step = 0; step < 12; step += 1) {
      pages[`Cookbook:Hop_${step}`] = redirectDocument(
        `Cookbook:Hop_${step}`,
        `Cookbook:Hop_${step + 1}`,
      );
    }
    const { client, urls } = clientFor(pages);
    const outcome = await captureAsync(() => settle(client.getRecipe("Cookbook:Hop_0"), AMPLE_MS));

    expect(outcome.threw).toBe(true);
    const error = outcome.error as CookbookError;
    expect(error.code).toBe("parse_failure");
    expect(error.message).toMatch(/Cookbook:Hop_\d/);
    // A chain is walked a few hops and no further, so a page pointing at a page
    // pointing at a page cannot spend the caller's whole request budget.
    expect(urls.length).toBeLessThanOrEqual(5);
  });

  // The count and the list are the same fact stated twice, and a caller
  // counting the addresses reads the difference as an address kept back.
  it("counts as many hops as it names addresses", async () => {
    const pages: Record<string, unknown> = {};
    for (let step = 0; step < 12; step += 1) {
      pages[`Cookbook:Hop_${step}`] = redirectDocument(
        `Cookbook:Hop_${step}`,
        `Cookbook:Hop_${step + 1}`,
      );
    }
    const { client } = clientFor(pages);
    const outcome = await captureAsync(() => settle(client.getRecipe("Cookbook:Hop_0"), AMPLE_MS));

    const message = (outcome.error as CookbookError).message;
    const claimed = Number(/followed (\d+) times/.exec(message)?.[1]);
    const listed = message.slice(message.indexOf("addresses walked were")).split("→").length;
    expect(claimed).toBe(listed);
  });
});

describe("get_recipe on a redirect", () => {
  async function read(id: string, served: Record<string, unknown>) {
    const { client } = clientFor(served);
    const result = await settle(runGetRecipe(client, getRecipeInput.parse({ id })), AMPLE_MS);
    return {
      structured: result.structuredContent as Record<string, unknown>,
      text: (result.content[0]?.text ?? "") as string,
    };
  }

  const pages = {
    "Cookbook:Salt_Noodles": redirectDocument(
      "Cookbook:Salt_Noodles",
      "Cookbook:Salt_Flat_Noodles",
    ),
    "Cookbook:Salt_Flat_Noodles": fixture("page-recipe"),
  };

  it("answers with the page it landed on, and says which one that was", async () => {
    const { structured, text } = await read("Cookbook:Salt_Noodles", pages);

    expect(structured.id).toBe("Cookbook:Salt_Flat_Noodles");
    expect(structured.redirected_from).toEqual(["Cookbook:Salt_Noodles"]);
    expect((structured.ingredients as unknown[]).length).toBeGreaterThan(0);

    const notes = structured.notes as string[];
    const hop = notes.find((note) => note.includes("redirect"));
    expect(hop).toBeDefined();
    expect(hop).toContain("Cookbook:Salt_Noodles");
    expect(hop).toContain("Cookbook:Salt_Flat_Noodles");
    expect(text).toContain("Cookbook:Salt_Noodles");
  });

  it("says nothing about redirects when none was followed", async () => {
    const { structured } = await read("Cookbook:Salt_Flat_Noodles", pages);

    expect(structured.redirected_from).toEqual([]);
    expect((structured.notes as string[]).some((note) => note.includes("redirect"))).toBe(false);
  });
});
