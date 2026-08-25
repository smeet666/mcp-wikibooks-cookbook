/**
 * English cooking unit vocabulary and what scaling means for each.
 *
 * The distinction that matters is not metric versus imperial, it is how far the
 * number can be divided before it stops naming something a cook can produce.
 * Doubling "200 g" gives "400 g", to the tenth of a gram. Doubling "1 pinch"
 * gives "2 pinches", which is the whole of what a pinch can say: the count
 * carries the quantity, and the size of one pinch is the hand's business.
 */

const ENGLISH_HOUSEHOLD_MEASURE = /^(cup|tablespoon|Tbsp|teaspoon|tsp)$/;

const FUL_MEASURE = /^[a-z]{3,}fuls?$/;

export type UnitKind =
  /** Mass or volume: scales continuously and cleanly. */
  | "measured"
  /** Spoons, cups, cloves, cans: scales, but only to sensible fractions. */
  | "portioned"
  /**
   * Pinches, dashes, handfuls: a real amount, held to no better than the hand
   * that produces it. The count is multiplied and lands on a whole one, and the
   * line says the measure is approximate.
   */
  | "approximate";

export type UnitSystem = "metric" | "imperial" | "none";

export interface UnitInfo {
  /** Canonical singular form, used when rewriting the ingredient line. */
  canonical: string;
  kind: UnitKind;
  system: UnitSystem;
  /** Plural form when it is not simply the singular plus an "s". */
  plural?: string;
  /** A symbol such as "g" or "ml", which never takes a plural mark. */
  symbol?: true;
}

/**
 * Keys are matched lowercased with dots dropped, so a single entry covers
 * "Tbsp", "tbsp." and "TBSP".
 */
const UNITS: Record<string, UnitInfo> = {
  // Metric mass
  mg: { canonical: "mg", kind: "measured", system: "metric", symbol: true },
  milligram: { canonical: "mg", kind: "measured", system: "metric", symbol: true },
  milligrams: { canonical: "mg", kind: "measured", system: "metric", symbol: true },
  g: { canonical: "g", kind: "measured", system: "metric", symbol: true },
  gram: { canonical: "g", kind: "measured", system: "metric", symbol: true },
  grams: { canonical: "g", kind: "measured", system: "metric", symbol: true },
  gramme: { canonical: "g", kind: "measured", system: "metric", symbol: true },
  grammes: { canonical: "g", kind: "measured", system: "metric", symbol: true },
  kg: { canonical: "kg", kind: "measured", system: "metric", symbol: true },
  kilogram: { canonical: "kg", kind: "measured", system: "metric", symbol: true },
  kilograms: { canonical: "kg", kind: "measured", system: "metric", symbol: true },
  kilo: { canonical: "kg", kind: "measured", system: "metric", symbol: true },
  kilos: { canonical: "kg", kind: "measured", system: "metric", symbol: true },

  // Metric volume
  ml: { canonical: "ml", kind: "measured", system: "metric", symbol: true },
  milliliter: { canonical: "ml", kind: "measured", system: "metric", symbol: true },
  milliliters: { canonical: "ml", kind: "measured", system: "metric", symbol: true },
  millilitre: { canonical: "ml", kind: "measured", system: "metric", symbol: true },
  millilitres: { canonical: "ml", kind: "measured", system: "metric", symbol: true },
  cl: { canonical: "cl", kind: "measured", system: "metric", symbol: true },
  dl: { canonical: "dl", kind: "measured", system: "metric", symbol: true },
  l: { canonical: "l", kind: "measured", system: "metric", symbol: true },
  liter: { canonical: "l", kind: "measured", system: "metric", symbol: true },
  liters: { canonical: "l", kind: "measured", system: "metric", symbol: true },
  litre: { canonical: "l", kind: "measured", system: "metric", symbol: true },
  litres: { canonical: "l", kind: "measured", system: "metric", symbol: true },

  // Imperial mass
  oz: { canonical: "oz", kind: "measured", system: "imperial", symbol: true },
  ounce: { canonical: "ounce", kind: "measured", system: "imperial", plural: "ounces" },
  ounces: { canonical: "ounce", kind: "measured", system: "imperial", plural: "ounces" },
  lb: { canonical: "lb", kind: "measured", system: "imperial", symbol: true },
  lbs: { canonical: "lb", kind: "measured", system: "imperial", symbol: true },
  pound: { canonical: "pound", kind: "measured", system: "imperial", plural: "pounds" },
  pounds: { canonical: "pound", kind: "measured", system: "imperial", plural: "pounds" },

  // Imperial volume
  "fl oz": { canonical: "fl oz", kind: "measured", system: "imperial", symbol: true },
  "fluid ounce": {
    canonical: "fluid ounce",
    kind: "measured",
    system: "imperial",
    plural: "fluid ounces",
  },
  "fluid ounces": {
    canonical: "fluid ounce",
    kind: "measured",
    system: "imperial",
    plural: "fluid ounces",
  },
  pint: { canonical: "pint", kind: "measured", system: "imperial", plural: "pints" },
  pints: { canonical: "pint", kind: "measured", system: "imperial", plural: "pints" },
  quart: { canonical: "quart", kind: "measured", system: "imperial", plural: "quarts" },
  quarts: { canonical: "quart", kind: "measured", system: "imperial", plural: "quarts" },
  gallon: { canonical: "gallon", kind: "measured", system: "imperial", plural: "gallons" },
  gallons: { canonical: "gallon", kind: "measured", system: "imperial", plural: "gallons" },

  // Spoons and cups: real measures, but only in sensible fractions.
  tsp: { canonical: "tsp", kind: "portioned", system: "imperial", symbol: true },
  teaspoon: { canonical: "teaspoon", kind: "portioned", system: "imperial", plural: "teaspoons" },
  teaspoons: { canonical: "teaspoon", kind: "portioned", system: "imperial", plural: "teaspoons" },
  tbsp: { canonical: "Tbsp", kind: "portioned", system: "imperial", symbol: true },
  tbs: { canonical: "Tbsp", kind: "portioned", system: "imperial", symbol: true },
  tablespoon: {
    canonical: "tablespoon",
    kind: "portioned",
    system: "imperial",
    plural: "tablespoons",
  },
  tablespoons: {
    canonical: "tablespoon",
    kind: "portioned",
    system: "imperial",
    plural: "tablespoons",
  },
  cup: { canonical: "cup", kind: "portioned", system: "imperial", plural: "cups" },
  cups: { canonical: "cup", kind: "portioned", system: "imperial", plural: "cups" },

  // Packaging and natural units: countable, and divisible as far as what they
  // hold allows. See `unitDivisibility`.
  can: { canonical: "can", kind: "portioned", system: "none" },
  cans: { canonical: "can", kind: "portioned", system: "none" },
  // The same container under the word half the English-speaking world uses for
  // it. Unlisted, the line counts no container at all and the question of how
  // far it divides falls to what is inside it, so a tin of tomatoes would be
  // quartered the way a tomato is.
  tin: { canonical: "tin", kind: "portioned", system: "none" },
  tins: { canonical: "tin", kind: "portioned", system: "none" },
  jar: { canonical: "jar", kind: "portioned", system: "none" },
  jars: { canonical: "jar", kind: "portioned", system: "none" },
  packet: { canonical: "packet", kind: "portioned", system: "none" },
  packets: { canonical: "packet", kind: "portioned", system: "none" },
  package: { canonical: "package", kind: "portioned", system: "none" },
  packages: { canonical: "package", kind: "portioned", system: "none" },
  clove: { canonical: "clove", kind: "portioned", system: "none" },
  cloves: { canonical: "clove", kind: "portioned", system: "none" },
  slice: { canonical: "slice", kind: "portioned", system: "none" },
  slices: { canonical: "slice", kind: "portioned", system: "none" },
  stick: { canonical: "stick", kind: "portioned", system: "none" },
  sticks: { canonical: "stick", kind: "portioned", system: "none" },
  stalk: { canonical: "stalk", kind: "portioned", system: "none" },
  stalks: { canonical: "stalk", kind: "portioned", system: "none" },
  sprig: { canonical: "sprig", kind: "portioned", system: "none" },
  sprigs: { canonical: "sprig", kind: "portioned", system: "none" },
  bunch: { canonical: "bunch", kind: "portioned", system: "none", plural: "bunches" },
  bunches: { canonical: "bunch", kind: "portioned", system: "none", plural: "bunches" },
  head: { canonical: "head", kind: "portioned", system: "none" },
  heads: { canonical: "head", kind: "portioned", system: "none" },
  sheet: { canonical: "sheet", kind: "portioned", system: "none" },
  sheets: { canonical: "sheet", kind: "portioned", system: "none" },
  leaf: { canonical: "leaf", kind: "portioned", system: "none", plural: "leaves" },
  leaves: { canonical: "leaf", kind: "portioned", system: "none", plural: "leaves" },
  ea: { canonical: "ea", kind: "portioned", system: "none", symbol: true },
  // A dish of the book standing as an ingredient of another: "1 recipe Flaky
  // Pie Crust". The count is what the word measures, so the plural mark belongs
  // on it and not on the name of the dish.
  recipe: { canonical: "recipe", kind: "portioned", system: "none", plural: "recipes" },
  recipes: { canonical: "recipe", kind: "portioned", system: "none", plural: "recipes" },

  // Held to no better than a hand: the count scales, the size of one does not.
  // See `readContainerLoad` for what puts a word here.
  capful: { canonical: "capful", kind: "approximate", system: "none", plural: "capfuls" },
  capfuls: { canonical: "capful", kind: "approximate", system: "none", plural: "capfuls" },
  glug: { canonical: "glug", kind: "approximate", system: "none" },
  glugs: { canonical: "glug", kind: "approximate", system: "none" },
  dollop: { canonical: "dollop", kind: "approximate", system: "none" },
  dollops: { canonical: "dollop", kind: "approximate", system: "none" },
  squeeze: { canonical: "squeeze", kind: "approximate", system: "none" },
  squeezes: { canonical: "squeeze", kind: "approximate", system: "none" },
  sprinkle: { canonical: "sprinkle", kind: "approximate", system: "none" },
  sprinkles: { canonical: "sprinkle", kind: "approximate", system: "none" },
  sprinkling: { canonical: "sprinkling", kind: "approximate", system: "none" },
  sprinklings: { canonical: "sprinkling", kind: "approximate", system: "none" },
  grating: { canonical: "grating", kind: "approximate", system: "none" },
  gratings: { canonical: "grating", kind: "approximate", system: "none" },
  twist: { canonical: "twist", kind: "approximate", system: "none" },
  twists: { canonical: "twist", kind: "approximate", system: "none" },
  smidgen: { canonical: "smidgen", kind: "approximate", system: "none" },
  smidgens: { canonical: "smidgen", kind: "approximate", system: "none" },
  pinch: { canonical: "pinch", kind: "approximate", system: "none", plural: "pinches" },
  pinches: { canonical: "pinch", kind: "approximate", system: "none", plural: "pinches" },
  dash: { canonical: "dash", kind: "approximate", system: "none", plural: "dashes" },
  dashes: { canonical: "dash", kind: "approximate", system: "none", plural: "dashes" },
  splash: { canonical: "splash", kind: "approximate", system: "none", plural: "splashes" },
  splashes: { canonical: "splash", kind: "approximate", system: "none", plural: "splashes" },
  drizzle: { canonical: "drizzle", kind: "approximate", system: "none" },
  handful: { canonical: "handful", kind: "approximate", system: "none", plural: "handfuls" },
  handfuls: { canonical: "handful", kind: "approximate", system: "none", plural: "handfuls" },
  drop: { canonical: "drop", kind: "approximate", system: "none" },
  drops: { canonical: "drop", kind: "approximate", system: "none" },
  knob: { canonical: "knob", kind: "approximate", system: "none" },
  knobs: { canonical: "knob", kind: "approximate", system: "none" },
};

/**
 * Abbreviations also answer to the plural mark a page writes on them.
 *
 * A symbol stands in for the word rather than spelling it out, and a recipe
 * writing "1 tbsp" on one line writes "3 tbsps" on the next. Both name the same
 * spoon, and a spelling the vocabulary does not carry sends the amount to the
 * countable branch, where a spoonful is rounded as though it were one
 * indivisible object: two neighbouring lines of one page then come back scaled
 * by different rules.
 */
for (const [key, info] of Object.entries(UNITS)) {
  const plural = `${key}s`;
  if (info.symbol && UNITS[plural] === undefined) {
    UNITS[plural] = info;
  }
}

/**
 * What a kitchen usually takes each approximate measure to be.
 *
 * Offered as words for a note, never as the quantity: writing "2 teaspoons"
 * where the page wrote "4 pinches" puts a figure on the page it never claimed,
 * and the cook is the one holding the pinch.
 */
const APPROXIMATE_EQUIVALENT: Record<string, string> = {
  capful: "commonly taken as about a tablespoon, the size of a bottle cap",
  glug: "commonly taken as about two tablespoons poured free-hand",
  dollop: "commonly taken as about a heaped tablespoon",
  pinch: "commonly taken as about half a teaspoon",
  dash: "commonly taken as about an eighth of a teaspoon",
  splash: "commonly taken as about a tablespoon",
  handful: "commonly taken as about a quarter of a cup",
  knob: "commonly taken as about a tablespoon of butter",
  drizzle: "commonly taken as about a teaspoon poured in a thin line",
};

/** The everyday equivalence for an approximate unit, when there is a settled one. */
export function approximateEquivalent(unit: UnitInfo): string | null {
  return APPROXIMATE_EQUIVALENT[normalizeUnitKey(unit.canonical)] ?? null;
}

/**
 * Lowercase and drop abbreviation dots, so lookups survive the spellings a
 * recipe actually uses. Recipes write "Tbsp." and "tbsp" as readily as the full
 * "tablespoon", and an unrecognised unit is worse than a wrong one: the amount
 * falls through to the countable branch and gets rounded as though a spoonful
 * were an indivisible object.
 */
export function normalizeUnitKey(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/\./g, " ")
      // A recipe that does not know how many it will be writes the plural mark
      // in brackets: "2 tablespoon(s) sugar". The unit is the word without it.
      .replace(/\((?:s|x|es)\)/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Longest keys first, so "fluid ounce" wins over "ounce". */
export const UNIT_KEYS = Object.keys(UNITS).sort(
  (a, b) => b.split(" ").length - a.split(" ").length || b.length - a.length,
);

/**
 * The single characters a recipe writes a fraction with, as a run for a class.
 *
 * A quantity can open on one of them, as in "½ cup", and a figure that is not
 * recognised as a figure hides the quantity behind it.
 */
const VULGAR_GLYPHS = "½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞";

/**
 * Matches a number followed by a unit anywhere in a piece of text.
 *
 * Used to spot a quantity this parser did not take, such as the second half of
 * "1 Tbsp vanilla sugar OR 1 tsp vanilla extract", which would otherwise sit in
 * a scaled line still saying what the original said.
 */
export const EMBEDDED_MEASURE = new RegExp(
  `[\\d${VULGAR_GLYPHS}](?:[\\d.,/\\s${VULGAR_GLYPHS}]*)?\\s*(?:${UNIT_KEYS.map((key) => key.replace(/ /g, "\\s+")).join("|")})\\b`,
  "i",
);

export function lookupUnit(text: string): UnitInfo | null {
  return UNITS[normalizeUnitKey(text)] ?? null;
}

/**
 * Read a measure named after the thing that holds it: a capful, a spoonful, a
 * jarful.
 *
 * What makes a measure approximate is that its size belongs to whoever pours
 * it rather than to a standard, and English marks that in the word itself. The
 * suffix -ful means "as much as one of these holds", and what a cap, a bowl or
 * a handful holds is whatever the one in the kitchen holds. Any noun built that
 * way is therefore a measure of the same family as a pinch, which is why the
 * suffix is read as a rule: a container nobody thought to list is understood
 * the first time it appears, and the table above only carries the words the
 * rule cannot reach, the gestures — a pinch, a dash, a drizzle, a glug — whose
 * name says nothing about their size either.
 *
 * The vocabulary is consulted first, so a word listed there keeps the kind and
 * the plural it was given.
 */
export function readContainerLoad(word: string): UnitInfo | null {
  const key = normalizeUnitKey(word);
  // At least three letters name the container, which keeps "awful" out of the
  // kitchen.
  if (!FUL_MEASURE.test(key)) {
    return null;
  }

  const canonical = key.endsWith("fuls") ? key.slice(0, -1) : key;
  return { canonical, kind: "approximate", system: "none", plural: `${canonical}s` };
}

/**
 * Ladders, used to keep a scaled amount at a human size.
 *
 * Multiplying a recipe by thirty is arithmetically fine and practically poor:
 * "8335 g of sugar" is correct, and nobody weighs eight thousand grams. Each
 * measured unit therefore knows the unit above and below it, so a large amount
 * climbs the ladder and a small one comes back down. The two systems keep their
 * own ladders, because converting between them changes what the recipe said.
 */
interface UnitStep {
  /** Unit to switch to, and how many of the current unit it holds. */
  to: string;
  per: number;
}

const PROMOTIONS: Record<string, UnitStep> = {
  mg: { to: "g", per: 1000 },
  g: { to: "kg", per: 1000 },
  ml: { to: "l", per: 1000 },
  cl: { to: "l", per: 100 },
  dl: { to: "l", per: 10 },
  oz: { to: "lb", per: 16 },
  ounce: { to: "pound", per: 16 },
  "fl oz": { to: "pint", per: 20 },
  pint: { to: "quart", per: 2 },
  quart: { to: "gallon", per: 4 },
};

const DEMOTIONS: Record<string, UnitStep> = {
  // Spoons and cups hold a fixed volume, so a share of one is stated in the
  // smaller spoon rather than as a fraction no measuring set carries. The
  // spelling of the step matches the spelling of the unit it comes from, so a
  // line written in abbreviations stays in abbreviations.
  cup: { to: "tablespoon", per: 16 },
  tablespoon: { to: "teaspoon", per: 3 },
  tbsp: { to: "tsp", per: 3 },

  kg: { to: "g", per: 1000 },
  g: { to: "mg", per: 1000 },
  l: { to: "cl", per: 100 },
  dl: { to: "cl", per: 10 },
  cl: { to: "ml", per: 10 },
  lb: { to: "oz", per: 16 },
  pound: { to: "ounce", per: 16 },
  gallon: { to: "quart", per: 4 },
  quart: { to: "pint", per: 2 },
  pint: { to: "fl oz", per: 20 },
};

/**
 * The unit one step down the ladder, with how many of it fit in one of the
 * current unit. Null at the bottom of a ladder, where there is nothing smaller
 * to express the amount in.
 */
export function demoteUnit(unit: UnitInfo): { unit: UnitInfo; per: number } | null {
  const step = DEMOTIONS[normalizeUnitKey(unit.canonical)];
  if (!step) {
    return null;
  }
  const target = lookupUnit(step.to);
  return target ? { unit: target, per: step.per } : null;
}

/**
 * Spoons and cups: a portion, and at the same time a fixed volume. The volume
 * is what lets a share of one be restated in a smaller spoon.
 */
export function isSpoonMeasure(unit: UnitInfo): boolean {
  return ENGLISH_HOUSEHOLD_MEASURE.test(unit.canonical);
}

/** How finely a kitchen can divide one of a counted thing. */
export type Divisibility =
  /** An egg: half of one is not an amount a kitchen measures out. */
  | "whole"
  /** A can, a clove, a sheet of gelatine: it splits in two, and no finer. */
  | "half"
  /** An onion, an apple: a knife takes it to quarters. */
  | "quarter";

/**
 * How finely a unit divides, decided by what one of them holds rather than by
 * what holds it.
 *
 * The question is whether half of one is a quantity a cook can take: a can of
 * tomatoes is poured and the rest kept, a packet of vanilla sugar is split by
 * eye, a sheet of gelatine is cut with scissors, a sprig of thyme is pinched in
 * two. Content that pours, weighs or cuts therefore divides, and the word for
 * the packaging settles nothing. What stays whole is what half of cannot be
 * measured out at all, and the egg is the case that names the rule: half of one
 * would have to be beaten and weighed, which is not what a recipe asks for.
 * That test belongs to the thing being counted, so it lives with the item in
 * `scale.ts`.
 *
 * A gesture keeps its own answer: half a pinch is a fraction of a hand, and the
 * count is the whole of what a pinch can say.
 *
 * "ea" counts pieces without naming them, so it leaves the question to the item
 * standing beside it.
 *
 * A short list of measures goes one step further, to the quarter. See
 * `QUARTERED_MEASURE`.
 */
export function unitDivisibility(unit: UnitInfo): Divisibility {
  if (unit.kind === "approximate") {
    return "whole";
  }
  return QUARTERED_MEASURE.test(unit.canonical) ? "quarter" : "half";
}

/**
 * Measures a cook takes a quarter of.
 *
 * The half is as far as the criterion goes on its own, because that is the
 * share most measures give up by eye. These four answer the size question
 * differently. A bottle, a jar and a block hold enough that a quarter is still
 * a portion someone serves and the rest still keeps: a quarter of a bottle of
 * wine is a glass, a quarter of a jar of salsa is a bowlful, a quarter of a
 * block of tofu is a piece cut on a board. A slice is already cut off something
 * larger, and the board that produced one takes a corner off it in the same
 * gesture: a quarter of a slice of bread is a crouton.
 *
 * The pattern is exported because any of these words can stand where the
 * measure goes or inside the name of what is counted, and both readings answer
 * to the same list.
 */
export const QUARTERED_MEASURE = /\b(bottles?|blocks?|jars?|slices?)\b/i;

/** True for a unit that counts pieces without saying anything about them. */
export function countsBarePieces(unit: UnitInfo): boolean {
  return unit.canonical === "ea";
}

export interface ChosenUnit {
  unit: UnitInfo;
  /** What to multiply an amount in the original unit by to express it in this one. */
  ratio: number;
}

/**
 * Choose the unit a cook would actually write a quantity in, and say how to get
 * there.
 *
 * A ratio rather than a converted number, because a range has two bounds and
 * they have to end up in the same unit: converting each on its own gives the
 * unreadable "13 oz to 1.5 pounds". The caller picks one bound to choose from,
 * then applies the ratio to both.
 *
 * Demotion repeats while the amount is under one, so a quantity divided a
 * thousandfold walks all the way down its ladder instead of rounding away.
 * Promotion takes one step, at a full unit of the step above, so 999 g stays
 * grams and 1000 g becomes a kilo.
 */
export function chooseReadableUnit(unit: UnitInfo, amount: number): ChosenUnit {
  if (unit.kind !== "measured" || !Number.isFinite(amount) || amount <= 0) {
    return { unit, ratio: 1 };
  }

  let current = unit;
  let ratio = 1;

  while (amount * ratio < 1) {
    const step = demoteUnit(current);
    if (!step) {
      break;
    }
    ratio *= step.per;
    current = step.unit;
  }

  const up = PROMOTIONS[normalizeUnitKey(current.canonical)];
  if (up && amount * ratio >= up.per) {
    const target = lookupUnit(up.to);
    if (target) {
      ratio /= up.per;
      current = target;
    }
  }

  return { unit: current, ratio };
}

/**
 * Render a unit for a given amount, choosing singular or plural.
 *
 * English takes the plural above one, so 1.5 is plural: "1.5 cups", "1 cup".
 */
export function formatUnit(unit: UnitInfo, amount: number): string {
  if (unit.symbol) {
    return unit.canonical;
  }
  if (amount <= 1) {
    return unit.canonical;
  }
  if (unit.plural) {
    return unit.plural;
  }
  return `${unit.canonical}s`;
}
