/**
 * Lines a pancake batter is written with, and what each one owes a caller.
 *
 * They cover three things: a fraction taken of a single container, a measure
 * whose size the cook gives and whose name the vocabulary does not carry, and
 * the label a multiplication that came out exact is entitled to.
 */

import { describe, expect, it } from "vitest";
import { scaleIngredient } from "../../src/recipe/scale.js";

const scale = (line: string, factor: number) => scaleIngredient(line, { factor });

describe("a fraction taken of one container", () => {
  it("writes the count where the article stood", () => {
    const r = scale("2/3 of a bottle of orange blossom water", 6);
    expect(r.text).toBe("4 bottles of orange blossom water");
    expect(r.amount).toBe(4);
  });

  it("reads the same fraction written in words", () => {
    expect(scale("two thirds of a bottle of orange blossom water", 6).text).toBe(
      "4 bottles of orange blossom water",
    );
  });

  it("reads a half stated with the article alone", () => {
    expect(scale("half a bottle of milk", 6).text).toBe("3 bottles of milk");
  });

  it("reads a half stated with the preposition", () => {
    expect(scale("half of a bottle of milk", 6).text).toBe("3 bottles of milk");
  });

  it("reads a half written as a glyph", () => {
    expect(scale("½ a bottle of milk", 6).text).toBe("3 bottles of milk");
  });

  it("finds the unit standing behind the article", () => {
    expect(scale("half a teaspoon salt", 6).text).toBe("3 teaspoons salt");
    expect(scale("a quarter of a cup of oil", 6).text).toBe("1 1/2 cups oil");
  });

  it("leaves a share of a thing named elsewhere alone", () => {
    expect(scale("half of the dough", 6).scaling).toBe("unscaled");
  });
});

describe("an approximate measure the vocabulary has not met", () => {
  it("counts a capful", () => {
    const r = scale("a capful of rum", 6);
    expect(r.scaling).not.toBe("unscaled");
    expect(r.text).toBe("6 capfuls rum");
    expect(r.note).toMatch(/approximate measure/i);
  });

  it("counts any container stated as what it holds", () => {
    expect(scale("a spoonful of honey", 6).text).toBe("6 spoonfuls honey");
    expect(scale("a jarful of pickles", 6).text).toBe("6 jarfuls pickles");
  });

  it("counts a pour nobody put a number on", () => {
    expect(scale("a glug of olive oil", 6).text).toBe("6 glugs olive oil");
  });

  it("leaves an article standing before a bare countable thing", () => {
    expect(scale("a ripe apple", 6).scaling).toBe("unscaled");
  });
});

describe("the whole batter, from four eaters to twenty-four", () => {
  const BATTER = [
    "a pinch of salt",
    "1 teaspoon sugar",
    "1 tablespoon softened butter",
    "1 cup Mountain Dew",
    "6 eggs",
    "1 kilogram flour",
    "2/3 of a bottle of orange blossom water",
    "3 sachets vanilla sugar",
    "a capful of rum",
    "1/4 liter milk",
  ];

  it("multiplies every line by six and calls each one exact", () => {
    const lines = BATTER.map((line) => scale(line, 6));
    expect(lines.map((entry) => entry.text)).toEqual([
      "6 pinches salt",
      "6 teaspoons sugar",
      "6 tablespoons softened butter",
      "6 cups Mountain Dew",
      "36 eggs",
      "6 kg flour",
      "4 bottles of orange blossom water",
      "18 sachets vanilla sugar",
      "6 capfuls rum",
      "1.5 l milk",
    ]);
    for (const entry of lines) expect(entry.scaling, entry.original).toBe("scaled");
  });
});

describe("the label an exact multiplication carries", () => {
  it("calls a whole-number product scaled", () => {
    for (const line of [
      "a pinch of salt",
      "1 teaspoon sugar",
      "1 tablespoon softened butter",
      "6 eggs",
      "3 sachets vanilla sugar",
    ]) {
      expect(scale(line, 6).scaling, line).toBe("scaled");
    }
  });

  it("calls a product that had to move rounded", () => {
    const r = scale("3 eggs", 0.5);
    expect(r.scaling).toBe("rounded");
    expect(r.amount).toBe(2);
  });
});
