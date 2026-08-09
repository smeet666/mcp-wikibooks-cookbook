/**
 * What get_recipe owes a caller on the two claims a recipe box can overstate:
 * an ingredient list that is really several, and a time that is really several.
 *
 * Both are cases where the page publishes more than one thing under one name,
 * and where saying nothing turns them into one thing. Three alternative lists
 * read as one shopping list, and a run of phases read as one duration answers
 * with whichever phase happened to be last.
 */

import { describe, expect, it } from "vitest";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { runGetRecipe } from "../../src/tools/getRecipe.js";
import { fixture, routedFetch, silentLogger } from "./helpers.js";

interface Out {
  ingredients: Array<{ text: string; group: string | null; variant: string | null }>;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  time_text: string | null;
  time_phases: Array<{
    label: string | null;
    text: string;
    minutes: number | null;
    minutes_max: number | null;
  }>;
  notes: string[];
}

async function read(page: string, id: string, args: Record<string, unknown> = {}) {
  const { fetchImpl } = routedFetch([["/page/", fixture(page)]]);
  const client = new CookbookClient({
    config: { cacheTtlMs: 0, minIntervalMs: 500, maxRetries: 0 },
    logger: silentLogger,
    fetchImpl,
  });
  const result = await runGetRecipe(client, {
    id,
    max_description_chars: 1200,
    ...args,
  } as never);
  return { result, out: result.structuredContent as unknown as Out };
}

describe("get_recipe, a page publishing alternative ingredient lists", () => {
  it("says which alternative each line belongs to", async () => {
    const { out } = await read("page-alternative-lists", "Cookbook:Lamp_Fish_Salad");
    expect(out.ingredients.map((line) => line.variant)).toEqual([
      null,
      "Variation I",
      "Variation I",
      "Variation II",
      "Variation II",
      "Substitutions",
    ]);
  });

  it("warns that the lists replace one another", async () => {
    const { out } = await read("page-alternative-lists", "Cookbook:Lamp_Fish_Salad");
    const warning = out.notes.find((note) => note.includes("Variation I"));
    expect(warning).toBeDefined();
    expect(warning).toContain("Variation II");
    expect(warning).toContain("Substitutions");
    expect(warning).toMatch(/replace|instead of|one of them/i);
  });

  it("prints them apart in the text block, under a heading that says so", async () => {
    const { result } = await read("page-alternative-lists", "Cookbook:Lamp_Fish_Salad");
    const text = result.content[0]!.text;
    expect(text).toMatch(/Variation I:/);
    expect(text).toMatch(/Variation II:/);
    expect(text).toMatch(/alternative/i);
  });

  it("states null for a variant on a page publishing one list", async () => {
    const { out } = await read("page-recipe", "Cookbook:Salt_Flat_Noodles");
    expect(out.ingredients.every((line) => line.variant === null)).toBe(true);
  });
});

describe("get_recipe, a page stating its time in phases", () => {
  it("publishes each phase rather than one figure", async () => {
    const { out } = await read("page-phased-time", "Cookbook:Lamp_Oil_Flatbread");
    expect(out.time_phases).toEqual([
      { label: "Prep", text: "1 hour", minutes: 60, minutes_max: null },
      { label: "Cooking", text: "10 minutes", minutes: 10, minutes_max: null },
    ]);
    expect(out.prep_minutes).toBe(60);
    expect(out.cook_minutes).toBe(10);
  });

  it("claims no total the page never stated", async () => {
    const { out } = await read("page-phased-time", "Cookbook:Lamp_Oil_Flatbread");
    expect(out.total_minutes).toBeNull();
  });

  it("says why the total is null, and that the phases were not added", async () => {
    const { out } = await read("page-phased-time", "Cookbook:Lamp_Oil_Flatbread");
    const note = out.notes.find((entry) => entry.includes("phase"));
    expect(note).toBeDefined();
    expect(note).toMatch(/no total|states no total/i);
  });

  it("does not call a phased time unreadable", async () => {
    const { out } = await read("page-phased-time", "Cookbook:Lamp_Oil_Flatbread");
    expect(out.notes.some((note) => note.includes("not a number of minutes"))).toBe(false);
  });

  it("leaves a single stated duration as the total", async () => {
    const { out } = await read("page-recipe", "Cookbook:Salt_Flat_Noodles");
    expect(out.total_minutes).toBe(70);
    expect(out.prep_minutes).toBeNull();
    expect(out.cook_minutes).toBeNull();
  });
});
