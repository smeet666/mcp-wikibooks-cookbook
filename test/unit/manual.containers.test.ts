/**
 * What a counted thing gives back when a recipe asks for less than one of it.
 *
 * A container is divided by what it holds. Half a can of tomatoes is poured out
 * and the rest kept, half a packet of vanilla sugar is weighed by eye, half a
 * sheet of gelatine is cut with scissors: each of those is an amount a kitchen
 * produces, so the count lands on the half. The egg is where that stops, since
 * half of one would have to be beaten and weighed.
 */

import { describe, expect, it } from "vitest";
import { scaleIngredient } from "../../src/recipe/scale.js";

const scale = (line: string, factor: number) => scaleIngredient(line, { factor });
const whole = (value: number | null) => value !== null && Number.isInteger(value);

describe("a container is divided by what it holds", () => {
  it("pours half a can rather than keeping a whole one", () => {
    const result = scale("1 can tomatoes", 0.4);
    expect(result.amount).toBe(0.5);
    expect(result.text).toBe("1/2 can tomatoes");
  });

  it("halves every container whose content pours, weighs or cuts", () => {
    for (const line of [
      "1 packet vanilla sugar",
      "1 package butter",
      "1 jar honey",
      "1 sheet gelatin",
      "1 sprig thyme",
      // A bottle and a block hold enough that a quarter of one is a portion,
      // and they are checked against that floor in scale.divisibility.
    ]) {
      expect(scale(line, 0.5).amount, line).toBe(0.5);
    }
  });

  it("keeps a half that the arithmetic landed on", () => {
    const result = scale("3 cans tomatoes", 0.5);
    expect(result.amount).toBe(1.5);
    expect(result.text).toBe("1 1/2 cans tomatoes");
  });

  it("splits a clove of garlic in two", () => {
    expect(scale("5 cloves garlic", 0.5).amount).toBe(2.5);
  });
});

describe("an egg is counted whole", () => {
  it("lands on a whole number when a recipe for six is taken to twenty-five", () => {
    const result = scale("3 eggs", 25 / 6);
    expect(result.amount).toBe(13);
    expect(result.text).toBe("13 eggs");
    expect(result.scaling).toBe("rounded");
  });

  it("counts eggs whole even when a bare piece count carries them", () => {
    for (const line of ["12 ea. egg yolks", "12 ea. eggs"]) {
      expect(whole(scale(line, 5 / 12).amount), line).toBe(true);
    }
  });
});

describe("a measure the hand gives its size to keeps counting in whole ones", () => {
  it("leaves a pinch whole when the recipe shrinks", () => {
    const result = scale("2 pinches salt", 0.4);
    expect(whole(result.amount)).toBe(true);
    expect(result.text).toBe("1 pinch salt");
  });

  it("leaves a capful whole", () => {
    expect(whole(scale("3 capfuls rum", 0.5).amount)).toBe(true);
  });
});
