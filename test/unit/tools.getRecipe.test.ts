import { describe, expect, it } from "vitest";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { runGetRecipe } from "../../src/tools/getRecipe.js";
import { fixture, routedFetch, silentLogger } from "./helpers.js";

interface RecipeOut {
  id: string;
  title: string;
  url: string;
  yield: {
    original_count: number | null;
    original_text: string | null;
    requested: number | null;
    unit: string | null;
    factor: number;
  };
  ingredients: Array<{
    text: string;
    original: string;
    scaling: string;
    amount: number | null;
    amount_max: number | null;
    unit: string | null;
    note?: string;
    group: string | null;
  }>;
  steps: string[];
  equipment: string[];
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  category: string | null;
  author: string | null;
  rating: number | null;
  nutrition: Record<string, string | null> | null;
  attribution: string;
  license: { title: string; url: string } | null;
  source: string;
  notes: string[];
}

function client(page: string) {
  const { fetchImpl, calls } = routedFetch([["/page/", fixture(page)]]);
  return {
    calls,
    client: new CookbookClient({
      config: { cacheTtlMs: 0, minIntervalMs: 500, maxRetries: 0 },
      logger: silentLogger,
      fetchImpl,
    }),
  };
}

async function read(page: string, args: Record<string, unknown> = {}) {
  const { client: wikibooks } = client(page);
  const result = await runGetRecipe(wikibooks, {
    id: "Cookbook:Salt_Flat_Noodles",
    max_description_chars: 1200,
    ...args,
  } as never);
  return { result, out: result.structuredContent as unknown as RecipeOut };
}

describe("get_recipe, as published", () => {
  it("returns the page under the names a caller can rely on", async () => {
    const { out } = await read("page-recipe");
    expect(out.id).toBe("Cookbook:Salt_Flat_Noodles");
    expect(out.url).toBe("https://en.wikibooks.org/wiki/Cookbook:Salt_Flat_Noodles");
    expect(out.category).toBe("Noodle recipes");
    expect(out.total_minutes).toBe(70);
    expect(out.steps).toHaveLength(4);
    expect(out.equipment).toEqual(["Large pot", "Wide skillet", "Fork"]);
    expect(out.source).toBe("Wikibooks Cookbook");
  });

  it("states a yield as published and a factor of one when nothing was asked", async () => {
    const { out } = await read("page-recipe");
    expect(out.yield).toEqual({
      original_count: 6,
      original_text: "6",
      requested: null,
      unit: null,
      factor: 1,
    });
  });

  it("leaves the quantities exactly as the page wrote them", async () => {
    const { out } = await read("page-recipe");
    expect(out.ingredients[0]!.text).toBe("450 g (1 pound) flat noodles");
    expect(out.ingredients[0]!.original).toBe("450 g (1 pound) flat noodles");
  });

  it("carries the licence to name alongside the attribution", async () => {
    const { out } = await read("page-recipe");
    expect(out.attribution).toBe("Wikibooks Cookbook contributors");
    expect(out.license).toEqual({
      title: "Creative Commons Attribution-Share Alike 4.0",
      url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    });
  });

  it("gives null for what the Cookbook does not publish, rather than a placeholder", async () => {
    const { out } = await read("page-recipe");
    expect(out.author).toBeNull();
    expect(out.rating).toBeNull();
    expect(out.prep_minutes).toBeNull();
    expect(out.cook_minutes).toBeNull();
    expect(out.nutrition).toBeNull();
  });

  it("finds a page from a plain dish name by adding the namespace", async () => {
    const { client: wikibooks, calls } = client("page-recipe");
    await runGetRecipe(wikibooks, {
      id: "Salt Flat Noodles",
      max_description_chars: 1200,
    } as never);
    expect(decodeURIComponent(calls[0]!.url)).toContain("/page/Cookbook:Salt_Flat_Noodles");
  });
});

describe("get_recipe, rescaled from six to four", () => {
  it("multiplies by two thirds and says so", async () => {
    const { out } = await read("page-recipe", { servings: 4 });
    expect(out.yield.requested).toBe(4);
    expect(out.yield.factor).toBe(0.667);
    expect(out.notes.some((note) => note.includes("from 6 to 4 servings"))).toBe(true);
  });

  it("never returns a fraction of an egg", async () => {
    const { out } = await read("page-recipe", { servings: 4 });
    const yolks = out.ingredients.find((entry) => entry.text.includes("egg yolk"))!;
    expect(yolks.text).toBe("3 egg yolks");
    expect(yolks.scaling).toBe("rounded");
  });

  it("scales the bracketed equivalent with the amount it restates", async () => {
    const { out } = await read("page-recipe", { servings: 4 });
    expect(out.ingredients[0]!.text).toBe("300 g (11 ounces) flat noodles");
  });

  it("scales both ends of a range and keeps them in one unit", async () => {
    const { out } = await read("page-recipe", { servings: 4 });
    const butter = out.ingredients[1]!;
    expect(butter.amount).toBe(150);
    expect(butter.amount_max).toBe(335);
    expect(butter.unit).toBe("g");
  });

  // The pinch used to be counted here as a line left alone. It carries a
  // quantity and is scaled with the rest; "Salt" carries none and is the only
  // line the answer returns as published.
  it("leaves a line with no quantity alone, and flags it", async () => {
    const { out } = await read("page-recipe", { servings: 4 });
    const untouched = out.ingredients.filter((entry) => entry.scaling === "unscaled");
    expect(untouched.map((entry) => entry.text)).toEqual(["Salt"]);
    expect(out.notes.some((note) => note.includes("no quantity that can be multiplied"))).toBe(
      true,
    );
  });
});

describe("get_recipe, rescaled from six to ten", () => {
  it("multiplies by five thirds", async () => {
    const { out } = await read("page-recipe", { servings: 10 });
    expect(out.yield.factor).toBe(1.67);
    expect(out.ingredients[0]!.amount).toBe(750);
    expect(out.ingredients[0]!.unit).toBe("g");
  });

  it("rounds a count up rather than asking for a third of an egg", async () => {
    const { out } = await read("page-recipe", { servings: 10 });
    const yolks = out.ingredients.find((entry) => entry.text.includes("egg yolk"))!;
    expect(yolks.text).toBe("8 egg yolks");
    expect(yolks.note).toContain("Rounded down from");
  });

  it("keeps 'original_text' saying what the page said", async () => {
    const { out } = await read("page-recipe", { servings: 10 });
    expect(out.yield.original_text).toBe("6");
    expect(out.yield.original_count).toBe(6);
  });
});

describe("get_recipe, a yield counted in objects", () => {
  it("names what the yield counts and scales against it", async () => {
    const { client: wikibooks } = client("page-yield-in-objects");
    const result = await runGetRecipe(wikibooks, {
      id: "Cookbook:Orchard_Balls",
      servings: 12,
      max_description_chars: 1200,
    } as never);
    const out = result.structuredContent as unknown as RecipeOut;

    expect(out.yield.unit).toBe("balls");
    expect(out.yield.original_text).toBe("24 balls");
    expect(out.yield.factor).toBe(0.5);
    expect(out.notes.some((note) => note.includes("from 24 to 12 balls"))).toBe(true);
  });

  it("repeats the nutrition panel as published", async () => {
    const { client: wikibooks } = client("page-yield-in-objects");
    const result = await runGetRecipe(wikibooks, {
      id: "Cookbook:Orchard_Balls",
      max_description_chars: 1200,
    } as never);
    const out = result.structuredContent as unknown as RecipeOut;

    expect(out.nutrition).toMatchObject({ serving_size: "1 ball (47 g)", calories: "207" });
  });
});

describe("get_recipe, a yield with nothing to scale from", () => {
  it("returns the quantities as published and says why", async () => {
    const { client: wikibooks } = client("page-yield-range");
    const result = await runGetRecipe(wikibooks, {
      id: "Cookbook:Flat_Bread",
      servings: 12,
      max_description_chars: 1200,
    } as never);
    const out = result.structuredContent as unknown as RecipeOut;

    expect(out.yield.original_text).toBe("4 to 6");
    expect(out.yield.original_count).toBeNull();
    expect(out.yield.factor).toBe(1);
    expect(out.ingredients[0]!.text).toBe("250 g hard flour");
    expect(out.notes.some((note) => note.includes("not a single number to scale from"))).toBe(true);
  });
});

describe("get_recipe, a page that is not a recipe", () => {
  it("returns empty lists and says the page may not be a recipe", async () => {
    const { client: wikibooks } = client("page-reference");
    const result = await runGetRecipe(wikibooks, {
      id: "Cookbook:Lamp_Oil",
      max_description_chars: 1200,
    } as never);
    const out = result.structuredContent as unknown as RecipeOut;

    expect(out.ingredients).toEqual([]);
    expect(out.steps).toEqual([]);
    expect(result.isError).toBeUndefined();
    expect(out.notes.some((note) => note.includes("carries no recipe"))).toBe(true);
  });
});

describe("get_recipe, the text block", () => {
  it("ends with the notes and the address, which a text-only client needs", async () => {
    const { result } = await read("page-recipe", { servings: 4 });
    const text = result.content[0]!.text;
    expect(text).toContain("Note: ");
    expect(
      text.trimEnd().endsWith("https://en.wikibooks.org/wiki/Cookbook:Salt_Flat_Noodles"),
    ).toBe(true);
  });

  it("marks a line the scaler left alone", async () => {
    const { result } = await read("page-recipe", { servings: 4 });
    expect(result.content[0]!.text).toContain("Salt (not adjusted)");
  });
});

describe("get_recipe, ingredients a page groups by what they are for", () => {
  it("carries the group each line sits under", async () => {
    const { out } = await read("page-grouped-ingredients", { id: "Cookbook:Orchard_Layer_Cake" });
    expect(out.ingredients.map((line) => line.group)).toEqual([
      "Cake",
      "Cake",
      "Cake",
      "Soak",
      "Soak",
      "Glaze",
      "Glaze",
    ]);
  });

  it("keeps a line published twice, because two parts each call for it", async () => {
    const { out } = await read("page-grouped-ingredients", { id: "Cookbook:Orchard_Layer_Cake" });
    const syrup = out.ingredients.filter((line) => line.original.includes("lamp syrup"));
    expect(syrup.map((line) => line.group)).toEqual(["Soak", "Glaze"]);
  });

  it("prints the groups in the text block, so the duplicate lines make sense", async () => {
    const { result } = await read("page-grouped-ingredients", {
      id: "Cookbook:Orchard_Layer_Cake",
    });
    const text = result.content[0]!.text;
    expect(text).toContain("Ingredients:");
    expect(text).toContain("Soak:");
    expect(text).toContain("Glaze:");
  });

  it("states null for a group on a page that lists its ingredients flat", async () => {
    const { out } = await read("page-recipe");
    expect(out.ingredients.every((line) => line.group === null)).toBe(true);
  });
});
