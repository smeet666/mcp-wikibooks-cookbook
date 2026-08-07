/**
 * Reading quantities out of English ingredient lines.
 *
 * Recipes are written as prose, not as data: "450 g (1 pound) spaghetti",
 * "225–500 g guanciale", "3 ¼ cups quick oats", "Salt". Everything downstream
 * depends on reading these correctly, so the parser is deliberate about what it
 * recognises and returns nothing rather than guessing.
 */

import type { UnitInfo } from "./units.js";
import { lookupUnit, normalizeUnitKey, readContainerLoad, UNIT_KEYS } from "./units.js";

export interface ParsedQuantity {
  amount: number;
  /** Characters consumed from the start of the line. */
  length: number;
}

/** Unicode vulgar fractions, which recipes use freely. */
const VULGAR_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 1 / 6,
  "⅚": 5 / 6,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const VULGAR_CLASS = Object.keys(VULGAR_FRACTIONS).join("");

/**
 * Read a leading amount.
 *
 * Handles, in order of precedence: a whole number followed by a fraction, in
 * either the glyph form "3 ¼" or the written form "1 1/2"; a bare fraction; a
 * bare glyph; and a decimal. Returns null when the line does not start with a
 * number, which is the normal case for "Salt" or "Freshly ground pepper".
 */
export function parseLeadingQuantity(text: string): ParsedQuantity | null {
  const trimmed = text.trimStart();
  const offset = text.length - trimmed.length;

  // "3 ¼" and "3¼" before the bare "3", so the longest reading wins.
  const mixedGlyph = new RegExp(`^(\\d+)\\s*([${VULGAR_CLASS}])`).exec(trimmed);
  if (mixedGlyph) {
    const whole = Number(mixedGlyph[1]);
    const fraction = VULGAR_FRACTIONS[mixedGlyph[2]!]!;
    return { amount: whole + fraction, length: offset + mixedGlyph[0].length };
  }

  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)/.exec(trimmed);
  if (mixed) {
    const denominator = Number(mixed[3]);
    if (denominator !== 0) {
      return {
        amount: Number(mixed[1]) + Number(mixed[2]) / denominator,
        length: offset + mixed[0].length,
      };
    }
  }

  const fraction = /^(\d+)\s*\/\s*(\d+)/.exec(trimmed);
  if (fraction) {
    const denominator = Number(fraction[2]);
    // A denominator of zero is not a quantity. Reading the numerator alone
    // would leave "/0" in the item name and scale a number nobody wrote.
    if (denominator === 0) return null;
    return { amount: Number(fraction[1]) / denominator, length: offset + fraction[0].length };
  }

  const glyph = trimmed[0];
  if (glyph && glyph in VULGAR_FRACTIONS) {
    return { amount: VULGAR_FRACTIONS[glyph]!, length: offset + 1 };
  }

  const decimal = /^(\d+(?:\.\d+)?)/.exec(trimmed);
  if (decimal) {
    const amount = Number(decimal[1]);
    if (Number.isFinite(amount)) return { amount, length: offset + decimal[0].length };
  }

  const written = parseWrittenFraction(trimmed);
  if (written) return { amount: written.amount, length: offset + written.length };

  return null;
}

/** How many of the part a line names: "two thirds", "a quarter", "half". */
const WRITTEN_NUMERATORS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3 };

/** What the part is a part of. */
const WRITTEN_DENOMINATORS: Record<string, number> = {
  half: 2,
  halves: 2,
  third: 3,
  thirds: 3,
  quarter: 4,
  quarters: 4,
  fourth: 4,
  fourths: 4,
};

/**
 * Read a fraction a line spells out, as in "half a bottle" or "two thirds of a
 * cup".
 *
 * Recipes write the small fractions in words as readily as in figures, and a
 * line opening on one of them carries an amount like any other. The numerator
 * is optional because "half" alone is the common form.
 *
 * What follows decides whether the words are a quantity at all. A share of one
 * thing, "half a lemon" or "two thirds of a cup", states an amount of its own.
 * A share of a definite thing, "half of the dough", points back at an amount
 * stated elsewhere, and multiplying it would answer with a number that belongs
 * to another line.
 */
function parseWrittenFraction(text: string): ParsedQuantity | null {
  const match =
    /^(?:(a|an|one|two|three)[\s-]+)?(halves|half|thirds|third|quarters|quarter|fourths|fourth)\b/i.exec(
      text,
    );
  if (!match) return null;

  const numerator = match[1] ? WRITTEN_NUMERATORS[match[1].toLowerCase()] : 1;
  const denominator = WRITTEN_DENOMINATORS[match[2]!.toLowerCase()];
  if (!numerator || !denominator) return null;

  const rest = text
    .slice(match[0].length)
    .replace(/^\s*of\s+/i, "")
    .trimStart();
  if (!/^an?\s/i.test(rest) && !takeUnit(rest).unit) return null;

  return { amount: numerator / denominator, length: match[0].length };
}

export interface ParsedRange extends ParsedQuantity {
  /** Upper bound. `amount` carries the lower one. */
  max: number;
  /** How the range was written, so the rewrite can keep the same shape. */
  separator: string;
}

/**
 * Read a leading range such as "225–500", "3-4" or "2 to 3".
 *
 * Recipes use ranges where the exact amount is the cook's call, and both bounds
 * describe the same quantity. Reading only the first one is worse than reading
 * neither: the second number survives unscaled into the answer and contradicts
 * it.
 *
 * A descending pair is not a range. "1/2 3" is two amounts the parser has no
 * business joining, and a dash between two numbers is a range only when the
 * second is the larger.
 */
export function parseLeadingRange(text: string): ParsedRange | null {
  const low = parseLeadingQuantity(text);
  if (!low) return null;

  const after = text.slice(low.length);
  // A written separator needs whitespace around it, so "5 tomatoes" is not read
  // as "5 to" followed by an unreadable second bound.
  const separator = /^\s+(to|or)\s+/i.exec(after) ?? /^\s*(–|—|-)\s*/.exec(after);
  if (!separator) return null;

  const high = parseLeadingQuantity(after.slice(separator[0].length));
  if (!high || high.amount <= low.amount) return null;

  return {
    amount: low.amount,
    max: high.amount,
    separator: separator[1]!,
    length: low.length + separator[0].length + high.length,
  };
}

/** One amount with its unit, as the line wrote it. */
export interface Measure {
  amount: number;
  /** Upper bound when the measure is a range, null otherwise. */
  amountMax: number | null;
  /** The word or sign a range was written with. */
  rangeSeparator: string | null;
  unit: UnitInfo | null;
}

export interface ParsedIngredient {
  /** The line exactly as the page publishes it, after wiki markup is flattened. */
  original: string;
  amount: number | null;
  /**
   * Upper bound when the line gives a range, as in "225–500 g". Null for a
   * single amount. `amount` holds the lower bound, so the two must be scaled
   * together: multiplying only one turns "225–500" into the nonsense "450–500".
   */
  amountMax: number | null;
  rangeSeparator: string | null;
  unit: UnitInfo | null;
  /**
   * The same quantity restated in another system, which Cookbook pages give in
   * brackets: "450 g (1 pound)". Left unscaled it would contradict the amount
   * beside it, so it is parsed and scaled with the rest.
   */
  alternates: Measure[];
  /**
   * How the line introduced its equivalents: in brackets, as in "450 g (1
   * pound)", or after a slash, as in "500 g / 1.1 lb". The rewrite puts them
   * back the way the line offered them.
   */
  alternateStyle: "bracket" | "slash" | null;
  /** What the amount and unit apply to, for example "spaghetti" or "egg yolks". */
  item: string;
}

/**
 * Split an ingredient line into amount, unit, bracketed equivalents and item.
 *
 * A missing amount is normal and not an error: many lines are just "Salt". A
 * missing unit is equally normal and means the item is counted, as in "5 egg
 * yolks".
 */
export function parseIngredient(line: string): ParsedIngredient {
  const original = line;
  const text = line.trim();

  const range = parseLeadingRange(text);
  const quantity = range ?? parseLeadingQuantity(text) ?? articleAsOne(text);
  if (!quantity) {
    return {
      original,
      amount: null,
      amountMax: null,
      rangeSeparator: null,
      unit: null,
      alternates: [],
      alternateStyle: null,
      item: text,
    };
  }

  // "two thirds of a cup" names a share of one cup, and the unit stands behind
  // the preposition and the article that introduce it.
  let rest = text
    .slice(quantity.length)
    .trimStart()
    .replace(/^(?:of\s+)?an?\s+/i, "");

  // "2 dozen mushrooms" counts mushrooms, twelve to the dozen, so the multiplier
  // is folded into the amount and the line goes on to be read as the count of a
  // thing it now is.
  const multiplier = readCountMultiplier(rest);
  if (multiplier) rest = multiplier.rest;
  const times = multiplier?.times ?? 1;

  const leading = takeUnit(rest);
  rest = leading.rest;

  const bracketed = takeAlternates(rest);
  rest = bracketed.rest;

  const slashed = bracketed.measures.length > 0 ? null : takeSlashAlternates(rest);
  if (slashed) rest = slashed.rest;

  return {
    original,
    amount: quantity.amount * times,
    amountMax: range === null ? null : range.max * times,
    rangeSeparator: range?.separator ?? null,
    unit: leading.unit,
    alternates: slashed ? slashed.measures : bracketed.measures,
    alternateStyle: slashed ? "slash" : bracketed.measures.length > 0 ? "bracket" : null,
    // "2 heads of garlic" names the same thing as "2 heads garlic", and the
    // preposition only gets in the way of a rewrite.
    //
    // The article goes with it. "2/3 of a bottle" names a share of one bottle,
    // and once the share has been multiplied the count sits where "a" stood.
    // Leaving the article behind produces "4 a bottle", which reads as broken
    // text rather than as a quantity.
    item: rest
      .replace(/^of\s+/i, "")
      .replace(/^an?\s+/i, "")
      .trim(),
  };
}

/**
 * Read the article a line uses in place of the figure one, as in "a pinch of
 * salt" or "an ounce of butter".
 *
 * The article counts as a quantity only when a unit follows it, because that is
 * where it stands for a number: "a pinch" is one pinch, while "a ripe apple"
 * names a fruit and no amount, and reading one as the other would multiply a
 * number the line never wrote.
 */
function articleAsOne(text: string): ParsedQuantity | null {
  const article = /^an?\s+/i.exec(text);
  if (!article) return null;
  const rest = text.slice(article[0].length);
  const counts = takeUnit(rest).unit !== null || readCountMultiplier(rest) !== null;
  return counts ? { amount: 1, length: article[0].length } : null;
}

/**
 * Words that say how many things a number stands for, rather than how much of
 * something one of them holds.
 *
 * A dozen is twelve of whatever is being counted. "2 dozen mushrooms" therefore
 * asks for twenty-four mushrooms, and the answer divides the way a mushroom
 * does. Reading the word as a measure gives "1 1/2 dozen", which is not a count
 * a kitchen works with, and it hands the question of divisibility to a word that
 * names no food.
 */
const COUNT_MULTIPLIERS: Record<string, number> = {
  dozen: 12,
  dozens: 12,
};

/** The multiplier a line opens with, and what stands after it. */
function readCountMultiplier(text: string): { times: number; rest: string } | null {
  const match = /^\s*([A-Za-z]+)\s+/.exec(text);
  if (!match) return null;

  const times = COUNT_MULTIPLIERS[normalizeUnitKey(match[1]!)];
  if (times === undefined) return null;
  return { times, rest: text.slice(match[0].length) };
}

/**
 * Take a unit off the front of `text`, longest spelling first, so "fluid ounce"
 * is not read as "ounce" with "fluid" left dangling in the item name.
 *
 * A word the vocabulary does not carry can still name a measure by naming what
 * holds it, which is what `readContainerLoad` reads off the -ful suffix.
 */
function takeUnit(text: string): { unit: UnitInfo | null; rest: string } {
  const normalized = normalizeUnitKey(text);
  for (const key of UNIT_KEYS) {
    if (normalized !== key && !normalized.startsWith(`${key} `)) continue;
    const wordCount = key.split(" ").length;
    const words = text.split(/\s+/);
    return { unit: lookupUnit(key), rest: words.slice(wordCount).join(" ") };
  }

  const words = text.trimStart().split(/\s+/);
  const load = words[0] ? readContainerLoad(words[0]) : null;
  if (load) return { unit: load, rest: words.slice(1).join(" ") };

  return { unit: null, rest: text };
}

/**
 * Read a bracketed group of equivalent measures, as in "(1 pound)" or
 * "(500 g / 1.1 lb)".
 *
 * The group is only taken when every part of it reads as an amount with a unit.
 * A bracket holding a remark, as in "(the riper the better)", stays in the item
 * text where it belongs, because scaling it would mean scaling prose.
 */
function takeAlternates(text: string): { measures: Measure[]; rest: string } {
  if (!text.startsWith("(")) return { measures: [], rest: text };
  const close = text.indexOf(")");
  if (close < 0) return { measures: [], rest: text };

  const inside = text.slice(1, close);
  const parts = inside.split("/").map((part) => part.trim());
  const measures: Measure[] = [];

  for (const part of parts) {
    const range = parseLeadingRange(part);
    const quantity = range ?? parseLeadingQuantity(part);
    if (!quantity) return { measures: [], rest: text };

    const after = takeUnit(part.slice(quantity.length).trimStart());
    // A trailing word means the bracket is not purely a measure, as in
    // "(1-inch pieces)", so the whole group is left as prose.
    if (!after.unit || after.rest.trim() !== "") return { measures: [], rest: text };

    measures.push({
      amount: quantity.amount,
      amountMax: range?.max ?? null,
      rangeSeparator: range?.separator ?? null,
      unit: after.unit,
    });
  }

  if (measures.length === 0) return { measures: [], rest: text };
  return { measures, rest: text.slice(close + 1).trimStart() };
}

/**
 * Read equivalents a line states after a slash, as in "500 g / 1.1 lb rolled
 * oats", where the item follows the last of them.
 *
 * Both figures name one quantity, so both have to move together: a doubled
 * line reading "1 kg / 1.1 lb" gives two answers a factor of two apart for the
 * same ingredient. A slash followed by anything other than an amount and a
 * unit is prose and stays in the item text.
 */
function takeSlashAlternates(text: string): { measures: Measure[]; rest: string } | null {
  const measures: Measure[] = [];
  let rest = text;

  while (rest.startsWith("/")) {
    const after = rest.slice(1).trimStart();
    const range = parseLeadingRange(after);
    const quantity = range ?? parseLeadingQuantity(after);
    if (!quantity) break;

    const taken = takeUnit(after.slice(quantity.length).trimStart());
    if (!taken.unit) break;

    measures.push({
      amount: quantity.amount,
      amountMax: range?.max ?? null,
      rangeSeparator: range?.separator ?? null,
      unit: taken.unit,
    });
    rest = taken.rest.trimStart();
  }

  return measures.length > 0 ? { measures, rest } : null;
}

export interface FormatAmountOptions {
  /**
   * Whether to snap near-fractions to 1/4, 1/3, 1/2, 2/3 and 3/4.
   *
   * True for things a cook counts or spoons out: "1/3 cup" is how a kitchen
   * expresses it, "0.33 cup" is not. False for mass and volume, which are
   * decimal by nature: nobody weighs "8 1/3 kg" of sugar, they weigh 8.33 kg.
   */
  fractions?: boolean;
}

/** Render an amount the way a recipe would write it. */
export function formatAmount(amount: number, options: FormatAmountOptions = {}): string {
  if (!Number.isFinite(amount)) return "";
  if (Number.isInteger(amount)) return String(amount);

  if (options.fractions === false) return String(Math.round(amount * 100) / 100);

  const whole = Math.floor(amount);
  const rest = amount - whole;
  const known: Array<[number, string]> = [
    [0.25, "1/4"],
    [1 / 3, "1/3"],
    [0.5, "1/2"],
    [2 / 3, "2/3"],
    [0.75, "3/4"],
  ];
  for (const [value, label] of known) {
    if (Math.abs(rest - value) < 0.02) return whole > 0 ? `${whole} ${label}` : label;
  }

  return String(Math.round(amount * 100) / 100);
}
