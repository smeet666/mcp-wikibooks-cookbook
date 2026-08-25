/**
 * What a cook is handed.
 *
 * These assertions come from CONTRACT-RECIPES.md: a countable item lands on a
 * whole or a half, a measurement is demoted before it is rounded so nothing
 * falls to zero, and `scaling` says which of the two happened. Nothing here
 * reads the scaling implementation.
 */

import { describe, expect, it } from "vitest";
import {
  runScaleIngredients,
  scaleIngredientsInput,
  scaleIngredientsOutput,
} from "../../src/tools/scaleIngredients.js";
import {
  EXACT,
  canonical,
  dimensionOf,
  known,
  numbersIn,
  structuredOf,
  textOf,
} from "./spec.helpers.js";
import type { ScaledLine } from "./spec.helpers.js";

function scale(
  ingredients: string[],
  extra: { factor?: number; from_servings?: number; to_servings?: number },
): {
  lines: ScaledLine[];
  structured: Record<string, unknown>;
  text: string;
  isError: boolean;
} {
  const args = scaleIngredientsInput.parse({ ingredients, ...extra });
  const result = runScaleIngredients(args);
  if (result.isError) {
    return { lines: [], structured: {}, text: textOf(result), isError: true };
  }
  const structured = structuredOf(result);
  return {
    lines: structured.ingredients as ScaledLine[],
    structured,
    text: textOf(result),
    isError: false,
  };
}

function one(line: string, factor: number): ScaledLine {
  const { lines } = scale([line], { factor });
  expect(lines).toHaveLength(1);
  return lines[0] as ScaledLine;
}

const HALF_STEP = (value: number) => Math.abs(value * 2 - Math.round(value * 2)) < EXACT;

describe("the shape of every scaled line", () => {
  it("carries exactly the fields the contract names, and nothing invented", () => {
    const { lines } = scale(["450 g (1 pound) flat noodles", "Salt"], { factor: 2 });
    for (const line of lines) {
      const keys = Object.keys(line).sort();
      expect(keys.filter((key) => key !== "note")).toEqual([
        "amount",
        "amount_max",
        "original",
        "scaling",
        "text",
        "unit",
      ]);
      expect(["scaled", "rounded", "unscaled"]).toContain(line.scaling);
      expect(line.amount === null || Number.isFinite(line.amount)).toBe(true);
      expect(line.amount_max === null || Number.isFinite(line.amount_max)).toBe(true);
    }
  });

  it("matches the output schema the tool declares", () => {
    const { structured } = scale(["5 egg yolks", "Salt"], { factor: 2 });
    expect(() => scaleIngredientsOutput.parse(structured)).not.toThrow();
    expect(Object.keys(structured).sort()).toEqual([
      "factor",
      "ingredients",
      "notes",
      "rounded_count",
      "scaled_count",
      "unscaled_count",
    ]);
  });

  it("counts what it says it counts", () => {
    const { lines, structured } = scale(
      ["450 g flat noodles", "5 egg yolks", "Salt", "1 pinch of dried orchard flower"],
      { factor: 0.667 },
    );
    const count = (name: string) => lines.filter((line) => line.scaling === name).length;
    expect(structured.scaled_count).toBe(count("scaled"));
    expect(structured.rounded_count).toBe(count("rounded"));
    expect(structured.unscaled_count).toBe(count("unscaled"));
    expect(
      (structured.scaled_count as number) +
        (structured.rounded_count as number) +
        (structured.unscaled_count as number),
    ).toBe(lines.length);
  });
});

describe("factor 1 changes nothing and claims nothing", () => {
  const lines = ["450 g (1 pound) flat noodles", "5 egg yolks", "½ tablespoon pepper", "Salt"];

  it("returns each line as published", () => {
    const scaled = scale(lines, { factor: 1 }).lines;
    for (const line of scaled) {
      expect(line.text).toBe(line.original);
    }
  });

  it("never reports a line as rounded when nothing moved", () => {
    const scaled = scale(lines, { factor: 1 }).lines;
    for (const line of scaled) {
      expect(line.scaling).not.toBe("rounded");
    }
  });

  it("treats from_servings equal to to_servings the same way", () => {
    const scaled = scale(lines, { from_servings: 6, to_servings: 6 }).lines;
    for (const line of scaled) {
      expect(line.text).toBe(line.original);
    }
  });
});

describe("a line with nothing to multiply", () => {
  it("leaves 'Salt' alone, with no quantity invented", () => {
    const line = one("Salt", 3);
    expect(line.scaling).toBe("unscaled");
    expect(line.text).toBe("Salt");
    expect(line.amount).toBeNull();
    expect(line.amount_max).toBeNull();
    expect(line.unit).toBeNull();
  });

  // This test used to require an approximate quantity to come back untouched.
  // A pinch is an amount, and a line holding one holds a share of the dish that
  // grows with the recipe, so the count of pinches is multiplied. What stays
  // out of the answer is any restatement in spoons, which would be a precision
  // the page never claimed.
  it("multiplies an approximate quantity without restating it in spoons", () => {
    const line = one("1 pinch of dried orchard flower", 4);
    expect(line.scaling).not.toBe("unscaled");
    expect(line.text).toBe("4 pinches dried orchard flower");
    expect(line.text).not.toMatch(/teaspoon|tsp/i);
  });

  it("leaves a line that is only a note alone", () => {
    const line = one("Freshly ground pepper, to taste", 4);
    expect(line.scaling).toBe("unscaled");
    expect(line.text).toBe("Freshly ground pepper, to taste");
  });
});

describe("countable things land where a kitchen can follow", () => {
  it("never hands back a fractional egg", () => {
    const line = one("5 egg yolks", 4 / 6);
    expect(line.scaling).toBe("rounded");
    expect(HALF_STEP(line.amount as number)).toBe(true);
    expect(line.text).not.toMatch(/3\.3/);
    expect(numbersIn(line.text).every(HALF_STEP)).toBe(true);
  });

  it("keeps an exact count exact and calls it scaled", () => {
    const line = one("2 eggs", 1.5);
    expect(line.amount).toBe(3);
    expect(line.scaling).toBe("scaled");
    expect(line.text).toMatch(/\b3\b/);
  });

  it("rounds a large count to a whole or half rather than to a decimal", () => {
    const line = one("5 egg yolks", 200 / 6);
    expect(HALF_STEP(line.amount as number)).toBe(true);
    expect(line.scaling).toBe("rounded");
  });

  it("agrees the noun with the number it now carries", () => {
    expect(one("1 egg", 3).text).toMatch(/\b3 eggs\b/);
    expect(one("2 cloves garlic", 0.5).text).toMatch(/\b1 clove\b/);
  });

  it("never rounds a countable item away to nothing", () => {
    const line = one("2 eggs", 0.1);
    expect(line.amount === null || (line.amount as number) > 0).toBe(true);
    expect(line.text).not.toMatch(/(^|\s)0(\.0+)?\s+egg/);
  });

  // CONTRACT-RECIPES: "A countable item lands on a whole or a half." A quarter
  // is neither, and a quarter of an egg is not something a kitchen produces.
  // Production returns "1/4 egg" with a note saying the line no longer holds
  // its share; the note is honest, but the half it should have landed on would
  // have been both honest and usable.
  it("lands a shrunken countable item on a whole or a half", () => {
    const line = one("2 eggs", 0.1);
    expect(HALF_STEP(line.amount as number)).toBe(true);
  });
});

describe("a measurement is demoted before it is rounded", () => {
  it("does not let a gram quantity fall to zero", () => {
    const line = one("1 g fresh yeast", 0.02);
    expect(line.amount).not.toBeNull();
    expect(line.amount as number).toBeGreaterThan(0);
    expect(line.text).not.toMatch(/(^|\s)0(\.0+)?\s*(g|grams?)\b/);
    expect(canonical(line.amount as number, line.unit)).toBeGreaterThan(0);
  });

  // CONTRACT-RECIPES: "A measurement is demoted to a smaller unit *before*
  // rounding, so a quantity under one never rounds to zero." 0.4 tablespoon is
  // under one, so it belongs in teaspoons: 1.2 teaspoons. Production keeps the
  // published unit and rounds inside it, returning "1/3 tablespoon" with
  // amount 0.33 — a sixth less oil than the share, and a measure no spoon in a
  // kitchen carries. The demotion rule is not a fallback for the zero case; it
  // is what keeps a sub-unit quantity measurable.
  it("moves a fraction of a tablespoon into teaspoons", () => {
    const line = one("4 tablespoons lamp oil", 0.1);
    expect(line.amount as number).toBeGreaterThanOrEqual(1);
    expect(line.unit ?? "").not.toMatch(/tablespoon|tbsp/i);
    // 0.4 tablespoon is the exact share; whatever unit it is stated in, it is
    // the same quantity.
    expect(canonical(line.amount as number, line.unit)).toBeCloseTo(0.4 * 14.786_764_781_25, 6);
  });

  it("keeps the demoted quantity honest about having moved", () => {
    const line = one("1 g fresh yeast", 0.02);
    expect(line.scaling).not.toBe("unscaled");
  });

  it("does not let a millilitre quantity fall to zero", () => {
    const line = one("5 ml vanilla extract", 0.05);
    expect(line.amount as number).toBeGreaterThan(0);
    expect(line.text).not.toMatch(/(^|\s)0(\.0+)?\s*ml\b/);
  });
});

describe("published ranges survive scaling as ranges", () => {
  it("scales both bounds of '225–500 g'", () => {
    const line = one("225–500 g (½–1 pound) salted orchard butter", 2);
    expect(line.amount).not.toBeNull();
    expect(line.amount_max).not.toBeNull();
    expect(canonical(line.amount as number, line.unit)).toBeCloseTo(450, 6);
    expect(canonical(line.amount_max as number, line.unit)).toBeCloseTo(1000, 6);
    expect(line.text).not.toMatch(/225/);
  });

  it("keeps the upper bound above the lower one", () => {
    const line = one("3–4 tablespoons lamp oil", 2);
    expect(line.amount_max as number).toBeGreaterThan(line.amount as number);
    expect(canonical(line.amount as number, line.unit)).toBeCloseTo(6 * 14.786_764_781_25, 6);
    expect(canonical(line.amount_max as number, line.unit)).toBeCloseTo(8 * 14.786_764_781_25, 6);
  });

  it("does not collapse a range into a single number", () => {
    const line = one("225–500 g salted orchard butter", 0.5);
    expect(line.amount_max).not.toBeNull();
    expect(line.amount_max).not.toBe(line.amount);
  });
});

describe("unicode fractions are quantities, not decoration", () => {
  const cases: [string, number, number, string][] = [
    ["½ tablespoon freshly-ground pepper", 2, 1, "tablespoon"],
    ["¾ cup milk", 2, 1.5, "cup"],
    ["⅓ cup water", 3, 1, "cup"],
    ["⅔ cup orchard butter", 3, 2, "cup"],
    ["⅛ teaspoon salt", 8, 1, "teaspoon"],
    ["3 ¼ cups rolled oats", 2, 6.5, "cup"],
  ];

  for (const [line, factor, expected, unit] of cases) {
    it(`reads "${line}" and multiplies it by ${factor}`, () => {
      const scaled = one(line, factor);
      expect(scaled.scaling).not.toBe("unscaled");
      expect(known(scaled.unit)).toBe(true);
      expect(dimensionOf(scaled.unit)).toBe(dimensionOf(unit));
      expect(canonical(scaled.amount as number, scaled.unit)).toBeCloseTo(
        canonical(expected, unit),
        6,
      );
    });
  }

  it("calls an exact fraction result scaled rather than rounded", () => {
    const line = one("⅓ cup water", 3);
    expect(line.scaling).toBe("scaled");
  });
});

describe("two systems on one line stay in agreement", () => {
  it("rescales the bracketed equivalent rather than leaving it to contradict", () => {
    const line = one("450 g (1 pound) flat noodles", 2);
    expect(line.text).not.toMatch(/\(\s*1\s*pound\s*\)/i);
    expect(canonical(line.amount as number, line.unit)).toBeCloseTo(900, 6);
  });

  it("keeps the two figures within a hair of each other after scaling", () => {
    const line = one("450 g (1 pound) flat noodles", 2 / 3);
    const numbers = numbersIn(line.text);
    expect(canonical(line.amount as number, line.unit)).toBeCloseTo(300, 6);
    // The imperial restatement must have moved with the metric one: 1 pound
    // cannot still be printed beside 300 g.
    expect(numbers).not.toContain(1);
    expect(line.text).not.toMatch(/\b1\s*(pound|lb)\b/i);
  });

  // The tool's own description promises that "a bracketed equivalent, as in
  // '450 g (1 pound)', is scaled with the amount it restates rather than left
  // to contradict it". A slash restates the same amount in another system and
  // is the form the Cookbook uses ("500 g / 1.1 lb"). Production scales the
  // first figure only and returns "1 kg / 1.1 lb": two readings of the same
  // ingredient that differ by a factor of two, on one line.
  it("handles a slash-separated triple", () => {
    const line = one("500 g / 1.1 lb rolled oats", 2);
    expect(canonical(line.amount as number, line.unit)).toBeCloseTo(1000, 6);
    expect(line.text).not.toMatch(/\b1\.1\b/);
  });

  // Worse than the wrong figure is the label on it. `scaled` means the
  // arithmetic was exact; this line now carries a quantity that was never
  // multiplied. A caller branching on `scaling` is told it may trust the line.
  it("never calls a line 'scaled' while part of it was left unscaled", () => {
    const line = one("500 g / 1.1 lb rolled oats", 2);
    expect(line.scaling).not.toBe("scaled");
  });

  // The form the Cookbook actually publishes: a cup measure with both systems
  // restated in brackets. Doubling it must move all three figures.
  it("moves every restatement of the same quantity", () => {
    const line = one("3 ¼ cups (500 g / 1.1 lb) rolled oats", 2);
    expect(canonical(line.amount as number, line.unit)).toBeCloseTo(canonical(6.5, "cup"), 4);
    expect(line.text).not.toMatch(/\b500 g\b/);
    expect(line.text).not.toMatch(/\b1\.1 lb\b/);
  });
});

describe("two quantities separated by OR", () => {
  // "2 tablespoons butter OR 30 g margarine" names one ingredient twice. A
  // cook picking the second branch of a doubled recipe gets half of what the
  // dish needs. Production scales the first quantity, leaves the second as
  // published, and labels the line `scaled`.
  it("scales both alternatives", () => {
    const line = one("2 tablespoons butter OR 30 g margarine", 2);
    expect(line.text).toMatch(/\b4\b/);
    expect(line.text).toMatch(/\b60\b/);
    expect(line.text).not.toMatch(/\b2 tablespoons\b/);
    expect(line.text).not.toMatch(/\b30 g\b/);
  });

  it("does not silently keep one half at its published value", () => {
    const line = one("1 teaspoon dried thyme OR 1 tablespoon fresh thyme", 3);
    expect(line.text).not.toMatch(/\b1 teaspoon\b/);
    expect(line.text).not.toMatch(/\b1 tablespoon\b/);
  });

  it("does not call such a line 'scaled'", () => {
    const line = one("2 tablespoons butter OR 30 g margarine", 2);
    expect(line.scaling).not.toBe("scaled");
  });
});

describe("the bounds of the factor", () => {
  it("carries a recipe for 6 up to 200 without losing an ingredient", () => {
    const { lines, structured } = scale(
      ["450 g (1 pound) flat noodles", "5 egg yolks", "1 pinch of dried orchard flower", "Salt"],
      { from_servings: 6, to_servings: 200 },
    );
    expect(structured.factor as number).toBeCloseTo(33.3, 1);
    for (const line of lines) {
      expect(line.text).not.toMatch(/NaN|Infinity/);
      if (line.amount !== null) {
        expect(line.amount).toBeGreaterThan(0);
      }
    }
    const noodles = lines[0] as ScaledLine;
    expect(canonical(noodles.amount as number, noodles.unit)).toBeCloseTo(450 * (200 / 6), 3);
    const yolks = lines[1] as ScaledLine;
    expect(HALF_STEP(yolks.amount as number)).toBe(true);
  });

  it("carries a recipe down by a hundredth without anything vanishing", () => {
    const { lines } = scale(["500 g hard flour", "2 eggs", "5 ml vanilla extract"], {
      factor: 0.01,
    });
    for (const line of lines) {
      expect(line.amount as number).toBeGreaterThan(0);
      expect(line.text).not.toMatch(/(^|\s)0(\.0+)?\s/);
    }
    expect(canonical(lines[0]?.amount as number, lines[0]?.unit ?? null)).toBeCloseTo(5, 6);
  });

  it("prints a tiny factor rather than rounding it to zero", () => {
    const { structured, text } = scale(["500 g hard flour"], { factor: 0.01 });
    expect(structured.factor).not.toBe(0);
    expect(text).not.toMatch(/Factor 0(?![.\d])/);
  });
});

describe("'scaling' tells the truth about the arithmetic", () => {
  /**
   * Each case states the quantity the line must come to, in the unit it is
   * published in. A result equal to that quantity is exact and must be called
   * `scaled`; a result that moved must be called `rounded`. A `scaled` on a
   * value that moved is the one failure this tool cannot afford.
   */
  const cases: Array<{ line: string; factor: number; exact: number; unit: string }> = [
    { line: "450 g flat noodles", factor: 2, exact: 900, unit: "g" },
    { line: "450 g flat noodles", factor: 2 / 3, exact: 300, unit: "g" },
    { line: "178 ml grated hill cheese", factor: 0.5, exact: 89, unit: "ml" },
    { line: "178 ml grated hill cheese", factor: 1 / 3, exact: 178 / 3, unit: "ml" },
    { line: "5 egg yolks", factor: 4 / 6, exact: 5 * (4 / 6), unit: "" },
    { line: "2 eggs", factor: 1.5, exact: 3, unit: "" },
    { line: "3 ¼ cups rolled oats", factor: 2, exact: 6.5, unit: "cup" },
    { line: "250 g hard flour", factor: 0.4, exact: 100, unit: "g" },
    { line: "1 g fresh yeast", factor: 0.02, exact: 0.02, unit: "g" },
  ];

  for (const { line, factor, exact, unit } of cases) {
    it(`"${line}" × ${factor.toFixed(4)} is labelled for what it is`, () => {
      const scaled = one(line, factor);
      expect(scaled.scaling).not.toBe("unscaled");
      const target = unit === "" ? exact : canonical(exact, unit);
      const got =
        scaled.unit === null || unit === ""
          ? (scaled.amount as number)
          : canonical(scaled.amount as number, scaled.unit);
      const moved = Math.abs(got - target) > Math.max(EXACT, Math.abs(target) * 1e-9);
      if (moved) {
        expect(scaled.scaling, `${got} is not ${target}, so this line was rounded`).toBe("rounded");
      } else {
        expect(scaled.scaling, `${got} is exactly ${target}`).toBe("scaled");
      }
    });
  }
});

describe("the arguments the contract names", () => {
  it("computes the factor from from_servings and to_servings", () => {
    const { structured } = scale(["450 g flat noodles"], { from_servings: 6, to_servings: 3 });
    expect(structured.factor).toBe(0.5);
  });

  it("refuses a call carrying neither factor nor the pair", () => {
    const result = runScaleIngredients(
      scaleIngredientsInput.parse({ ingredients: ["450 g flat noodles"] }),
    );
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/invalid_input/);
    expect(result.structuredContent).toBeUndefined();
  });

  it("says which of two conflicting factors it applied", () => {
    const { structured } = scale(["450 g flat noodles"], {
      factor: 2,
      from_servings: 6,
      to_servings: 3,
    });
    expect(structured.factor).toBe(2);
    expect((structured.notes as string[]).join(" ")).toMatch(/factor/i);
  });

  it("puts its notes in the text block a thin client renders", () => {
    const { structured, text } = scale(["5 egg yolks", "Salt"], { factor: 4 / 6 });
    for (const note of structured.notes as string[]) {
      if (text.includes(note)) {
        expect(text).toContain(`Note: ${note}`);
      }
    }
    expect(text).toMatch(/Source: Wikibooks Cookbook/);
  });
});
