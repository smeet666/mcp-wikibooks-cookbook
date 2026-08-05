/**
 * A rescale with nothing to rescale.
 *
 * The multiplication note and `yield.factor` describe what happened to a list of
 * quantities. When no quantity could be read off the page, there is no such
 * list, and an answer that still announces a factor states a thing it did not
 * do while the ingredients it returns are empty.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRecipeInput, runGetRecipe } from "../../src/tools/getRecipe.js";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { silentLogger } from "./helpers.js";
import { gatewayFetch, structuredOf, textOf } from "./spec.helpers.js";

const AMPLE_MS = 300_000;

/** A page that states a yield in its box and lays out no list this server reads. */
const NO_LIST = {
  id: 1,
  key: "Cookbook:Boxed_Yield_No_List",
  title: "Cookbook:Boxed Yield No List",
  latest: { id: 1, timestamp: "2026-01-01T00:00:00Z" },
  content_model: "wikitext",
  source: [
    "{{recipesummary|category=Custard recipes|servings=8|difficulty=4}}",
    "",
    "A custard the page describes in prose.",
    "",
    "==Procedure==",
    "# Whisk, bake, chill.",
  ].join("\n"),
};

async function read(servings: number): Promise<Record<string, unknown>> {
  const { fetchImpl } = gatewayFetch({ page: NO_LIST });
  const client = new CookbookClient({
    fetchImpl,
    logger: silentLogger,
    config: { maxRetries: 1 } as never,
  });
  const pending = runGetRecipe(
    client,
    getRecipeInput.parse({ id: "Cookbook:Boxed_Yield_No_List", servings }),
  );
  const held = pending.catch(() => undefined);
  await vi.advanceTimersByTimeAsync(AMPLE_MS);
  await held;
  const result = await pending;
  return { structured: structuredOf(result), text: textOf(result) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("get_recipe on a page that yields no quantities", () => {
  it("announces no multiplication", async () => {
    const { structured } = (await read(53)) as { structured: Record<string, unknown> };
    const notes = (structured.notes as string[]).join(" ");
    expect(structured.ingredients).toEqual([]);
    expect(notes).not.toMatch(/multiplied by/i);
  });

  it("leaves the factor at one, which is what was applied", async () => {
    const { structured } = (await read(53)) as { structured: Record<string, unknown> };
    expect((structured.yield as Record<string, unknown>).factor).toBe(1);
  });

  it("says the page delivered no quantities, and repeats what was asked for", async () => {
    const { structured } = (await read(53)) as { structured: Record<string, unknown> };
    const notes = (structured.notes as string[]).join(" ");
    expect(notes).toMatch(/no quantit/i);
    expect(notes).toContain("53");
    expect((structured.yield as Record<string, unknown>).requested).toBe(53);
  });

  it("keeps the same claim in the text a thin client renders", async () => {
    const { text } = (await read(53)) as { text: string };
    expect(text).not.toMatch(/multiplied by/i);
  });
});
