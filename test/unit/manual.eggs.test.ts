/**
 * An egg is counted whole.
 *
 * A kitchen halves a clove of garlic and quarters an onion. It does not measure
 * out half an egg, half a yolk or half a white, so a count of those lands on a
 * whole number whichever way the arithmetic fell, and the line names the
 * direction it moved in.
 */

import { describe, expect, it } from "vitest";
import { scaleIngredient } from "../../src/recipe/scale.js";

const scale = (line: string, factor: number) => scaleIngredient(line, { factor });
const whole = (value: number | null) => value !== null && Number.isInteger(value);

describe("a count of eggs", () => {
  it("lands on a whole number when a recipe for six is taken to twenty-five", () => {
    const result = scale("3 eggs", 25 / 6);
    expect(result.amount).toBe(13);
    expect(result.text).toBe("13 eggs");
    expect(result.scaling).toBe("rounded");
  });

  it("says which way the count moved", () => {
    expect(scale("3 eggs", 25 / 6).note).toBe("Rounded up from 12 1/2.");
    expect(scale("5 eggs", 0.5).note).toBe("Rounded up from 2 1/2.");
    expect(scale("5 eggs", 0.45).note).toBe("Rounded down from 2 1/4.");
  });

  it("holds for yolks and for whites", () => {
    for (const line of ["5 egg yolks", "5 egg whites", "5 yolks"]) {
      expect(whole(scale(line, 0.5).amount), line).toBe(true);
    }
  });

  it("keeps a clove of garlic divisible in two", () => {
    expect(scale("5 cloves garlic", 0.5).amount).toBe(2.5);
  });

  it("keeps an exact count exact and says nothing", () => {
    const result = scale("3 eggs", 2);
    expect(result.amount).toBe(6);
    expect(result.scaling).toBe("scaled");
    expect(result.note).toBeUndefined();
  });

  it("keeps one egg in the recipe when the recipe shrinks", () => {
    const result = scale("2 eggs", 0.1);
    expect(result.amount).toBe(1);
    expect(result.note).toContain("no longer holds its share");
  });
});
