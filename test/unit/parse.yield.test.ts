/**
 * Reading the yield a recipe box states.
 *
 * The count is what every quantity on the page is rescaled from, so a figure
 * read short scales the whole list. A yield written as a fraction is one
 * number, and reading its numerator alone both doubles the count and leaves the
 * denominator standing where the thing being counted goes.
 */

import { describe, expect, it } from "vitest";
import { readYieldCount } from "../../src/wikibooks/parse.js";

describe("a yield written as a fraction", () => {
  it("reads the fraction as the number it is", () => {
    expect(readYieldCount("1/2")).toEqual({ count: 0.5, unit: null });
  });

  it("counts what the page says it counts", () => {
    expect(readYieldCount("1/2 loaf")).toEqual({ count: 0.5, unit: "loaf" });
  });
});

describe("what a yield already read stays", () => {
  it("keeps a plain count", () => {
    expect(readYieldCount("6")).toEqual({ count: 6, unit: null });
  });

  it("keeps the thing a count counts", () => {
    expect(readYieldCount("24 balls")).toEqual({ count: 24, unit: "balls" });
  });

  it("takes no end of a range as the count", () => {
    expect(readYieldCount("4 to 6")).toEqual({ count: null, unit: null });
  });
});
