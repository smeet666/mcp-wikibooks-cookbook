/**
 * Reading a recipe whose parts are laid out under sub-headings.
 *
 * A heading on a wiki owns the sections nested under it, so a recipe that
 * groups its ingredients by what they are for still states one list. The page
 * that files its procedure one level down is the counterweight: the heading a
 * section carries decides what it is, and the nesting alone does not.
 */

import { describe, expect, it } from "vitest";
import { toRecipePage } from "../../src/wikibooks/parse.js";
import { fixture } from "./helpers.js";

const URL = "https://api.wikimedia.org/core/v1/wikibooks/en/page/x";

describe("a recipe whose sections carry sub-headings", () => {
  const page = toRecipePage(fixture("page-grouped-ingredients"), URL);

  it("reads every ingredient, whichever sub-heading it sits under", () => {
    expect(page.ingredients).toEqual([
      "125 g orchard butter, softened",
      "150 g pale sugar",
      "3 eggs",
      "2 tablespoons lamp syrup",
      "2 tablespoons water",
      "2 tablespoons lamp syrup",
      "50 g icing sugar",
    ]);
  });

  it("keeps the sub-heading each ingredient sits under", () => {
    expect(page.ingredientGroups).toEqual([
      "Cake",
      "Cake",
      "Cake",
      "Soak",
      "Soak",
      "Glaze",
      "Glaze",
    ]);
  });

  it("states one group per ingredient, so the two can be read side by side", () => {
    expect(page.ingredientGroups).toHaveLength(page.ingredients.length);
  });

  it("reads the equipment, the steps and the tips out of their sub-headings too", () => {
    expect(page.equipment).toEqual(["Cake pan", "Small bowl"]);
    expect(page.steps).toHaveLength(3);
    expect(page.steps[2]).toBe(
      "Stir the icing sugar into the syrup and pour it over the cold cake.",
    );
    expect(page.tips).toEqual([
      "Glaze the day after baking.",
      "It keeps three days in a cold room.",
    ]);
  });
});

describe("a recipe whose procedure is nested under its ingredients", () => {
  const page = toRecipePage(fixture("page-nested-procedure"), URL);

  it("keeps the steps out of the ingredient list", () => {
    expect(page.ingredients).toEqual([
      "2 cups sticky rice, soaked overnight",
      "1 cup mung beans, soaked overnight",
      "500 g pork belly",
    ]);
    expect(page.ingredientGroups).toEqual([null, null, null]);
  });

  it("reads the steps under the heading that names them", () => {
    expect(page.steps).toEqual([
      "Simmer the beans until they mash, and season them.",
      "Wrap the rice around the filling and boil the parcels until the rice sets.",
    ]);
  });
});

describe("a page that lists other recipes", () => {
  const page = toRecipePage(fixture("page-reference"), URL);

  it("carries no ingredients, because it publishes none", () => {
    expect(page.ingredients).toEqual([]);
    expect(page.ingredientGroups).toEqual([]);
    expect(page.steps).toEqual([]);
  });
});
