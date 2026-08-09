/**
 * Quantities a line states in brackets.
 *
 * Two shapes are read here. A line asking for as much as is needed and giving
 * an indication of how much that usually is states a quantity, and saying it
 * states none is false. A line offering a second quantity as an alternative
 * hands the cook a choice, and a cook taking the second branch of a doubled
 * line must not be handed half the recipe.
 */

import { describe, expect, it } from "vitest";
import { passthroughIngredient, scaleIngredient } from "../../src/recipe/scale.js";

describe("a line whose only quantity is an indication in brackets", () => {
  it("does not claim the page gave no quantity", () => {
    const held = passthroughIngredient("Warm water as required (about 1 ½ cups)");
    expect(held.note ?? "").not.toContain("No quantity given");
  });

  it("scales the indication with the rest of the recipe", () => {
    const doubled = scaleIngredient("Warm water as required (about 1 ½ cups)", { factor: 2 });
    expect(doubled.text).toBe("Warm water as required (about 3 cups)");
    expect(doubled.scaling).not.toBe("unscaled");
  });

  it("leaves a bracket that states no quantity alone", () => {
    const doubled = scaleIngredient("Warm water (about 110 °F)", { factor: 2 });
    expect(doubled.text).toBe("Warm water (about 110 °F)");
    expect(doubled.scaling).toBe("unscaled");
  });
});

describe("a line offering an alternative in brackets", () => {
  it("scales the branch the cook may take instead", () => {
    const tripled = scaleIngredient("4 eggs (or 8 egg yolks)", { factor: 3 });
    expect(tripled.text).toBe("12 eggs (or 24 egg yolks)");
  });

  it("says both branches were scaled and how far one stands for the other", () => {
    const doubled = scaleIngredient("2 teaspoons fresh thyme leaves (or ½ teaspoon dried)", {
      factor: 2,
    });
    expect(doubled.text).toBe("4 teaspoons fresh thyme leaves (or 1 teaspoon dried)");
    expect(doubled.note ?? "").toContain("choice");
  });

  it("says when the branch itself holds a quantity that stayed as published", () => {
    const quadrupled = scaleIngredient("3 cups milk (or 1½ cup cream + 1½ cup water)", {
      factor: 4,
    });
    expect(quadrupled.text).toBe("12 cups milk (or 6 cups cream + 1½ cup water)");
    expect(quadrupled.note ?? "").toContain("only the first was scaled");
  });

  it("says each thing once, however many branches repeat it", () => {
    const doubled = scaleIngredient("120 g (½ cup or 4 oz) flour (white or 1:1 mix of the two)", {
      factor: 2,
    });
    const sentences = (doubled.note ?? "").split(/(?<=\.)\s+/).filter(Boolean);
    expect(new Set(sentences).size).toBe(sentences.length);
  });

  it("keeps the branch note off a line whose head states no quantity", () => {
    const held = passthroughIngredient("Up to 6 eggs or ½ pint (300 ml) of cream");
    const doubled = scaleIngredient("Up to 6 eggs or ½ pint (300 ml) of cream", { factor: 2 });
    expect(held.note).toBe(doubled.note);
  });

  it("leaves a bracket that restates the same quantity as an equivalent", () => {
    const doubled = scaleIngredient("450 g (1 pound) onions", { factor: 2 });
    expect(doubled.text).toBe("900 g (2 pounds) onions");
  });
});
