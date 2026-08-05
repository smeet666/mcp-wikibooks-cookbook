import { describe, expect, it } from "vitest";
import { runScaleIngredients } from "../../src/tools/scaleIngredients.js";

interface ScaleOut {
  factor: number;
  ingredients: Array<{
    text: string;
    original: string;
    scaling: string;
    amount: number | null;
    amount_max: number | null;
    unit: string | null;
    note?: string;
  }>;
  scaled_count: number;
  rounded_count: number;
  unscaled_count: number;
  notes: string[];
}

const run = (args: Record<string, unknown>) => {
  const result = runScaleIngredients(args as never);
  return { result, out: result.structuredContent as unknown as ScaleOut };
};

describe("scale_ingredients", () => {
  it("computes the factor from a pair of serving counts", () => {
    const { out } = run({ ingredients: ["450 g noodles"], from_servings: 6, to_servings: 4 });
    expect(out.factor).toBe(0.667);
    expect(out.ingredients[0]!.amount).toBe(300);
  });

  it("takes a factor directly", () => {
    const { out } = run({ ingredients: ["450 g noodles"], factor: 2 });
    expect(out.ingredients[0]!.text).toBe("900 g noodles");
  });

  it("applies the factor and says the pair was ignored when both arrive", () => {
    const { out } = run({
      ingredients: ["450 g noodles"],
      factor: 2,
      from_servings: 6,
      to_servings: 4,
    });
    expect(out.factor).toBe(2);
    expect(out.notes.some((note) => note.includes("pair ignored"))).toBe(true);
  });

  it("refuses when neither a factor nor a pair was given", () => {
    const { result } = run({ ingredients: ["450 g noodles"] });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("[invalid_input]");
  });

  it("returns every line in the shape a caller can compare across lists", () => {
    const { out } = run({ ingredients: ["225–500 g butter", "Salt"], factor: 2 });
    for (const entry of out.ingredients) {
      expect(Object.keys(entry)).toEqual(
        expect.arrayContaining(["text", "original", "scaling", "amount", "amount_max", "unit"]),
      );
    }
    // A note is the only optional part, and it is there when there is something
    // to say about the line.
    expect(out.ingredients[0]!.note).toBeUndefined();
    expect(out.ingredients[1]!.note).toContain("No quantity given");
  });

  it("counts what was exact, what was moved and what was left alone", () => {
    const { out } = run({
      ingredients: ["450 g noodles", "5 egg yolks", "Salt", "1 pinch pepper"],
      factor: 2 / 3,
    });
    // The pinch is counted as rounded rather than as left alone: two thirds of
    // a pinch is not a gesture a hand makes, so the line lands on one and says
    // it moved.
    expect(out.scaled_count).toBe(1);
    expect(out.rounded_count).toBe(2);
    expect(out.unscaled_count).toBe(1);
  });

  it("counts only the lines that actually moved as rounded", () => {
    const { out } = run({ ingredients: ["3 eggs"], factor: 2 });
    expect(out.rounded_count).toBe(0);
    expect(out.scaled_count).toBe(1);
  });

  it("keeps a tiny factor visible instead of printing it as zero", () => {
    const { out } = run({ ingredients: ["1 kg flour"], factor: 0.001 });
    expect(out.factor).toBe(0.001);
    expect(result0(out)).toContain("0.001");
  });

  it("says a clamped line no longer holds its share", () => {
    const { out } = run({ ingredients: ["1 onion"], factor: 0.05 });
    expect(out.notes.some((note) => note.includes("clamped up"))).toBe(true);
  });

  it("marks an unadjusted line in the text a client may render on its own", () => {
    const { result } = run({ ingredients: ["Salt"], factor: 2 });
    expect(result.content[0]!.text).toContain("Salt (not adjusted)");
  });

  it("always says the quantities came from this server rather than the page", () => {
    const { out } = run({ ingredients: ["450 g noodles"], factor: 2 });
    expect(out.notes.some((note) => note.includes("recomputed by this server"))).toBe(true);
  });
});

function result0(out: ScaleOut): string {
  return String(out.factor);
}
