/**
 * Ingredient names that do not take an -s.
 *
 * A count is rewritten to agree with the number beside it, and English marks
 * that agreement irregularly: some names of food are the same in both numbers,
 * and others change their ending. A vegetable renamed by the arithmetic is a
 * small error the reader carries all the way to the shop.
 */

import { describe, expect, it } from "vitest";
import { agreeWithAmount, scaleIngredient } from "../../src/recipe/scale.js";

describe("names that read the same in both numbers", () => {
  const invariable = [
    "broccoli",
    "spinach",
    "asparagus",
    "rice",
    "couscous",
    "salmon",
    "shrimp",
    "cod",
    "okra",
    "celery",
    "garlic",
    "flour",
    "sugar",
    "butter",
  ];

  for (const word of invariable) {
    it(`leaves "${word}" as it is above one`, () => {
      expect(agreeWithAmount(word, 4)).toBe(word);
      expect(agreeWithAmount(word, 1)).toBe(word);
    });
  }

  it("scales a head of broccoli without renaming it", () => {
    expect(scaleIngredient("1 broccoli", { factor: 25 / 6 }).text).toBe("4 broccoli");
  });
});

describe("names whose plural is irregular", () => {
  const cases: [string, string][] = [
    ["potato", "potatoes"],
    ["tomato", "tomatoes"],
    ["mango", "mangoes"],
    ["loaf", "loaves"],
    ["leaf", "leaves"],
    ["knife", "knives"],
    ["half", "halves"],
    ["goose", "geese"],
  ];

  for (const [one, many] of cases) {
    it(`writes "${many}" above one and "${one}" at one`, () => {
      expect(agreeWithAmount(one, 3)).toBe(many);
      expect(agreeWithAmount(many, 1)).toBe(one);
    });
  }

  it("scales a count of potatoes without inventing a spelling", () => {
    expect(scaleIngredient("1 potato", { factor: 3 }).text).toBe("3 potatoes");
  });
});
