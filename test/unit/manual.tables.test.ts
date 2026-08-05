/**
 * Ingredients laid out as a wiki table.
 *
 * The Cookbook writes many recipes as `{| class="wikitable"` with an Ingredient
 * column beside Count, Volume and Weight columns, and a reader of bullet lists
 * alone comes back from such a page with nothing. The documents below are built
 * here, and their layout mirrors what those pages carry: a heading row, a
 * quantity split across three columns of which one is filled, a row that labels
 * a component rather than naming one, a totals row, and a percentage column
 * that is a ratio rather than a quantity.
 */

import { describe, expect, it } from "vitest";
import { toRecipePage } from "../../src/wikibooks/parse.js";
import { parseTables } from "../../src/wikibooks/wikitext.js";

function pageDocument(source: string[]): unknown {
  return {
    id: 1,
    key: "Cookbook:Table_Dish",
    title: "Cookbook:Table Dish",
    latest: { id: 1, timestamp: "2026-01-01T00:00:00Z" },
    content_model: "wikitext",
    source: source.join("\n"),
  };
}

const TABLE_PAGE = pageDocument([
  "{{recipesummary|category=Custard recipes|servings=8|difficulty=4}}",
  "",
  "A custard baked in a water bath.",
  "",
  "==Ingredients==",
  ':{| class="wikitable" style="background: none"',
  "!Ingredient",
  "!Count",
  '!Volume<ref group="note">Weights taken from a household table.</ref>',
  "!Weight",
  "![[Cookbook:Baker's Percentage|Baker's %]]",
  "|-",
  "|[[Cookbook:Granulated Sugar|Granulated white sugar]]",
  "|",
  "|¾ [[Cookbook:Cup|cup]] (178 [[Cookbook:Milliliter|ml]])",
  "|",
  "|12%",
  "|-",
  "|[[Cookbook:Egg yolk|Egg yolks]]",
  "|12 [[Cookbook:Each|ea]].",
  "|",
  "|",
  "|",
  "|-",
  "|[[Cookbook:Cream|Heavy cream]]",
  "|",
  "|3 [[Cookbook:Pint|pints]] (1.4 liters)",
  "|1.4 [[Cookbook:Kilogram|kg]]",
  "|100%",
  "|}",
  "",
  "==Procedure==",
  "# Whisk the yolks into the sugar.",
]);

describe("a recipe whose ingredients are a table", () => {
  it("reads one line per row, quantity first and name after", () => {
    const page = toRecipePage(TABLE_PAGE, "https://example.invalid");
    expect(page.ingredients).toEqual([
      "¾ cup (178 ml) Granulated white sugar",
      "12 ea. Egg yolks",
      "3 pints (1.4 liters) Heavy cream",
    ]);
  });

  it("takes the column that carries the quantity, and never the percentage", () => {
    const page = toRecipePage(TABLE_PAGE, "https://example.invalid");
    for (const line of page.ingredients) expect(line).not.toMatch(/%/);
  });

  it("leaves the rest of the page readable", () => {
    const page = toRecipePage(TABLE_PAGE, "https://example.invalid");
    expect(page.servings).toBe(8);
    expect(page.steps).toHaveLength(1);
  });
});

describe("rows that name no ingredient", () => {
  const page = pageDocument([
    "{{recipesummary|servings=4}}",
    "==Ingredients==",
    '{| class="wikitable"',
    "!Ingredient",
    "!Count",
    "!Volume",
    "!Weight",
    "|-",
    "| colspan=\"4\" style=\"text-align: center\" |'''Component 1'''",
    "|-",
    "|[[Cookbook:Flour|Flour]]",
    "|",
    "|2 [[Cookbook:Cup|cups]]",
    "|250 g",
    "|-",
    "|[[Cookbook:Egg Wash|Egg wash]]",
    "|",
    "|",
    "|",
    "|-",
    "|'''Total'''",
    "|'''n/a'''",
    "|'''n/a'''",
    "|'''250 g'''",
    "|}",
  ]);

  it("drops a row that labels a component and a row that totals the table", () => {
    const read = toRecipePage(page, "https://example.invalid");
    expect(read.ingredients).toEqual(["2 cups Flour", "Egg wash"]);
  });

  it("keeps an ingredient the table gives no quantity for", () => {
    const read = toRecipePage(page, "https://example.invalid");
    expect(read.ingredients).toContain("Egg wash");
  });
});

describe("a bullet list and a table on one page", () => {
  it("reads the bullets and the table rows, losing neither", () => {
    const page = pageDocument([
      "{{recipesummary|servings=4}}",
      "==Ingredients==",
      "* 250 g hard flour",
      '{| class="wikitable"',
      "!Ingredient",
      "!Volume",
      "|-",
      "|Water",
      "|1 cup",
      "|}",
    ]);
    expect(toRecipePage(page, "https://example.invalid").ingredients).toEqual([
      "250 g hard flour",
      "1 cup Water",
    ]);
  });
});

describe("parseTables", () => {
  it("splits a table into its heading cells and its rows", () => {
    const tables = parseTables(
      [
        '{| class="wikitable"',
        "!Ingredient",
        "!Volume",
        "|-",
        "|Flour",
        "|2 cups",
        "|-",
        "|Water",
        "|1 cup",
        "|}",
      ].join("\n"),
    );
    expect(tables).toHaveLength(1);
    expect(tables[0]!.headers).toEqual(["Ingredient", "Volume"]);
    expect(tables[0]!.rows).toEqual([
      ["Flour", "2 cups"],
      ["Water", "1 cup"],
    ]);
  });

  it("reads cells written side by side on one line", () => {
    const tables = parseTables(
      ['{| class="wikitable"', "! Ingredient !! Volume", "|-", "| Flour || 2 cups", "|}"].join(
        "\n",
      ),
    );
    expect(tables[0]!.headers).toEqual(["Ingredient", "Volume"]);
    expect(tables[0]!.rows).toEqual([["Flour", "2 cups"]]);
  });

  it("keeps a cell's text and drops the attributes in front of it", () => {
    const tables = parseTables(
      ['{| class="wikitable"', "|-", '| style="text-align: left" | Flour', "|}"].join("\n"),
    );
    expect(tables[0]!.rows).toEqual([["Flour"]]);
  });
});
