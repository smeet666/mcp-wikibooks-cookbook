import { describe, expect, it } from "vitest";
import { CookbookError } from "../../src/errors.js";
import {
  parseMinutes,
  readNutrition,
  readYieldCount,
  toRecipePage,
} from "../../src/wikibooks/parse.js";
import { capture, fixture } from "./helpers.js";

const URL = "https://api.wikimedia.org/core/v1/wikibooks/en/page/x";

describe("toRecipePage", () => {
  const page = toRecipePage(fixture("page-recipe"), URL);

  it("reads what the recipe box states", () => {
    expect(page.category).toBe("Noodle recipes");
    expect(page.servings).toBe(6);
    expect(page.yieldText).toBe("6");
    expect(page.yieldUnit).toBeNull();
    expect(page.timeText).toBe("1 hour 10 minutes");
    expect(page.totalMinutes).toBe(70);
    expect(page.difficulty).toBe(2);
    expect(page.energy).toBe("410Calories/1715 kJ");
  });

  it("carries the licence the gateway returned", () => {
    expect(page.license).toEqual({
      title: "Creative Commons Attribution-Share Alike 4.0",
      url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
    });
    expect(page.revisedAt).toBe("2026-06-13T15:19:00Z");
  });

  it("flattens the ingredient lines to what a reader sees", () => {
    expect(page.ingredients[0]).toBe("450 g (1 pound) flat noodles");
    expect(page.ingredients[2]).toBe("5 egg yolks");
    expect(page.ingredients).toHaveLength(8);
  });

  it("reads equipment, procedure and tips from their own headings", () => {
    expect(page.equipment).toEqual(["Large pot", "Wide skillet", "Fork"]);
    expect(page.steps).toHaveLength(4);
    expect(page.steps[0]).toBe(
      "Bring a big pot of water to a boil and salt it once it begins to simmer.",
    );
    expect(page.tips).toEqual([
      "Late fruit makes this sweeter; hold back a spoon of the butter if it is very ripe.",
    ]);
  });

  it("takes the opening prose as the description, without its citations", () => {
    expect(page.description).toBe(
      "Salt flat noodles are a dish of the orchard country, built on lamp oil and late fruit.",
    );
  });

  it("lists each category once and names every heading the page carries", () => {
    expect(page.categories).toEqual([
      "Salt Flat recipes",
      "Recipes using noodles",
      "Recipes with metric units",
    ]);
    expect(page.sectionTitles).toContain("See also");
  });

  it("returns null for a nutrition panel the page does not carry", () => {
    expect(page.nutrition).toBeNull();
  });

  it("says a page carries no wikitext rather than returning an empty recipe", () => {
    const outcome = capture(() => toRecipePage(fixture("page-no-source"), URL));
    expect(outcome.threw).toBe(true);
    expect((outcome.error as CookbookError).code).toBe("parse_failure");
  });

  it("returns empty lists for a page in the Cookbook that is not a recipe", () => {
    const reference = toRecipePage(fixture("page-reference"), URL);
    expect(reference.ingredients).toEqual([]);
    expect(reference.steps).toEqual([]);
    expect(reference.servings).toBeNull();
    expect(reference.totalMinutes).toBeNull();
    expect(reference.difficulty).toBeNull();
  });
});

describe("a yield counted in objects", () => {
  const page = toRecipePage(fixture("page-yield-in-objects"), URL);

  it("keeps both the number and what it counts", () => {
    expect(page.servings).toBe(24);
    expect(page.yieldText).toBe("24 balls");
    expect(page.yieldUnit).toBe("balls");
  });

  it("repeats the nutrition panel as published, positions and all", () => {
    expect(page.nutrition).toEqual({
      servingSize: "1 ball (47 g)",
      servings: "24",
      calories: "207",
      caloriesFromFat: "94",
      totalFat: "10.4 g",
      saturatedFat: "7.5 g",
      cholesterol: "20 mg",
      sodium: "92 mg",
      carbohydrates: "26.2 g",
      fiber: "1.0 g",
      sugars: "12.9 g",
      protein: "2.2 g",
      vitaminA: "3%",
      vitaminC: "2%",
      calcium: "3%",
      iron: "4%",
    });
  });
});

describe("a yield given as a range", () => {
  const page = toRecipePage(fixture("page-yield-range"), URL);

  it("keeps the published wording and refuses to pick an end of it", () => {
    expect(page.yieldText).toBe("4 to 6");
    expect(page.servings).toBeNull();
  });

  it("leaves an empty time and an empty difficulty null rather than zero", () => {
    expect(page.timeText).toBeNull();
    expect(page.totalMinutes).toBeNull();
    expect(page.difficulty).toBeNull();
  });
});

describe("readYieldCount", () => {
  it("reads a bare number as servings", () => {
    expect(readYieldCount("6")).toEqual({ count: 6, unit: null });
  });

  it("keeps the word a yield counts when it is not servings", () => {
    expect(readYieldCount("24 balls")).toEqual({ count: 24, unit: "balls" });
  });

  it("says nothing extra when the wording already means servings", () => {
    expect(readYieldCount("4 servings")).toEqual({ count: 4, unit: null });
  });

  it("gives no count for a range, which has no single number", () => {
    expect(readYieldCount("4 to 6")).toEqual({ count: null, unit: null });
    expect(readYieldCount("4–6 people")).toEqual({ count: null, unit: null });
  });

  it("gives no count for wording that carries no number", () => {
    expect(readYieldCount("varies")).toEqual({ count: null, unit: null });
    expect(readYieldCount(null)).toEqual({ count: null, unit: null });
  });
});

describe("parseMinutes", () => {
  it("reads hours and minutes together", () => {
    expect(parseMinutes("1 hour 10 minutes")).toBe(70);
    expect(parseMinutes("20 minutes")).toBe(20);
    expect(parseMinutes("2 hrs")).toBe(120);
    expect(parseMinutes("1 day")).toBe(1440);
  });

  it("reads a half hour written as a glyph", () => {
    expect(parseMinutes("1 ½ hours")).toBe(90);
  });

  it("returns null when the wording carries no duration", () => {
    expect(parseMinutes("overnight")).toBeNull();
    expect(parseMinutes("")).toBeNull();
    expect(parseMinutes(null)).toBeNull();
  });
});

describe("readNutrition", () => {
  it("returns null for a panel called with nothing in it", () => {
    expect(readNutrition("{{nutritionsummary}}")).toBeNull();
  });

  it("prefers a named argument over the position it also fills", () => {
    const facts = readNutrition("{{nutritionsummary|Cals=250|ServingSize=1 slice}}")!;
    expect(facts.calories).toBe("250");
    expect(facts.servingSize).toBe("1 slice");
    expect(facts.iron).toBeNull();
  });
});
