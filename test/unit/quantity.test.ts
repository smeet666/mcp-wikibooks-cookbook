import { describe, expect, it } from "vitest";
import {
  formatAmount,
  parseIngredient,
  parseLeadingQuantity,
  parseLeadingRange,
} from "../../src/recipe/quantity.js";

describe("parseLeadingQuantity", () => {
  it("reads a whole number and a decimal", () => {
    expect(parseLeadingQuantity("450 g")?.amount).toBe(450);
    expect(parseLeadingQuantity("1.1 lb")?.amount).toBe(1.1);
  });

  it("reads a fraction written as a glyph", () => {
    expect(parseLeadingQuantity("½ tablespoon")?.amount).toBe(0.5);
    expect(parseLeadingQuantity("⅔ cup")?.amount).toBeCloseTo(2 / 3, 10);
  });

  it("reads a whole number followed by a glyph", () => {
    expect(parseLeadingQuantity("3 ¼ cups")?.amount).toBe(3.25);
    expect(parseLeadingQuantity("3¼ cups")?.amount).toBe(3.25);
  });

  it("reads a written fraction and a mixed number", () => {
    expect(parseLeadingQuantity("1/2 cup")?.amount).toBe(0.5);
    expect(parseLeadingQuantity("1 1/2 cups")?.amount).toBe(1.5);
  });

  it("returns null on a line that opens with a word", () => {
    expect(parseLeadingQuantity("Salt")).toBeNull();
    expect(parseLeadingQuantity("Freshly ground pepper")).toBeNull();
  });

  it("returns null on a denominator of zero rather than an infinite amount", () => {
    expect(parseLeadingQuantity("1/0 cup")).toBeNull();
  });
});

describe("parseLeadingRange", () => {
  it("reads a range written with an en dash", () => {
    const range = parseLeadingRange("225–500 g butter")!;
    expect(range.amount).toBe(225);
    expect(range.max).toBe(500);
    expect(range.separator).toBe("–");
  });

  it("reads a range written in words", () => {
    const range = parseLeadingRange("2 to 3 cloves")!;
    expect([range.amount, range.max, range.separator]).toEqual([2, 3, "to"]);
  });

  it("reads a range whose bounds are glyphs", () => {
    const range = parseLeadingRange("½–1 pound")!;
    expect([range.amount, range.max]).toEqual([0.5, 1]);
  });

  it("does not read a descending pair as a range", () => {
    expect(parseLeadingRange("3-2 cups")).toBeNull();
  });

  it("does not read a word beginning with 'to' as a separator", () => {
    expect(parseLeadingRange("5 tomatoes")).toBeNull();
  });

  it("does not read a hyphenated measure as a range", () => {
    expect(parseLeadingRange("1-inch pieces")).toBeNull();
  });
});

describe("parseIngredient", () => {
  it("splits amount, unit and item", () => {
    const parsed = parseIngredient("450 g flat noodles");
    expect(parsed.amount).toBe(450);
    expect(parsed.unit?.canonical).toBe("g");
    expect(parsed.item).toBe("flat noodles");
  });

  it("reads a bracketed equivalent as a measure of its own", () => {
    const parsed = parseIngredient("450 g (1 pound) flat noodles");
    expect(parsed.alternates).toHaveLength(1);
    expect(parsed.alternates[0]!.amount).toBe(1);
    expect(parsed.alternates[0]!.unit?.canonical).toBe("pound");
    expect(parsed.item).toBe("flat noodles");
  });

  it("reads several equivalents separated by slashes", () => {
    const parsed = parseIngredient("3 ¼ cups (500 g / 1.1 lb) rolled oats");
    expect(parsed.alternates.map((measure) => measure.unit?.canonical)).toEqual(["g", "lb"]);
    expect(parsed.item).toBe("rolled oats");
  });

  it("reads a bracketed range as a range", () => {
    const parsed = parseIngredient("225–500 g (½–1 pound) butter");
    expect(parsed.amountMax).toBe(500);
    expect(parsed.alternates[0]!.amountMax).toBe(1);
  });

  it("leaves a bracketed remark in the item, because it is prose", () => {
    const parsed = parseIngredient("3 bananas (the riper the better), mashed");
    expect(parsed.alternates).toEqual([]);
    expect(parsed.item).toBe("bananas (the riper the better), mashed");
  });

  it("treats a line with no unit as something counted", () => {
    const parsed = parseIngredient("5 egg yolks");
    expect(parsed.unit).toBeNull();
    expect(parsed.item).toBe("egg yolks");
  });

  it("takes the longest unit spelling", () => {
    expect(parseIngredient("2 fluid ounces stock").unit?.canonical).toBe("fluid ounce");
    expect(parseIngredient("2 tablespoons oil").unit?.canonical).toBe("tablespoon");
  });

  it("reads a unit written with an abbreviating dot", () => {
    expect(parseIngredient("6 Tbsp. coffee").unit?.canonical).toBe("Tbsp");
  });

  it("drops the preposition between a unit and what it counts", () => {
    expect(parseIngredient("2 heads of garlic").item).toBe("garlic");
  });

  it("leaves a line with no number whole", () => {
    const parsed = parseIngredient("Salt");
    expect(parsed.amount).toBeNull();
    expect(parsed.item).toBe("Salt");
  });

  it("does not mistake a word starting with a unit's letters for that unit", () => {
    expect(parseIngredient("1 large onion").unit).toBeNull();
    expect(parseIngredient("3 garlic cloves").unit).toBeNull();
  });
});

describe("formatAmount", () => {
  it("writes a whole number plainly", () => {
    expect(formatAmount(6)).toBe("6");
  });

  it("writes a kitchen fraction as a fraction", () => {
    expect(formatAmount(0.5)).toBe("1/2");
    expect(formatAmount(1.25)).toBe("1 1/4");
    expect(formatAmount(2 / 3)).toBe("2/3");
  });

  it("writes a measurement as a decimal", () => {
    expect(formatAmount(118.666, { fractions: false })).toBe("118.67");
  });

  it("falls back to a decimal when no fraction is close", () => {
    expect(formatAmount(1.63)).toBe("1.63");
  });
});
