/**
 * Counted things the general criterion does not settle on its own.
 *
 * A counted thing divides as far as the smallest share a cook can take out of
 * one and still do something with the rest, and almost everything a recipe
 * counts stops at the half. The lines below name the ones decided by what the
 * thing is rather than by the word that counts it: foods a knife takes to a
 * quarter, measures and containers holding enough that a quarter is still a
 * portion, cuts of meat that stop at the half, a word standing for a number of
 * things, a marker that announces a count of pieces without naming a measure,
 * and words covering two different foods at once.
 */

import { describe, expect, it } from "vitest";
import { scaleIngredient } from "../../src/recipe/scale.js";

const scale = (line: string, factor: number) => scaleIngredient(line, { factor });

describe("a whole food a knife takes to a quarter", () => {
  const quartered = [
    ["1 watermelon", "1/4 watermelon"],
    ["1 guinea fowl", "1/4 guinea fowl"],
    ["1 leek", "1/4 leek"],
    ["1 banana", "1/4 banana"],
    ["1 mango", "1/4 mango"],
    ["1 chicken", "1/4 chicken"],
    ["1 pork loin roast", "1/4 pork loin roast"],
    ["1 peach", "1/4 peach"],
  ];

  for (const [line, expected] of quartered) {
    it(`takes a quarter of "${line}"`, () => {
      const result = scale(line!, 0.25);
      expect(result.amount).toBe(0.25);
      expect(result.text).toBe(expected);
    });
  }
});

describe("a portion cut off a bird or a joint stops at the half", () => {
  it("halves a thigh, a drumstick and a wing", () => {
    for (const line of ["3 chicken thighs", "2 chicken drumsticks", "6 chicken wings"]) {
      expect(scale(line, 0.1).amount, line).toBe(0.5);
    }
  });
});

describe("a clove is the bud or the wedge of garlic, by what the line says", () => {
  // The cook who uses these recipes settled how far a clove goes: it is split
  // in two and no finer.
  it("takes a half of a clove of garlic", () => {
    expect(scale("1 clove garlic, minced", 0.25).amount).toBe(0.5);
    expect(scale("4 cloves garlic, minced", 0.25).text).toBe("1 clove garlic, minced");
  });

  it("counts the dried bud whole, whether or not the line writes it out", () => {
    expect(scale("4 cloves", 0.5).text).toBe("2 cloves");
    expect(scale("4 whole cloves", 0.5).text).toBe("2 whole cloves");
    expect(scale("1 clove", 0.25).amount).toBe(1);
  });

  it("leaves a head of garlic at the half, cloves or no cloves", () => {
    expect(scale("1 head of garlic, cloves crushed", 0.25).amount).toBe(0.5);
  });
});

describe("a zest is taken whole", () => {
  it("keeps the whole zest when the recipe shrinks", () => {
    expect(scale("1 lemon zest", 0.5).amount).toBe(1);
  });

  it("holds even though the fruit itself is quartered", () => {
    expect(scale("1 lemon", 0.5).amount).toBe(0.5);
  });
});

describe("a measure cut off something larger goes to the quarter", () => {
  it("takes a quarter of a slice", () => {
    expect(scale("1 slice of bread", 0.25).amount).toBe(0.25);
  });

  it("gives one slice where four are reduced to a quarter", () => {
    expect(scale("4 slices of bread", 0.25).text).toBe("1 slice bread");
  });
});

describe("a container holding enough for a quarter to be a portion", () => {
  it("takes a quarter of a jar", () => {
    expect(scale("1 jar of salsa", 0.25).amount).toBe(0.25);
  });

  it("takes a quarter of a bottle", () => {
    const result = scale("1 bottle of wine", 0.25);
    expect(result.amount).toBe(0.25);
    expect(result.text).toBe("1/4 bottle of wine");
  });

  it("takes a quarter of a block", () => {
    const result = scale("1 block firm tofu", 0.25);
    expect(result.amount).toBe(0.25);
    expect(result.text).toBe("1/4 block firm tofu");
  });

  it("still stops a can at the half", () => {
    expect(scale("1 can tomatoes", 0.25).amount).toBe(0.5);
  });
});

describe("a dozen states how many things are counted", () => {
  it("counts the things themselves, twelve to the dozen", () => {
    const result = scale("2 dozen mushrooms", 0.75);
    expect(result.amount).toBe(18);
    expect(result.text).toBe("18 mushrooms");
  });

  it("reads the same when the line writes the count as a word", () => {
    expect(scale("a dozen eggs", 0.5).text).toBe("6 eggs");
  });

  it("divides the way the thing counted divides", () => {
    expect(scale("1 dozen eggs", 0.4).amount).toBe(5);
  });
});

describe("a bare piece count names no measure", () => {
  it("leaves the marker out of the line it writes", () => {
    const result = scale("3 ea. tamarind pods", 3);
    expect(result.amount).toBe(9);
    expect(result.text).toBe("9 tamarind pods");
  });

  it("agrees the thing counted with the number that is left", () => {
    expect(scale("½ ea. apple", 2).text).toBe("1 apple");
  });

  it("reads divisibility off the thing counted", () => {
    expect(scale("12 ea. eggs", 5 / 12).amount).toBe(5);
    expect(scale("1 ea. onion", 0.25).amount).toBe(0.25);
  });
});

describe("the white of an egg and the breast of a bird are different things", () => {
  it("counts the white of an egg whole, as the egg and the yolk are", () => {
    expect(scale("2 egg whites", 0.5).amount).toBe(1);
    expect(scale("1 egg white", 0.5).amount).toBe(1);
  });

  it("halves the breast of a bird, which is a piece of meat", () => {
    expect(scale("1 chicken breast", 0.5).amount).toBe(0.5);
  });

  it("halves the meat even when the line also names a fruit", () => {
    expect(scale("1 chicken breast with apple sauce", 0.25).amount).toBe(0.5);
  });
});

describe("what the criterion already settled stays settled", () => {
  it("keeps an egg whole", () => {
    expect(scale("1 egg", 0.5).amount).toBe(1);
  });

  it("splits a can in two", () => {
    expect(scale("1 can tomatoes", 0.5).amount).toBe(0.5);
  });

  it("takes an onion to a quarter", () => {
    expect(scale("1 onion", 0.25).amount).toBe(0.25);
  });
});
