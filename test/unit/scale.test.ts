import { describe, expect, it } from "vitest";
import { agreeWithAmount, passthroughIngredient, scaleIngredient } from "../../src/recipe/scale.js";
import { chooseReadableUnit, lookupUnit } from "../../src/recipe/units.js";

const scale = (line: string, factor: number) => scaleIngredient(line, { factor });

describe("scaleIngredient, countable things", () => {
  it("never leaves a fraction of an egg", () => {
    const result = scale("5 egg yolks", 2 / 3);
    expect(result.amount).toBe(3);
    expect(result.text).toBe("3 egg yolks");
    expect(result.scaling).toBe("rounded");
  });

  it("calls a count that lands exactly what it is", () => {
    const result = scale("5 egg yolks", 2);
    expect(result.amount).toBe(10);
    expect(result.scaling).toBe("scaled");
    expect(result.note).toBeUndefined();
  });

  it("makes the item agree with its number", () => {
    expect(scale("5 egg yolks", 0.2).text).toBe("1 egg yolk");
    expect(scale("1 loaf", 3).text).toBe("3 loaves");
  });

  it("keeps a whole thing rather than shrinking it away", () => {
    const result = scale("1 onion", 0.1);
    expect(result.amount).toBe(0.25);
    expect(result.note).toContain("no longer holds its share");
  });

  it("never asks for more of a thing than the recipe did when scaling down", () => {
    const result = scale("1 egg", 0.9);
    expect(result.amount).toBeLessThanOrEqual(1);
  });

  // This test used to require three cans halved to come back as two, on the
  // reading that a sealed container is taken whole or not at all. What decides
  // is the content: tomatoes are poured out and the rest kept, so half a can is
  // an amount, and rounding it up added a sixth of the tomatoes to the dish.
  it("halves a spoon and halves a can", () => {
    expect(scale("3 tablespoons oil", 0.5).text).toBe("1 1/2 tablespoons oil");
    expect(scale("3 cans tomatoes", 0.5).text).toBe("1 1/2 cans tomatoes");
  });
});

describe("scaleIngredient, measurements", () => {
  it("multiplies a mass and keeps it exact when it lands exact", () => {
    const result = scale("450 g noodles", 2);
    expect(result).toMatchObject({ amount: 900, unit: "g", scaling: "scaled" });
  });

  it("climbs to a bigger unit rather than printing thousands", () => {
    const result = scale("450 g noodles", 10);
    expect(result).toMatchObject({ amount: 4.5, unit: "kg" });
    expect(result.text).toBe("4.5 kg noodles");
  });

  it("moves to a smaller unit before rounding, so nothing disappears", () => {
    const result = scale("1 kg flour", 0.001);
    expect(result.unit).toBe("g");
    expect(result.amount).toBe(1);
  });

  it("walks the whole way down a ladder rather than rounding to zero", () => {
    const result = scale("1 l stock", 0.0005);
    expect(result.amount).toBeGreaterThan(0);
    expect(result.unit).toBe("ml");
  });

  it("keeps an imperial amount on the imperial ladder", () => {
    const result = scale("1 pound butter", 0.5);
    expect(result).toMatchObject({ amount: 8, unit: "ounce" });
  });
});

describe("scaleIngredient, ranges", () => {
  it("scales both ends and keeps the shape the recipe wrote", () => {
    const result = scale("3–4 tablespoons oil", 2 / 3);
    expect(result.amount).toBe(2);
    expect(result.amountMax).toBe(2.5);
    expect(result.text).toBe("2–2 1/2 tablespoons oil");
  });

  it("puts both ends of a range in one unit", () => {
    const result = scale("½–1 pound butter", 5 / 3);
    expect(result.unit).toBe("pound");
    expect(result.text).toBe("0.83–1.7 pounds butter");
  });

  it("keeps a range written in words readable", () => {
    expect(scale("2 to 3 cloves garlic", 2).text).toBe("4 to 6 cloves garlic");
  });
});

describe("scaleIngredient, bracketed equivalents", () => {
  it("scales the equivalent with the amount it restates", () => {
    const result = scale("450 g (1 pound) noodles", 2 / 3);
    expect(result.text).toBe("300 g (11 ounces) noodles");
  });

  it("says the amount was exact when only the equivalent had to move", () => {
    const result = scale("450 g (1 pound) noodles", 2 / 3);
    expect(result.scaling).toBe("rounded");
    expect(result.note).toContain("The amount is exact");
  });

  it("scales every equivalent on the line", () => {
    const result = scale("3 ¼ cups (500 g / 1.1 lb) oats", 2);
    expect(result.text).toContain("(1 kg / 2.2 lb)");
  });

  it("names the bound that moved and which way it went", () => {
    const result = scale("225–500 g butter", 2 / 3);
    expect(result.note).toBe("Rounded up from 333.33 g.");
  });
});

describe("scaleIngredient, what cannot be scaled", () => {
  it("leaves a line with no quantity alone and says why", () => {
    const result = scale("Salt", 3);
    expect(result).toMatchObject({ text: "Salt", scaling: "unscaled", amount: null });
    expect(result.note).toContain("No quantity given");
  });

  // This test used to require that a pinch come back at its published size.
  // A pinch is a quantity a hand produces, so a recipe multiplied by four needs
  // four of them, and a leavening agent left at one pinch for twenty-five
  // servings is a dish that does not rise. The count is what moves; how much
  // one pinch holds stays the cook's, and the note says so.
  it("multiplies the count of pinches and says the measure is approximate", () => {
    const result = scale("1 pinch of dried flower", 4);
    expect(result.scaling).toBe("scaled");
    expect(result.text).toBe("4 pinches dried flower");
    expect(result.note).toMatch(/approximate/i);
  });
});

describe("a factor of one", () => {
  it("returns the line as published rather than rewriting it", () => {
    const result = scale("178 ml grated cheese", 1);
    expect(result.text).toBe("178 ml grated cheese");
    expect(result.amount).toBe(178);
    expect(result.scaling).toBe("scaled");
  });
});

describe("passthroughIngredient", () => {
  it("reads the quantity without touching the line", () => {
    const result = passthroughIngredient("225–500 g (½–1 pound) butter");
    expect(result).toMatchObject({
      text: "225–500 g (½–1 pound) butter",
      amount: 225,
      amountMax: 500,
      unit: "g",
      scaling: "scaled",
    });
  });

  // "1 pinch salt" used to be counted among the lines carrying nothing to
  // multiply. It carries one pinch, which is a quantity, and a line whose
  // quantity was read is `scaled` when the factor is one.
  it("calls a line with nothing to multiply unscaled", () => {
    expect(passthroughIngredient("Salt").scaling).toBe("unscaled");
    expect(passthroughIngredient("1 pinch salt").scaling).toBe("scaled");
    expect(passthroughIngredient("1 pinch salt").amount).toBe(1);
  });
});

describe("agreeWithAmount", () => {
  it("marks the plural on the head noun, which is the last word", () => {
    expect(agreeWithAmount("egg yolk", 3)).toBe("egg yolks");
    expect(agreeWithAmount("egg yolks", 1)).toBe("egg yolk");
  });

  it("leaves preparation after a comma alone", () => {
    expect(agreeWithAmount("onions, finely diced", 1)).toBe("onion, finely diced");
    expect(agreeWithAmount("banana, mashed", 3)).toBe("bananas, mashed");
  });

  it("leaves a word whose singular already ends in -s alone", () => {
    expect(agreeWithAmount("couscous", 1)).toBe("couscous");
    expect(agreeWithAmount("glass", 3)).toBe("glasses");
  });
});

describe("chooseReadableUnit", () => {
  it("returns the same unit and no change when the amount is already readable", () => {
    const gram = lookupUnit("g")!;
    expect(chooseReadableUnit(gram, 450)).toEqual({ unit: gram, ratio: 1 });
  });

  it("gives the ratio that carries every bound of a range to one unit", () => {
    const pound = lookupUnit("pound")!;
    const chosen = chooseReadableUnit(pound, 0.5);
    expect(chosen.unit.canonical).toBe("ounce");
    expect(chosen.ratio).toBe(16);
  });
});

describe("a line carrying a second quantity", () => {
  it("says only the first amount was scaled", () => {
    const result = scale("1 Tbsp vanilla sugar OR 1 tsp vanilla extract", 0.5);
    expect(result.text.startsWith("1/2 Tbsp")).toBe(true);
    expect(result.note).toContain("only the first was scaled");
  });

  it("does not mistake a measure the parser does not know for one", () => {
    expect(scale("2 onions, cut into 1-inch pieces", 2).note).toBeUndefined();
  });
});
