import { describe, expect, it } from "vitest";
import { scaleIngredient } from "../../src/recipe/scale.js";

const scale = (line: string, factor: number) => scaleIngredient(line, { factor });

describe("HTML entities in a published line", () => {
  it("reads a named entity as the fraction it stands for", () => {
    const result = scale("3&frac12; cups (840 ml) flour", 2);
    expect(result.text).toBe("7 cups (1.68 l) flour");
    expect(result.amount).toBe(7);
  });

  it("reads a named entity written without a bracketed equivalent", () => {
    expect(scale("1&frac12; teaspoons salt", 2).text).toBe("3 teaspoons salt");
  });

  it("reads a numeric entity as the fraction it stands for", () => {
    const result = scale("&#8532; cups (160 ml) water", 2);
    expect(result.scaling).not.toBe("unscaled");
    expect(result.text).toBe("1 1/2 cups (320 ml) water");
  });

  it("keeps the line as published in `original`", () => {
    expect(scale("1&frac12; teaspoons salt", 2).original).toBe("1&frac12; teaspoons salt");
  });
});

describe("a comma grouping thousands", () => {
  it("reads the whole number rather than the digits before the comma", () => {
    const result = scale("1,500 g flour", 2);
    expect(result.text).toBe("3 kg flour");
    expect(result.amount).toBe(3);
    expect(result.unit).toBe("kg");
  });

  it("reads more than one group", () => {
    expect(scale("1,500,000 mg salt", 2)).toMatchObject({ amount: 3000, unit: "g" });
  });

  it("refuses a comma that groups no thousand, rather than guessing", () => {
    const result = scale("1,5 kg flour", 2);
    expect(result.text).toBe("1,5 kg flour");
    expect(result.scaling).toBe("unscaled");
    expect(result.note).toMatch(/comma/i);
  });
});

describe("a number that qualifies the size of one thing", () => {
  it("does not order eight roasts where the page described one", () => {
    const result = scale("4 to 5-pound boneless pork loin roast", 2);
    expect(result.text).toBe("4 to 5-pound boneless pork loin roast");
    expect(result.scaling).toBe("unscaled");
    expect(result.note).toMatch(/size of one/i);
  });

  it("leaves a hyphenated size written without a range", () => {
    expect(scale("1-inch pieces of ginger", 2).text).toBe("1-inch pieces of ginger");
  });

  it("still reads a range whose bounds are joined by a hyphen", () => {
    expect(scale("200-300 g guanciale", 2).text).toBe("400-600 g guanciale");
  });
});

describe("a quantity already stated per person", () => {
  it("does not apply the factor a second time", () => {
    const result = scale("1 slice of stale french bread, per person", 2);
    expect(result.text).toBe("1 slice of stale french bread, per person");
    expect(result.scaling).toBe("unscaled");
    expect(result.note).toMatch(/one person/i);
  });
});

describe("brackets the page left empty", () => {
  it("drops them rather than carrying them into the answer", () => {
    expect(scale("¼ cup () superfine sugar", 2).text).toBe("1/2 cup superfine sugar");
  });

  it("drops them from a line that also rounds", () => {
    expect(scale("⅔ cup () heavy cream, plus extra to serve (optional)", 2).text).toBe(
      "1 1/2 cups heavy cream, plus extra to serve (optional)",
    );
  });
});

describe('"recipe" naming another recipe of the book', () => {
  it("puts the plural mark on the count rather than on the dish", () => {
    expect(scale("1 recipe Flaky Pie Crust", 2).text).toBe("2 recipes Flaky Pie Crust");
  });
});

describe("a number the page introduced as approximate", () => {
  it("scales the amount and keeps the sign that says it is loose", () => {
    const result = scale("~1 cup water", 2);
    expect(result.text).toBe("~2 cups water");
    expect(result.amount).toBe(2);
    expect(result.note).toMatch(/approximation/i);
  });

  it("scales an amount introduced by a word", () => {
    const result = scale("about 6 medium lemons", 2);
    expect(result.text).toBe("about 12 medium lemons");
    expect(result.amount).toBe(12);
  });
});

describe("an adjective standing between the number and the measure", () => {
  it("reads the measure behind it", () => {
    const result = scale("1 small handful of parsley", 2);
    expect(result.unit).toBe("handful");
    expect(result.text).toBe("2 small handfuls parsley");
    expect(result.note).toMatch(/approximate measure/i);
  });

  it("reads a container behind it", () => {
    const result = scale("1 large can of tomatoes", 2);
    expect(result.unit).toBe("can");
    expect(result.text).toBe("2 large cans tomatoes");
  });

  it("leaves a word that names no measure in the item", () => {
    expect(scale("1 cleaned leek green", 2).unit).toBeNull();
  });
});

describe("the plural mark a page writes in brackets", () => {
  it("looks the measure up without it", () => {
    const result = scale("2 tablespoon(s) sugar", 2);
    expect(result.unit).toBe("tablespoon");
    expect(result.text).toBe("4 tablespoons sugar");
  });
});

describe("choosing one unit for both ends of a range", () => {
  it("chooses from the lower bound, which is the one a unit can ruin", () => {
    expect(scale("225–500 g guanciale", 2).text).toBe("450–1000 g guanciale");
  });
});

describe("a range whose ends land on the same amount", () => {
  it("states the one amount rather than a range of it to itself", () => {
    const result = scale("1–2 large eggs", 0.5);
    expect(result.text).toBe("1 large egg");
    expect(result.amountMax).toBeNull();
    expect(result.note).toMatch(/both ends come to the same amount/i);
  });
});

describe("a recipe being made smaller", () => {
  it("never comes out asking for more than the page published", () => {
    expect(scale("104 g sugar", 0.99).text).toBe("104 g sugar");
  });
});

describe("what counts as landing on the exact product", () => {
  it("calls a hundredth off a thousandth rounded rather than exact", () => {
    // At the bottom of the ladder there is no smaller unit to hold the
    // precision, so 0.006 becomes 0.01: inside the absolute gap, and two thirds
    // larger than what was asked for.
    expect(scale("1 mg saffron", 0.006).scaling).toBe("rounded");
  });
});

describe("a quantity smaller than a kitchen scale resolves", () => {
  it("says so rather than handing back a figure alone", () => {
    expect(scale("1 g saffron", 0.000_03).note).toMatch(/kitchen scale resolves/i);
  });
});

describe("an article read as a number", () => {
  it("says which word the figure came from", () => {
    expect(scale("a pinch of salt", 4).note).toMatch(/"a" read as 1\./);
  });
});

describe("a second quantity left at its published size", () => {
  it("says so even on a line that was also rounded", () => {
    const result = scale("2.5 kg beef, plus 2 tablespoons flour", 0.5);
    expect(result.note).toMatch(/further quantity after the first one/i);
  });
});

describe("a range whose two ends both moved", () => {
  it("names each end with the direction it moved in", () => {
    // The two ends move opposite ways here, which is the case a single note
    // reports the wrong direction for half the quantity.
    const note = scale("2 to 3 cloves garlic", 0.3).note ?? "";
    expect(note).toMatch(/Rounded down from 0\.6 clove\./);
    expect(note).toMatch(/Rounded up from 0\.9 clove\./);
  });
});

describe("how far a clove of garlic divides", () => {
  // The cook settled this: a clove is split in two and no finer.
  it("stops at the half", () => {
    expect(scale("1 clove garlic", 0.25).text).toBe("1/2 clove garlic");
  });

  it("collapses a range whose ends both come to the half", () => {
    expect(scale("2 to 3 cloves garlic", 0.2).text).toBe("1/2 clove garlic");
  });

  it("keeps a clove that names no garlic whole", () => {
    expect(scale("1 clove", 0.25).text).toBe("1 clove");
  });
});

describe("small things a recipe counts one by one", () => {
  it("keeps a star anise whole", () => {
    expect(scale("1 star anise", 0.5).text).toBe("1 star anise");
  });

  it("keeps a juniper berry whole", () => {
    expect(scale("1 juniper berry", 0.5).text).toBe("1 juniper berry");
  });
});
