/**
 * Abbreviated units carrying a plural mark.
 *
 * A recipe writes "1 tbsp" on one line and "3 tbsps" on the next, and both
 * lines name the same spoon. An abbreviation the vocabulary does not carry
 * falls through to the countable branch, where a spoonful is rounded as though
 * it were an indivisible object: the two neighbouring lines then come back
 * scaled by different rules, and one of them states a measure no kitchen owns.
 */

import { describe, expect, it } from "vitest";
import { scaleIngredient } from "../../src/recipe/scale.js";

const scale = (line: string, factor: number) => scaleIngredient(line, { factor });

describe("a spoon written with a plural mark", () => {
  it("walks down to the smaller spoon, as the singular spelling does", () => {
    expect(scale("1 tbsps sugar", 0.25).text).toBe("3/4 tsp sugar");
  });

  it("scales two neighbouring lines of one page by the same rule", () => {
    const marked = scale("3 tbsps fried shallot", 0.25);
    const plain = scale("3 tbsp fried shallot", 0.25);
    expect(marked.text).toBe(plain.text);
    expect(marked.scaling).toBe(plain.scaling);
    expect(marked.unit).toBe(plain.unit);
  });

  it("halves a spoonful rather than clamping it to a whole one", () => {
    const result = scale("2 tsps salt", 0.25);
    expect(result.amount).toBe(0.5);
    expect(result.unit).toBe("tsp");
    expect(result.text).toBe("1/2 tsp salt");
  });
});

describe("a mass written with a plural mark", () => {
  it("reads the measure and keeps its own spelling of it", () => {
    const result = scale("2 kgs flour", 0.5);
    expect(result.amount).toBe(1);
    expect(result.unit).toBe("kg");
    expect(result.text).toBe("1 kg flour");
  });
});
