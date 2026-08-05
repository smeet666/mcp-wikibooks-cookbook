/**
 * An approximate measure is still a measure.
 *
 * A pinch is a quantity a hand can produce, and a recipe multiplied by four
 * needs four of them. Leaving the pinch at its published size hands a cook a
 * dish raised by a twenty-fifth of the leavening it needs, and "adjust to
 * taste" is advice about seasoning, which a leavening agent is not.
 *
 * The count is what moves. Restating a pinch in teaspoons would put on the page
 * a number the page never wrote, so the equivalence stays in the note.
 */

import { describe, expect, it } from "vitest";
import { passthroughIngredient, scaleIngredient } from "../../src/recipe/scale.js";

const scale = (line: string, factor: number) => scaleIngredient(line, { factor });

describe("a pinch carried from six servings to twenty-five", () => {
  const result = scale("a pinch of baking soda", 25 / 6);

  it("multiplies the count of pinches", () => {
    expect(result.text).toBe("4 pinches baking soda");
    expect(result.amount).toBe(4);
    expect(result.unit).toBe("pinch");
  });

  it("is not reported as a line carrying nothing to multiply", () => {
    expect(result.scaling).toBe("rounded");
  });

  it("says the measure is approximate rather than telling a cook to taste it", () => {
    expect(result.note).toMatch(/approximate/i);
    expect(result.note).not.toMatch(/to taste/i);
  });

  it("gives the common equivalence in the note and never in the quantity", () => {
    expect(result.note).toMatch(/teaspoon/i);
    expect(result.text).not.toMatch(/teaspoon|tsp/i);
  });
});

describe("the other approximate measures", () => {
  const cases: Array<[string, string]> = [
    ["1 dash hot sauce", "4 dashes hot sauce"],
    ["a splash of vinegar", "4 splashes vinegar"],
    ["1 handful parsley", "4 handfuls parsley"],
    ["a knob of butter", "4 knobs butter"],
    ["1 drizzle olive oil", "4 drizzles olive oil"],
  ];

  for (const [line, expected] of cases) {
    it(`carries "${line}" to "${expected}"`, () => {
      const result = scale(line, 4);
      expect(result.text).toBe(expected);
      expect(result.scaling).not.toBe("unscaled");
    });
  }
});

describe("an article in front of a measure", () => {
  it("reads 'a pinch' as one pinch", () => {
    expect(passthroughIngredient("a pinch of salt").amount).toBe(1);
    expect(passthroughIngredient("a pinch of salt").unit).toBe("pinch");
  });

  it("leaves an article in front of a thing that is not a measure alone", () => {
    const line = passthroughIngredient("a ripe orchard apple");
    expect(line.amount).toBeNull();
    expect(line.text).toBe("a ripe orchard apple");
  });
});

describe("a line with no quantity at all", () => {
  it("stays untouched and says so", () => {
    const result = scale("Salt", 4);
    expect(result.scaling).toBe("unscaled");
    expect(result.note).toContain("No quantity given");
  });
});
