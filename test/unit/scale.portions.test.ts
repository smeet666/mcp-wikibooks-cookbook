/**
 * How finely a counted thing divides, decided by the size of one against what a
 * recipe puts in.
 *
 * A recipe counting twelve of something is counting things that are each
 * already a portion, and a smaller recipe puts fewer of them in the pan. A
 * recipe counting one is counting something a knife then takes a share out of.
 * The two families below are the two ends of that one comparison.
 */

import { describe, expect, it } from "vitest";
import { scaleIngredient } from "../../src/recipe/scale.js";

const scale = (line: string, factor: number) => scaleIngredient(line, { factor });

describe("a thing that is already a portion is counted whole", () => {
  it("lands on whole numbers for the shellfish a recipe counts by the dozen", () => {
    expect(scale("12 shrimp", 0.5).text).toBe("6 shrimp");
    expect(scale("5 shrimp", 0.5).amount).toBe(3);
    expect(scale("12 mussels", 0.5).text).toBe("6 mussels");
    expect(scale("6 prawns", 0.25).amount).toBe(2);
    expect(scale("3 langoustines", 0.5).amount).toBe(2);
  });

  it("lands on whole numbers for the seeds and buds a recipe counts out", () => {
    expect(scale("20 dried black peppercorns", 0.5).text).toBe("10 dried black peppercorns");
    expect(scale("3 whole black peppercorns", 0.5).amount).toBe(2);
    expect(scale("3 juniper berries", 0.5).amount).toBe(2);
    expect(scale("1 star anise", 0.5).amount).toBe(1);
    expect(scale("8 star anise", 0.5).text).toBe("4 star anise");
  });

  it("keeps one nut rather than a share of one", () => {
    expect(scale("1 hazelnut", 0.5).amount).toBe(1);
    expect(scale("5 hazelnuts", 0.5).amount).toBe(3);
  });
});

describe("a thing a recipe asks one of is taken to a quarter", () => {
  it("quarters the joints and the loaves a knife carves", () => {
    expect(scale("1 leg of lamb", 0.25).text).toBe("1/4 leg of lamb");
    expect(scale("1 baguette", 0.25).text).toBe("1/4 baguette");
  });

  it("quarters the cheeses a recipe asks one of", () => {
    expect(scale("1 camembert", 0.25).text).toBe("1/4 camembert");
    expect(scale("1 goat cheese", 0.25).amount).toBe(0.25);
    expect(scale("1 chorizo", 0.25).amount).toBe(0.25);
  });

  it("quarters the fruit a recipe cuts up", () => {
    expect(scale("1 pineapple", 0.25).text).toBe("1/4 pineapple");
    expect(scale("1 peach", 0.25).amount).toBe(0.25);
    expect(scale("1 apricot", 0.25).amount).toBe(0.25);
  });
});

describe("a juice stops at the half", () => {
  it("takes the half a squeezed fruit gives", () => {
    expect(scale("1 lemon juice", 0.5).amount).toBe(0.5);
  });

  it("comes back up to the half when a quarter is asked for", () => {
    expect(scale("1 lemon juice", 0.25).amount).toBe(0.5);
  });
});

describe("a number and the thing it counts agree at one", () => {
  it("puts the head noun back in the singular", () => {
    expect(scale("2 mussels", 0.5).text).toBe("1 mussel");
    expect(scale("2 hazelnuts", 0.5).text).toBe("1 hazelnut");
    expect(scale("2 peppercorns", 0.5).text).toBe("1 peppercorn");
    expect(scale("2 langoustines", 0.5).text).toBe("1 langoustine");
    expect(scale("2 juniper berries", 0.5).text).toBe("1 juniper berry");
    expect(scale("2 cloves", 0.5).text).toBe("1 clove");
  });

  it("leaves alone the names that read the same whatever the number", () => {
    expect(scale("2 shrimp", 0.5).text).toBe("1 shrimp");
    expect(scale("2 star anise", 0.5).text).toBe("1 star anise");
  });
});
