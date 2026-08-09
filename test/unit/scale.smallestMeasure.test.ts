/**
 * The floor under a spoonful, and the figures a note quotes.
 *
 * A quantity divided far enough reaches the bottom of its ladder and is still
 * too small to measure. A counted thing is clamped up to the smallest share
 * worth putting in a bowl and says so; a spoonful owes the same answer, because
 * "0.05 teaspoon" is arithmetic rather than an instruction.
 *
 * A note quotes figures for a cook to compare against the line, so a figure
 * that rounds to zero in the note's own precision is written with the digits it
 * has: "from 0" beside a quantity that is not zero reads as a mistake.
 */

import { describe, expect, it } from "vitest";
import { scaleIngredient } from "../../src/recipe/scale.js";

const scale = (line: string, factor: number) => scaleIngredient(line, { factor });

describe("a spoonful under what a measuring set carries", () => {
  it("clamps a cup divided a thousandfold to the smallest spoon it fills", () => {
    const result = scale("1 cup flour", 0.001);
    expect(result.amount).toBe(0.25);
    expect(result.unit).toBe("teaspoon");
    expect(result.text).toBe("1/4 teaspoon flour");
  });

  it("says the line no longer holds its share, as a counted thing does", () => {
    const note = scale("1 cup flour", 0.001).note ?? "";
    expect(note).toContain("the smallest amount worth measuring");
    expect(note).toContain("no longer holds its share of the recipe");
  });

  it("states the shortfall in the unit the line now reads in", () => {
    const note = scale("1 cup flour", 0.001).note ?? "";
    expect(note).not.toContain("cup");
  });
});

describe("a note quotes a figure a cook can read", () => {
  it("writes a clamped amount's own digits rather than rounding it to zero", () => {
    const note = scale("1 clove garlic", 0.001).note ?? "";
    expect(note).toContain("0.001");
    expect(note).not.toMatch(/from 0,/);
  });
});
