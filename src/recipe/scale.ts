/**
 * Scaling ingredient quantities.
 *
 * The guiding rule is that a scaled quantity must be something a cook can act
 * on. Multiplying every number by the factor is arithmetically correct and
 * practically useless: it produces "2.4 eggs" and "0.67 pinch of salt" with the
 * same confidence as "267 g flour". Each line is therefore classified, and the
 * classification travels with the result so the caller can see what was
 * computed and what was left alone.
 *
 * Leaving a line alone is a decision of the same weight. A quantity a recipe
 * states loosely still holds a share of the dish, and a leavening agent left at
 * one pinch for twenty-five servings is a recipe that does not rise.
 */

import { formatAmount, parseIngredient, readBracketedIndication } from "./quantity.js";
import type { BracketedIndication, HeldBack, Measure, ParsedIngredient } from "./quantity.js";
import type { Divisibility, UnitInfo } from "./units.js";
import {
  EMBEDDED_MEASURE,
  QUARTERED_MEASURE,
  approximateEquivalent,
  chooseReadableUnit,
  countsBarePieces,
  demoteUnit,
  formatUnit,
  isSpoonMeasure,
  unitDivisibility,
} from "./units.js";

export type ScalingKind =
  /** The arithmetic was exact. */
  | "scaled"
  /**
   * A countable item was moved to the smallest share a cook takes out of one of
   * it, a whole, a half or a quarter, or a measurement was demoted to a smaller
   * unit to stay usable.
   */
  | "rounded"
  /** The line carries nothing that can be multiplied. */
  | "unscaled";

export interface ScaledIngredient {
  /** The line after scaling, identical to `original` when unscaled. */
  text: string;
  /** The line as published. */
  original: string;
  scaling: ScalingKind;
  /**
   * The scaled quantity, expressed in `unit`, and the lower bound when the line
   * gives a range.
   *
   * Read it together with `unit`, never on its own: a large result is moved to
   * a bigger unit, so scaling "200 g" by ten gives an amount of 2 with a unit
   * of "kg". The bare number can therefore shrink while the quantity grows.
   */
  amount: number | null;
  /** Upper bound when the line gives a range, null otherwise. */
  amountMax: number | null;
  /** The unit `amount` is in, which may differ from the one the recipe used. */
  unit: string | null;
  /** Why the line was rounded, clamped or left alone. */
  note?: string;
}

/**
 * A figure written into a note, where it stands to be compared against the line
 * the note is about.
 *
 * Two decimals is the precision a kitchen reads, and a quantity below that is
 * written with the digits it has instead: a "0" beside an ingredient the recipe
 * still asks for reads as a mistake rather than as a small number.
 */
function noteFigure(value: number): string {
  const shown = formatAmount(Math.round(value * 1000) / 1000, { fractions: false });
  return shown === "0" && value !== 0 ? String(Number(value.toPrecision(2))) : shown;
}

/** Round to a step, keeping two decimals at most. */
function roundTo(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step * 100) / 100;
}

/**
 * Round a measured amount to something a kitchen scale can show.
 *
 * Large amounts do not need fine precision and small ones do, so the step grows
 * with the value rather than being fixed. The step stays a tenth in the single
 * digits because a unit can be a pound as easily as a gram, and rounding 2.2 lb
 * to 2 would throw away a tenth of the ingredient.
 */
function roundMeasured(value: number): number {
  if (value >= 100) return roundTo(value, 5);
  if (value >= 10) return roundTo(value, 1);
  if (value >= 1) return roundTo(value, 0.1);
  return Math.round(value * 100) / 100;
}

/** Below this there is nothing a kitchen can measure out of a spoonful. */
const SMALLEST_USABLE_FRACTION = 0.25;

/** The smallest share of one thing that is still worth putting in a bowl. */
const SMALLEST_USABLE: Record<Divisibility, number> = {
  whole: 1,
  half: 0.5,
  quarter: 0.25,
};

/** True when a number is a whole or a half, to the last bit of precision. */
function isHalfStep(value: number): boolean {
  return Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
}

interface CountableResult {
  value: number;
  /** The floor was hit, so this line no longer holds its share of the recipe. */
  clamped: boolean;
}

/**
 * Round a counted thing to an amount a kitchen produces.
 *
 * A count lands on a whole. The one exception is a share that comes out on a
 * half by itself, for a thing a knife can halve: half a clove of garlic is a
 * real amount, and rounding it up to a whole adds a fifth of the garlic to a
 * recipe that asked for five cloves.
 *
 * How finely the thing divides decides the floor. Under that floor the amount
 * is clamped up rather than shrunk towards nothing, which keeps the ingredient
 * in the recipe at the cost of its proportion, and the caller is told through
 * `clamped`. The ceiling stops a shrinking recipe from ever asking for more
 * than it started with.
 */
function roundCountable(
  value: number,
  divisibility: Divisibility,
  ceiling: number,
): CountableResult {
  if (value <= 0) return { value: 0, clamped: false };

  const floor = SMALLEST_USABLE[divisibility];

  if (divisibility !== "whole" && value >= floor && isHalfStep(value)) {
    return { value, clamped: false };
  }

  if (divisibility === "whole") {
    // Below the halfway mark the nearest whole is none, and dropping the
    // ingredient is worse than overstating it, so the line keeps one and says
    // it no longer holds its share.
    if (value < 0.5) return { value: floor, clamped: true };
    return { value: Math.round(value), clamped: false };
  }

  if (value < floor) return { value: floor, clamped: true };

  if (value < 1) {
    // A knife takes a vegetable to quarters and thirds; anything else offers
    // the half it can be split on.
    const steps = divisibility === "quarter" ? [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1] : [0.5, 1];
    const candidates = steps.filter(
      (candidate) => candidate >= floor && candidate <= Math.max(ceiling, floor),
    );
    let closest = candidates[0]!;
    for (const candidate of candidates) {
      if (Math.abs(value - candidate) < Math.abs(value - closest)) closest = candidate;
    }
    return { value: Math.round(closest * 100) / 100, clamped: false };
  }

  return { value: Math.round(value), clamped: false };
}

/**
 * Round a spoon or a cup, which a kitchen measures out in halves and in the
 * fractions printed on a measuring set.
 */
function roundSpoon(value: number, ceiling: number): CountableResult {
  if (value <= 0) return { value: 0, clamped: false };

  if (value < 1) {
    const candidates = [SMALLEST_USABLE_FRACTION, 1 / 3, 0.5, 2 / 3, 0.75, 1].filter(
      (candidate) => candidate <= Math.max(ceiling, SMALLEST_USABLE_FRACTION),
    );
    let closest = candidates[0]!;
    for (const candidate of candidates) {
      if (Math.abs(value - candidate) < Math.abs(value - closest)) closest = candidate;
    }
    return {
      value: Math.round(closest * 100) / 100,
      clamped: value < SMALLEST_USABLE_FRACTION,
    };
  }

  return { value: roundTo(value, 0.5), clamped: false };
}

/**
 * Walk a spoon or a cup down to the smaller spoon while the amount sits under
 * one, so a share is stated in a measure that exists.
 *
 * An amount already on a whole or a half stays where the line put it: half a
 * tablespoon is a spoon a kitchen owns, and there is nothing to gain by calling
 * it a teaspoon and a half.
 */
function stepDownSpoon(unit: UnitInfo, reference: number): { unit: UnitInfo; ratio: number } {
  let current = unit;
  let ratio = 1;

  while (reference * ratio < 1 && !isHalfStep(reference * ratio)) {
    const step = demoteUnit(current);
    if (!step) break;
    ratio *= step.per;
    current = step.unit;
  }

  return { unit: current, ratio };
}

/**
 * How close a result has to be to the exact product to be called exact.
 *
 * Two tests, because one of them alone is wrong at some scale. An absolute gap
 * of a hundredth is beneath what a kitchen resolves at ordinary sizes, and at a
 * hundredth of a millilitre it is the whole quantity: 0.006 rounded to 0.01 sits
 * inside the absolute gap while being two thirds larger than what was asked for.
 * A share of half a percent catches that without calling ordinary rounding
 * inexact.
 */
const EXACT_WITHIN = 0.01;
const EXACT_SHARE = 0.005;

function landedExactly(exact: number, amount: number): boolean {
  const gap = Math.abs(exact - amount);
  if (gap > EXACT_WITHIN) return false;
  return exact === 0 || gap / Math.abs(exact) <= EXACT_SHARE;
}

export interface ScaleOptions {
  /** Multiplier applied to the quantities. */
  factor: number;
}

interface ScaledBound {
  amount: number;
  /** The exact product, expressed in the unit that came back. */
  exact: number;
  clamped: boolean;
  /** The exact product in the unit the recipe wrote, for a readable note. */
  raw: number;
}

interface ScaledMeasure {
  bounds: ScaledBound[];
  /** The unit every bound is expressed in, which both ends of a range share. */
  unit: UnitInfo | null;
}

/**
 * Scale one measure, both ends of a range together.
 *
 * A measurement walks down to a smaller unit before it is rounded, so a
 * quantity divided a thousandfold never rounds to zero and states that the
 * recipe needs none of it.
 */
function scaleMeasure(
  low: number,
  high: number | null,
  unit: UnitInfo | null,
  factor: number,
  divisibility: Divisibility,
): ScaledMeasure {
  const raws = high === null ? [low * factor] : [low * factor, high * factor];
  const sources = high === null ? [low] : [low, high];
  /**
   * The unit is chosen from the smaller end of a range.
   *
   * Both ends have to share one unit, or "½ to 1 pound" comes back as "13 oz to
   * 1.5 pounds", where the second number reads smaller than the first. Of the
   * two, the smaller end is the one a unit can ruin: choosing from the larger
   * turns "450 to 1000 g" into "0.45 to 1 kg", and pushed one step further it
   * rounds the small end away entirely. A large number in a small unit is
   * merely long to read.
   */
  const positive = raws.filter((raw) => raw > 0);
  const reference = positive.length > 0 ? Math.min(...positive) : raws[0]!;

  /** Both bounds share one unit, and each keeps the precision that unit affords. */
  const inUnit = (target: UnitInfo, ratio: number): ScaledMeasure => ({
    bounds: raws.map((raw, index) => {
      const exact = raw * ratio;
      // The rounding happens in the smaller of the two units, so moving to a
      // bigger one never throws away precision the page wrote: 1666 g rounded
      // as kilos is 1.7, and rounded as grams it is the 1.665 kg a scale shows.
      const rounded =
        ratio < 1 ? Number((roundMeasured(raw) * ratio).toPrecision(12)) : roundMeasured(exact);
      // At the bottom of a ladder, keep what precision is left rather than
      // deleting the ingredient.
      const usable = rounded === 0 && exact > 0 ? Number(exact.toPrecision(2)) : rounded;
      // Rounding to a step of five grams above a hundred can round upwards, and
      // a recipe being made smaller must never come out asking for more than
      // the page published.
      const ceiling = factor < 1 ? sources[index]! * ratio : Number.POSITIVE_INFINITY;
      return {
        amount: Math.min(usable, ceiling),
        exact,
        clamped: false,
        raw,
      };
    }),
    unit: target,
  });

  if (unit && unit.kind === "measured") {
    const chosen = chooseReadableUnit(unit, reference);
    return inUnit(chosen.unit, chosen.ratio);
  }

  if (unit && isSpoonMeasure(unit)) {
    const stepped = stepDownSpoon(unit, reference);
    // The bottom of the ladder is reached with the amount still under what the
    // smallest spoon holds, and the floor is what keeps the ingredient in the
    // recipe instead of stating a share no measuring set can produce.
    const underFloor = reference * stepped.ratio < SMALLEST_USABLE_FRACTION;
    // A share stated in the smaller spoon is a measurement, and keeps the
    // precision of one rather than being snapped to the fractions of a spoon
    // it no longer fills.
    if (stepped.ratio !== 1 && !underFloor) return inUnit(stepped.unit, stepped.ratio);

    const ratio = underFloor ? stepped.ratio : 1;
    const bounds = raws.map((raw, index) => {
      const exact = raw * ratio;
      const ceiling = factor < 1 ? sources[index]! * ratio : Number.POSITIVE_INFINITY;
      const rounded = roundSpoon(exact, ceiling);
      return { amount: rounded.value, exact, clamped: rounded.clamped, raw };
    });
    return { bounds, unit: underFloor ? stepped.unit : unit };
  }

  const bounds = raws.map((raw, index) => {
    // Scaling down must never end up asking for more than the recipe did.
    const ceiling = factor < 1 ? sources[index]! : Number.POSITIVE_INFINITY;
    const rounded = roundCountable(raw, divisibility, ceiling);
    return { amount: rounded.value, exact: raw, clamped: rounded.clamped, raw };
  });
  return { bounds, unit };
}

/**
 * How finely a counted thing divides, decided by the size of one of them
 * against what a recipe puts in.
 *
 * `PORTION_SIZED_ITEM` and `QUARTERED_ITEM` are the two ends of that one
 * comparison, and each entry earns its place by where the food falls on it.
 *
 * A shrimp, a mussel, a hazelnut, a peppercorn, a juniper berry, a star anise
 * is already a portion on its own. A recipe counts five, twelve, twenty of
 * them, and a cook taking a share of that recipe puts one fewer in the pan;
 * cutting one in two is not a thing a kitchen does. These land on a whole
 * number.
 *
 * A leg of lamb, a baguette, a camembert, a pineapple, an onion, a watermelon,
 * a guinea fowl sits at the other end: a recipe asks for one or for two, and
 * the share it wants out of one is decided by a knife. A quarter of one is a
 * piece someone serves, and what is left keeps.
 */
const PORTION_SIZED_ITEM =
  /\b(shrimps?|prawns?|langoustines?|mussels?|hazelnuts?|peppercorns?|junipers?|grains?|anise)\b/i;

const QUARTERED_ITEM =
  /\b(onions?|shallots?|potatoes|potato|carrots?|apples?|pears?|lemons?|limes?|oranges?|tomato(?:es)?|cucumbers?|courgettes?|zucchinis?|aubergines?|eggplants?|squash(?:es)?|pumpkins?|cabbages?|melons?|watermelons?|peppers?|beets?|turnips?|parsnips?|leeks?|bananas?|mango(?:e?s)?|legs? of lamb|lamb legs?|baguettes?|camemberts?|cheeses?|chorizos?|pineapples?|peach(?:es)?|apricots?|milk|chickens?|guinea fowls?|avocados?|roasts?)\b/i;

/**
 * A juice, the one counted thing whose division stops at the half.
 *
 * Half the juice of a lemon is taken by squeezing half the fruit, which is a
 * step a recipe writes. A quarter of one has to be poured out and measured
 * back, and no recipe asks for that.
 *
 * It reads before the fruit, which a knife divides further on its own.
 */
const HALVED_ITEM = /\bjuices?\b/i;

/**
 * Things a kitchen takes one of or none of.
 *
 * An egg comes out of its shell whole, and so does the yolk or the white a
 * recipe asks for on its own: half of one would have to be beaten and weighed,
 * which is not an amount any recipe asks for and not one a cook can keep the
 * rest of. A count of them therefore lands on a whole number, whichever side of
 * the half the arithmetic fell on.
 *
 * A zest belongs here for a reason the criterion cannot reach on its own: it is
 * what comes off one fruit in one go. A line asking for the zest of a lemon is
 * asking for all of it, and a share of a zest names no amount a cook stops at.
 */
const WHOLE_ITEM = /\b(eggs?|yolks?|egg\s+whites?|zests?)\b/i;

/**
 * A piece carved off a bird or off a joint, which stops at the half.
 *
 * The whole animal divides by the knife that portions it, and one of these is
 * already the portion that knife produced: a breast feeds one, and half of one
 * is the share a smaller recipe serves. Taking a quarter would name a piece no
 * one plates.
 *
 * It reads before the animal, and before the fruit or the vegetable a line
 * often names beside the meat, so that neither answers for the cut.
 */
const HALVED_CUT = /\b(breasts?|thighs?|drumsticks?|wings?|cutlets?|escalopes?)\b/i;

/**
 * How far a "clove" divides, when a line counts one.
 *
 * The word names two foods that answer the question in opposite ways. A clove
 * of garlic is a wedge broken off a bulb, and the share of one a recipe asks
 * for is the half a knife makes of it. A clove on its own is the dried flower
 * bud, dropped into the pot and fished back out of it: nothing about it is
 * measured, so there is no share of one to take.
 *
 * Garlic named in the line is what separates the two, and that is how the great
 * majority of lines writing the word say which food they mean.
 *
 * The question is asked only where the clove is the thing being counted. A head
 * of garlic that mentions its cloves is a head, and divides as one.
 *
 * Null when the line counts no clove at all.
 */
function cloveDivisibility(unit: UnitInfo | null, item: string): Divisibility | null {
  const counted = unit ? unit.canonical === "clove" : /\bcloves?\b/i.test(item);
  if (!counted) return null;
  return /\bgarlic\b/i.test(item) ? "half" : "whole";
}

function divisibilityOf(unit: UnitInfo | null, item: string): Divisibility {
  const clove = cloveDivisibility(unit, item);
  if (clove) return clove;
  if (unit && !countsBarePieces(unit)) return unitDivisibility(unit);
  if (WHOLE_ITEM.test(item)) return "whole";
  if (PORTION_SIZED_ITEM.test(item)) return "whole";
  if (HALVED_ITEM.test(item)) return "half";
  if (HALVED_CUT.test(item)) return "half";
  if (QUARTERED_MEASURE.test(item)) return "quarter";
  return QUARTERED_ITEM.test(item) ? "quarter" : "half";
}

/**
 * Make a counted item agree with its number, in both directions.
 *
 * English marks the plural above one, so "5 egg yolks" divided reads "1 egg
 * yolk" and "1 loaf" tripled reads "3 loaves". Only the head noun is touched,
 * which is the last word before any comma: everything after a comma is
 * preparation, and "cloves garlic, minced" must not become "minceds".
 *
 * "of" moves the head to the left of it. What is being counted in "bottles of
 * orange blossom water" is the bottles, and the number says nothing about the
 * water.
 */
export function agreeWithAmount(item: string, amount: number): string {
  if (!item) return item;

  const comma = item.indexOf(",");
  const head = comma < 0 ? item : item.slice(0, comma);
  const tail = comma < 0 ? "" : item.slice(comma);

  const preposition = / of /i.exec(head);
  if (preposition) {
    const counted = agreeWithAmount(head.slice(0, preposition.index), amount);
    return `${counted}${head.slice(preposition.index)}${tail}`;
  }

  const words = head.trimEnd().split(" ");
  const last = words[words.length - 1] ?? "";
  if (!/^[A-Za-z]+$/.test(last) || last.length <= 2) return item;

  const wantsPlural = amount > 1;
  const plural = toPlural(last);
  const singular = toSingular(last);
  const isPlural = last.toLowerCase() !== singular.toLowerCase();

  if (wantsPlural && !isPlural) words[words.length - 1] = plural;
  else if (!wantsPlural && isPlural) words[words.length - 1] = singular;
  else return item;

  return `${words.join(" ")}${tail}`;
}

/**
 * Names of food that read the same whatever the number.
 *
 * Some are mass nouns a recipe counts in spoons rather than in units, and some
 * are plurals already. An -s added to one of them names a thing no shop sells.
 */
const INVARIABLE_ITEM = new Set([
  "anise",
  "asparagus",
  "bacon",
  "basil",
  "beef",
  "bison",
  "broccoli",
  "butter",
  "celery",
  "cilantro",
  "citrus",
  "cinnamon",
  "cocoa",
  "cod",
  "coriander",
  "corn",
  "cornstarch",
  "couscous",
  "cream",
  "deer",
  "fish",
  "flour",
  "garlic",
  "ginger",
  "ham",
  "honey",
  "hummus",
  "kale",
  "lamb",
  "macaroni",
  "milk",
  "miso",
  "musk",
  "moose",
  "mutton",
  "nutmeg",
  "oil",
  "okra",
  "oregano",
  "parsley",
  "pasta",
  "pork",
  "quinoa",
  "rice",
  "rosemary",
  "saffron",
  "salmon",
  "salt",
  "shrimp",
  "spinach",
  "squid",
  "sugar",
  "thyme",
  "tofu",
  "trout",
  "tuna",
  "vanilla",
  "veal",
  "venison",
  "vinegar",
  "water",
  "yeast",
  "yogurt",
]);

/** Names whose plural the ordinary rules get wrong. */
const IRREGULAR_PLURAL: Record<string, string> = {
  calf: "calves",
  chili: "chilies",
  chilli: "chillies",
  goose: "geese",
  half: "halves",
  knife: "knives",
  leaf: "leaves",
  loaf: "loaves",
  mango: "mangoes",
  potato: "potatoes",
  shelf: "shelves",
  tomato: "tomatoes",
};

const IRREGULAR_SINGULAR: Record<string, string> = Object.fromEntries(
  Object.entries(IRREGULAR_PLURAL).map(([one, many]) => [many, one]),
);

/** Keep the capitalisation the line used while looking the word up in lower case. */
function matchCase(source: string, replacement: string): string {
  if (source[0] === source[0]?.toUpperCase() && source.slice(1) === source.slice(1).toLowerCase()) {
    return replacement[0]!.toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function toPlural(word: string): string {
  const key = word.toLowerCase();
  if (INVARIABLE_ITEM.has(key)) return word;
  const irregular = IRREGULAR_PLURAL[key];
  if (irregular) return matchCase(word, irregular);
  if (/(?:ch|sh|s|x|z)$/i.test(word)) return `${word}es`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(?:[^f]f|fe)$/i.test(word)) return `${word.replace(/fe?$/i, "")}ves`;
  return `${word}s`;
}

function toSingular(word: string): string {
  const key = word.toLowerCase();
  if (INVARIABLE_ITEM.has(key)) return word;
  const irregular = IRREGULAR_SINGULAR[key];
  if (irregular) return matchCase(word, irregular);
  if (/ies$/i.test(word) && word.length > 4) return `${word.slice(0, -3)}y`;
  // A -ves plural belongs to a noun ending in -f or -fe, and those are named
  // one by one in `IRREGULAR_PLURAL`: turning every -ves back into -f makes a
  // "clof" out of "cloves" and an "olif" out of "olives".
  if (/(?:ch|sh|s|x|z)es$/i.test(word)) return word.slice(0, -2);
  // "glass", "molasses": the -s belongs to the singular. Beyond the doubled -s
  // the ending settles nothing, "couscous" and "kiwis" both closing on -us, so
  // the names that carry their -s are named in `INVARIABLE_ITEM`.
  if (/ss$/i.test(word)) return word;
  if (/s$/i.test(word)) return word.slice(0, -1);
  return word;
}

/** How a line writes the choice between two quantities: "2 Tbsp butter OR 30 g margarine". */
const BRANCH_SEPARATOR = /\s+or\s+/gi;

/**
 * The same choice written inside brackets: "4 eggs (or 8 egg yolks)".
 *
 * The bracket is what hides it from a rule looking for a bare "or": nothing
 * separates the word from the text before it but the opening bracket.
 */
const BRACKETED_BRANCH = /\s*\((?:or|alternatively)[,]?\s+/gi;

interface Branch {
  head: string;
  /** The separator as published, so the rewrite reads the way the line did. */
  separator: string;
  tail: string;
  /** What closes the choice and follows it, empty when the line ends on it. */
  close: string;
}

/**
 * Split a line that offers one ingredient twice, at the word that offers the
 * choice.
 *
 * The search starts where the item name starts, so the "or" of a published
 * range such as "2 or 3 cloves garlic" is left to the range parser. A branch
 * counts only when it carries a quantity of its own; "butter or margarine"
 * names one amount and stays one line.
 */
function splitBranch(text: string, parsed: ParsedIngredient): Branch | null {
  const itemStart = parsed.item ? text.indexOf(parsed.item) : text.length;
  if (itemStart < 0) return null;

  BRANCH_SEPARATOR.lastIndex = 0;
  for (let match = BRANCH_SEPARATOR.exec(text); match; match = BRANCH_SEPARATOR.exec(text)) {
    if (match.index < itemStart) continue;
    const tail = text.slice(match.index + match[0].length);
    if (parseIngredient(tail).amount === null) continue;
    return { head: text.slice(0, match.index), separator: match[0], tail, close: "" };
  }

  BRACKETED_BRANCH.lastIndex = 0;
  for (let match = BRACKETED_BRANCH.exec(text); match; match = BRACKETED_BRANCH.exec(text)) {
    if (match.index < itemStart) continue;
    const opens = match.index + match[0].length;
    const closes = text.indexOf(")", opens);
    if (closes < 0) continue;
    const tail = text.slice(opens, closes);
    if (parseIngredient(tail).amount === null) continue;
    return {
      head: text.slice(0, match.index),
      separator: match[0],
      tail,
      close: text.slice(closes),
    };
  }
  return null;
}

/**
 * Scale one ingredient line.
 *
 * Countable items are rounded to something a kitchen can measure, ranges are
 * scaled at both ends, equivalents and alternatives are scaled with the amount
 * they stand beside, and an approximate measure such as a pinch has its count
 * scaled with a note saying how loosely one of them is defined.
 */
export function scaleIngredient(line: string, options: ScaleOptions): ScaledIngredient {
  const { factor } = options;
  // A factor of one changes nothing, and rewriting the line anyway would round
  // "178 ml" to "180 ml" and report a difference the caller never asked for.
  if (factor === 1) return passthroughIngredient(line);

  const text = line.trim();
  const branch = splitBranch(text, parseIngredient(text));
  if (branch) return scaleBranchedLine(line, branch, options);

  return scaleSingleLine(line, options);
}

/**
 * Scale a line that offers a choice, one branch at a time.
 *
 * A cook follows one branch and ignores the other, so both have to carry the
 * same share of the recipe: a doubled line whose second branch still reads as
 * published hands whoever takes it half the ingredient. The two branches name
 * different things, and how far one stands for the other is the page's claim
 * rather than arithmetic, so such a line is never reported as exact.
 */
function scaleBranchedLine(line: string, branch: Branch, options: ScaleOptions): ScaledIngredient {
  const head = scaleSingleLine(branch.head, options);
  if (head.scaling === "unscaled") return { ...head, text: line.trim(), original: line };

  const tail = scaleAlternative(branch.tail, options);
  const result: ScaledIngredient = {
    ...head,
    original: line,
    text: `${head.text}${branch.separator}${tail.text}${branch.close}`,
    scaling: "rounded",
  };

  const branchNote = tail.rewritten
    ? "This line offers a choice between two quantities, and each was scaled on its own. " +
      "How far one stands for the other is the page's own claim."
    : "This line carries a further quantity after the first one, and only the first was scaled. " +
      "Read the rest as published.";
  // What the branch itself could not carry is said here too. A branch reading
  // "1½ cup cream + 1½ cup water" holds two amounts and only the first moves,
  // and the cook who takes that branch is the one who cannot see it.
  result.note = joinNotes(head.note, branchNote, tail.note);

  return result;
}

/**
 * Put notes together, saying each sentence once.
 *
 * A branch carries its own reading of the same line, so the branch and the
 * whole often have the same thing to say. Repeated, the sentence reads as two
 * separate findings and the caller counts a problem twice.
 */
function joinNotes(...notes: Array<string | undefined>): string {
  const seen: string[] = [];
  for (const note of notes) {
    if (note === undefined) continue;
    for (const sentence of note.split(/(?<=\.)\s+/)) {
      const trimmed = sentence.trim();
      if (trimmed !== "" && !seen.includes(trimmed)) seen.push(trimmed);
    }
  }
  return seen.join(" ");
}

/**
 * Scale the branch a line offers as an alternative, when it can be stated in
 * the unit the line offered it in.
 *
 * Under one of that unit the branch would have to be restated in another
 * measure, which changes the shape of the choice the cook is being handed, so
 * it keeps its published wording and the line says that it did.
 */
function scaleAlternative(
  tail: string,
  options: ScaleOptions,
): { text: string; rewritten: boolean; note?: string } {
  const parsed = parseIngredient(tail);
  const published = tail.trim();
  if (parsed.amount === null) return { text: published, rewritten: false };

  const largest = (parsed.amountMax ?? parsed.amount) * options.factor;
  if (largest < 1) return { text: published, rewritten: false };

  const scaled = scaleIngredient(tail, options);
  return scaled.note === undefined
    ? { text: scaled.text, rewritten: true }
    : { text: scaled.text, rewritten: true, note: scaled.note };
}

/** Why a line showing a figure came back as the page published it. */
const HELD_BACK_NOTE: Record<HeldBack, string> = {
  sizeQualifier:
    "The figures here give the size of one item rather than how many, so the line is " +
    "left as published.",
  perPerson:
    "This line already states an amount for one person, and the factor is what changes " +
    "how many people the recipe serves, so the line is left as published.",
  ambiguousDecimal:
    "The comma in this number marks thousands in one convention and the decimal point in " +
    "another, and the line gives no sign which was meant, so it is left as published.",
};

/** What a line says when its only figure is the indication it puts in brackets. */
const INDICATION_NOTE =
  "This line asks for no fixed amount and gives an indication in brackets of how much that " +
  "usually comes to.";

/**
 * Scale a line whose only quantity is the indication it states in brackets.
 *
 * The head of such a line tells the cook how to decide and never how much, so
 * it is left word for word; the figure beside it is a quantity like any other
 * and grows with the recipe. Left alone it would put the water of a doubled
 * dough at half what the flour needs.
 */
function scaleBracketedIndication(
  parsed: ParsedIngredient,
  indication: BracketedIndication,
  factor: number,
): ScaledIngredient {
  const text = parsed.readable;
  const scaled = renderMeasure(indication.measure, factor);
  const bound = scaled.bounds[0]!;

  return {
    text: `${text.slice(0, indication.start)}(${indication.lead}${scaled.text})${text.slice(indication.end)}`,
    original: parsed.original,
    scaling: scaled.bounds.every((entry) => landedExactly(entry.exact, entry.amount))
      ? "scaled"
      : "rounded",
    amount: bound.amount,
    amountMax: scaled.bounds[1]?.amount ?? null,
    unit: indication.measure.unit?.canonical ?? null,
    note: `${INDICATION_NOTE} That indication was scaled with the recipe; the wording in front of it is what the page asks for.`,
  };
}

function scaleSingleLine(line: string, options: ScaleOptions): ScaledIngredient {
  const { factor } = options;
  const parsed = parseIngredient(line);

  if (parsed.amount === null && parsed.heldBack === null) {
    const indication = readBracketedIndication(parsed.readable);
    if (indication) return scaleBracketedIndication(parsed, indication, factor);
  }

  if (parsed.amount === null || parsed.heldBack) {
    return {
      text: parsed.original,
      original: parsed.original,
      scaling: "unscaled",
      amount: null,
      amountMax: null,
      unit: null,
      note: parsed.heldBack
        ? HELD_BACK_NOTE[parsed.heldBack]
        : "No quantity given; adjust to taste.",
    };
  }

  const divisibility = divisibilityOf(parsed.unit, parsed.item);
  const primary = scaleMeasure(parsed.amount, parsed.amountMax, parsed.unit, factor, divisibility);
  const alternates = parsed.alternates.map((measure) => renderMeasure(measure, factor));

  const primaryBounds = primary.bounds;
  const alternateBounds = alternates.flatMap((entry) => entry.bounds);
  const movedPrimary = primaryBounds.some((b) => !landedExactly(b.exact, b.amount));
  const movedAlternate = alternateBounds.some((b) => !landedExactly(b.exact, b.amount));
  const clamped = [...primaryBounds, ...alternateBounds].find((bound) => bound.clamped) ?? null;
  // Two figures beside each other agree only as closely as the page wrote
  // them, and multiplying both keeps that gap rather than closing it.
  const restated = parsed.alternateStyle === "slash";

  const low = primaryBounds[0]!;
  const high = primaryBounds[1] ?? null;
  const unit = primary.unit;
  const shown = high?.amount ?? low.amount;
  const asText = (value: number) => formatAmount(value, { fractions: unit?.kind !== "measured" });

  // A range whose two ends land on the same amount stopped being a range. "1 to
  // 1 clove" is not something a cook reads, so the line states the one amount
  // both ends came to.
  const collapsed = high !== null && high.amount === low.amount;
  const amountText = renderRange(
    asText(low.amount),
    high === null || collapsed ? null : asText(high.amount),
    parsed.rangeSeparator,
  );
  // "ea" announces that the figure counts pieces, and names no measure of them,
  // so the line reads as the count of the thing itself and the marker has
  // nothing to say in it.
  const named = unit && !countsBarePieces(unit) ? unit : null;
  // The size word the page put in front of its measure goes back in front of
  // it: the page asked for a small handful, and a handful is not the same ask.
  const adjective = named && parsed.measureAdjective ? ` ${parsed.measureAdjective}` : "";
  const unitLabel = named ? `${adjective} ${formatUnit(named, shown)}` : "";
  const alternateTexts = alternates.map((entry) => entry.text);
  // Equivalents go back the way the line offered them: inside brackets, or
  // after a slash beside the amount they restate.
  const altLabel =
    alternates.length === 0
      ? ""
      : parsed.alternateStyle === "slash"
        ? ` / ${alternateTexts.join(" / ")}`
        : ` (${alternateTexts.join(" / ")})`;
  // A counted item agrees with its number: "1 egg yolk", "3 loaves".
  const item = named ? parsed.item : agreeWithAmount(parsed.item, shown);
  const itemLabel = item ? ` ${item}` : "";

  const result: ScaledIngredient = {
    text: `${parsed.approximation ?? ""}${amountText}${unitLabel}${altLabel}${itemLabel}`.trim(),
    original: parsed.original,
    scaling: movedPrimary || movedAlternate || restated ? "rounded" : "scaled",
    amount: low.amount,
    amountMax: collapsed ? null : (high?.amount ?? null),
    unit: named?.canonical ?? null,
  };

  /**
   * The exact product, written for a note.
   *
   * Decimals rather than kitchen fractions: this number exists to be compared
   * against the one on the line, and a fraction snapped from 0.32 to "1/3"
   * reads as the exact product while being a different number.
   */
  const asPublished = (value: number, source: UnitInfo | null) =>
    `${noteFigure(value)}${source ? ` ${formatUnit(source, value)}` : ""}`;

  const sentences: string[] = [];

  if (clamped) {
    // Both figures are stated in the unit the line now reads in, `exact` being
    // the product expressed there, so the note and the line can be compared.
    sentences.push(
      `Clamped up to ${formatAmount(clamped.amount)} from ` +
        `${noteFigure(clamped.exact)}, the smallest amount worth ` +
        "measuring. This line no longer holds its share of the recipe.",
    );
  } else if (movedPrimary) {
    // Every bound that moved is named, with the direction it moved in. On a
    // range the two ends can move opposite ways, and reporting one of them as
    // though it spoke for both states the wrong direction for half the
    // quantity.
    const moved = primaryBounds.filter((bound) => !landedExactly(bound.exact, bound.amount));
    sentences.push(
      moved
        .map(
          (bound) =>
            `Rounded ${bound.amount > bound.exact ? "up" : "down"} from ` +
            `${asPublished(bound.raw, parsed.unit)}.`,
        )
        .join(" "),
    );
  } else if (movedAlternate) {
    // The amount itself came out exact, and only the equivalent beside it had
    // to move. Saying "rounded from 300 g" when 300 g is exact would send a
    // cook looking for an error that is not there.
    sentences.push(
      `The amount is exact; the equivalent ${
        restated ? "beside it" : "in brackets"
      } was rounded to stay readable.`,
    );
  } else if (restated) {
    sentences.push(
      "This line states one quantity twice, and both readings were scaled. " +
        "They agree as closely as the page wrote them, and no closer.",
    );
  }

  // A line can offer a substitute with its own amount, as in "1 Tbsp vanilla
  // sugar OR 1 tsp vanilla extract". Only the amount the line opens with is
  // scaled, and a substitute left at its published size contradicts it. This is
  // said whatever else happened to the line: a line that was also rounded is the
  // one where a stale second quantity is hardest to spot.
  if (EMBEDDED_MEASURE.test(parsed.item)) {
    sentences.push(
      "This line carries a further quantity after the first one, and only the first was scaled. " +
        "Read the rest as published.",
    );
  }

  if (collapsed) {
    sentences.push("The page gave a range, and at this size both ends come to the same amount.");
  }

  // Below what any scale shows, the arithmetic is right and the kitchen cannot
  // follow it. Saying so is the difference between an answer and a number.
  if (unit?.kind === "measured" && low.amount > 0 && low.amount < 0.05) {
    sentences.push(
      "This is smaller than a kitchen scale resolves. Make a larger batch, or measure it by eye.",
    );
  }

  // The page put the amount forward as loose, and multiplying it keeps it that
  // way: the answer is as approximate as the figure it came from.
  if (parsed.approximation) {
    sentences.push(
      "The page gave this amount as an approximation, and the scaled figure is no firmer.",
    );
  }

  if (sentences.length > 0) result.note = sentences.join(" ");

  if (parsed.unit && parsed.unit.kind === "approximate") {
    result.note = withApproximateNote(parsed.unit, result.note);
  }

  // A line that wrote its amount as a word says which word it was, so a caller
  // can see the figure came from the grammar rather than from a digit.
  if (parsed.articleWord) {
    // `amount` carries the product once a word such as "dozen" has multiplied
    // it, and quoting that back would credit the article with a figure it never
    // gave.
    const stood = (parsed.amount ?? 0) / (parsed.countMultiplier ?? 1);
    const read = `"${parsed.articleWord}" read as ${formatAmount(stood)}.`;
    result.note = result.note ? `${read} ${result.note}` : read;
  }

  return result;
}

/**
 * Say that a measure is held to no better than the hand that produces it, and
 * what a kitchen usually takes one to be.
 *
 * The equivalence belongs in the note. A recipe that asks for four pinches of
 * baking soda has said nothing about teaspoons, and answering in teaspoons
 * would hand back a figure with a precision the page never claimed. The
 * quantity stays in the unit the line used, and the count is what carries the
 * scaling.
 */
function withApproximateNote(unit: UnitInfo, existing: string | undefined): string {
  const equivalence = approximateEquivalent(unit);
  const sentence =
    `A ${unit.canonical} is an approximate measure${equivalence ? `, ${equivalence}` : ""}. ` +
    "The count was scaled and the size of one is the cook's.";
  return existing ? `${existing} ${sentence}` : sentence;
}

/** Scale an equivalent the line states beside the amount, and render it the way the line wrote it. */
function renderMeasure(measure: Measure, factor: number): { text: string; bounds: ScaledBound[] } {
  const scaled = scaleMeasure(
    measure.amount,
    measure.amountMax,
    measure.unit,
    factor,
    divisibilityOf(measure.unit, ""),
  );
  const low = scaled.bounds[0]!;
  const high = scaled.bounds[1] ?? null;
  const unit = scaled.unit;
  const shown = high?.amount ?? low.amount;
  const asText = (value: number) => formatAmount(value, { fractions: unit?.kind !== "measured" });

  return {
    text: `${renderRange(
      asText(low.amount),
      high === null ? null : asText(high.amount),
      measure.rangeSeparator,
    )}${unit ? ` ${formatUnit(unit, shown)}` : ""}`,
    bounds: scaled.bounds,
  };
}

/** Keep a range in the shape the recipe wrote it: "3–4" or "2 to 3". */
function renderRange(low: string, high: string | null, separator: string | null): string {
  if (high === null || separator === null) return low;
  return /^[-–—]$/.test(separator) ? `${low}${separator}${high}` : `${low} ${separator} ${high}`;
}

export function scaleIngredients(lines: string[], options: ScaleOptions): ScaledIngredient[] {
  return lines.map((line) => scaleIngredient(line, options));
}

/**
 * A line returned as published, with whatever quantity could be read off it.
 *
 * A line that carries a readable amount is `scaled`, because leaving it alone
 * is what multiplying by one does. A line with no amount at all is `unscaled`
 * and says why.
 */
export function passthroughIngredient(line: string): ScaledIngredient {
  const parsed = parseIngredient(line);

  const held = parsed.amount === null || parsed.heldBack !== null;
  const result: ScaledIngredient = {
    text: parsed.original,
    original: parsed.original,
    scaling: held ? "unscaled" : "scaled",
    amount: held ? null : parsed.amount,
    amountMax: held ? null : parsed.amountMax,
    unit: held ? null : (parsed.unit?.canonical ?? null),
  };
  if (parsed.heldBack) result.note = HELD_BACK_NOTE[parsed.heldBack];
  else if (parsed.amount === null) {
    // The bracket speaks for the whole line only where the line offers no
    // choice: on "6 eggs or ½ pint (300 ml) of cream" it belongs to the second
    // branch, and scaling reads that line branch by branch.
    const indication =
      splitBranch(parsed.readable, parsed) === null
        ? readBracketedIndication(parsed.readable)
        : null;
    result.note = indication ? INDICATION_NOTE : "No quantity given; adjust to taste.";
  } else if (parsed.unit?.kind === "approximate") {
    result.note = withApproximateNote(parsed.unit, undefined);
  }
  return result;
}

/** An ingredient list returned unchanged, for when no scaling was requested. */
export function passthroughIngredients(lines: string[]): ScaledIngredient[] {
  return lines.map(passthroughIngredient);
}
