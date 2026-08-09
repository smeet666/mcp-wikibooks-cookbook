/**
 * Alternative ingredient lists, told apart from the parts of a dish.
 *
 * A sub-heading under an ingredient list means one of two opposite things. A
 * part of the dish is made alongside the other parts, and the cook buys all of
 * them: a cake, its soak and its glaze. An alternative replaces the others, and
 * the cook buys one: a first, a second and a third version of the same salad.
 * Both are written the same way, and only the wording of the heading tells them
 * apart.
 *
 * Read as parts, three alternatives become one shopping list of three tins of
 * fish under a procedure that says to mix everything in a bowl. So the wording
 * decides: a heading naming an alternative opens a list of its own, every line
 * under it says which alternative it belongs to, and `group`, which names a
 * part of the dish, stays null on those lines because they name no part.
 */

import { describe, expect, it } from "vitest";
import { toRecipePage } from "../../src/wikibooks/parse.js";
import { fixture } from "./helpers.js";

const URL = "https://api.wikimedia.org/core/v1/wikibooks/en/page/x";

describe("a recipe publishing alternative ingredient lists", () => {
  const page = toRecipePage(fixture("page-alternative-lists"), URL);

  it("reads every line the page publishes", () => {
    expect(page.ingredients).toEqual([
      "2 cups cooked lamp fish",
      "1 large tin lamp fish",
      "½ cup orchard cream",
      "2 tins lamp fish",
      "3 tablespoons orchard cream",
      "Sour cream in place of orchard cream",
    ]);
  });

  it("says which alternative each line belongs to", () => {
    expect(page.ingredientVariants).toEqual([
      null,
      "Variation I",
      "Variation I",
      "Variation II",
      "Variation II",
      "Substitutions",
    ]);
  });

  it("states one alternative per ingredient, so the two can be read side by side", () => {
    expect(page.ingredientVariants).toHaveLength(page.ingredients.length);
  });

  it("calls none of them a part of the dish", () => {
    expect(page.ingredientGroups).toEqual([null, null, null, null, null, null]);
  });
});

describe("a recipe whose sub-headings name the parts of the dish", () => {
  const page = toRecipePage(fixture("page-grouped-ingredients"), URL);

  it("holds no alternative, because every heading names a part", () => {
    expect(page.ingredientVariants).toEqual(page.ingredients.map(() => null));
  });

  it("still groups the parts as the page lays them out", () => {
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
});
