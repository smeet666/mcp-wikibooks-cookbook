/**
 * Reading the gateway's answers.
 *
 * A row that cannot be read is dropped and counted rather than published half
 * formed: a search result with no key names a page nobody can open, and a
 * caller shown one would follow it into a dead end.
 */

import { parseFailure } from "../errors.js";
import type { NutritionFacts, PageSummary, RecipePage, TimePhase } from "../types.js";
import { isCookbookKey, pageUrl } from "./urls.js";
import type { Section, SectionChunk } from "./wikitext.js";
import {
  findTemplates,
  decodeEntities,
  flattenWikitext,
  LINE_BREAK_TAG,
  listItems,
  parseTables,
  readCategories,
  readList,
  sectionChunks,
  splitSections,
  stripComments,
  templateArg,
} from "./wikitext.js";

/**
 * Read a page of search results, keeping only the Cookbook.
 *
 * The gateway ranks across the whole of the English Wikibooks, so a query for a
 * dish returns chess openings and language primers alongside it. Filtering by
 * key is what makes the answer a cookbook answer, and the count of what was set
 * aside travels with it so nobody reads a short list as a rare dish.
 */
export function toSearchResults(
  payload: unknown,
  onSkip: (count: number) => void,
): { results: PageSummary[]; outsideCookbook: number } {
  if (!payload || typeof payload !== "object") {
    throw parseFailure("The gateway's search answer was not an object.");
  }
  const pages = (payload as { pages?: unknown }).pages;
  if (!Array.isArray(pages)) {
    throw parseFailure("The gateway's search answer carried no 'pages' array.");
  }

  const results: PageSummary[] = [];
  let unreadable = 0;
  let outsideCookbook = 0;

  for (const row of pages) {
    if (!row || typeof row !== "object") {
      unreadable += 1;
      continue;
    }
    const record = row as Record<string, unknown>;
    const key = typeof record.key === "string" ? record.key : null;
    if (!key || key.trim() === "") {
      unreadable += 1;
      continue;
    }
    if (!isCookbookKey(key)) {
      outsideCookbook += 1;
      continue;
    }

    results.push({
      key,
      title: typeof record.title === "string" ? record.title : key.replace(/_/g, " "),
      description: nonEmpty(record.description),
      excerpt: cleanExcerpt(record.excerpt),
      imageUrl: thumbnailUrl(record.thumbnail),
      sourceUrl: pageUrl(key),
    });
  }

  if (unreadable > 0) onSkip(unreadable);
  return { results, outsideCookbook };
}

/**
 * Strip the search's own highlight markup.
 *
 * The excerpt arrives with the matched words wrapped in a span and with HTML
 * entities for quotes and apostrophes. Both are the search engine talking about
 * the text rather than the text itself.
 */
export function cleanExcerpt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = decodeEntities(value.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
  return text === "" ? null : text;
}

/** The thumbnail address, made absolute: the gateway gives it protocol-relative. */
function thumbnailUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const url = (value as { url?: unknown }).url;
  if (typeof url !== "string" || url.trim() === "") return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** The scale the recipe box's difficulty figure sits on. */
export const DIFFICULTY_MAX = 5;

/** Headings whose bodies this parser reads, matched loosely. */
const HEADINGS = {
  ingredients: /^ingredients?\b/i,
  equipment: /^(?:equipment|utensils|tools|special equipment)\b/i,
  procedure: /^(?:procedure|directions?|instructions?|method|preparation|steps)\b/i,
  tips: /^(?:notes|tips|variations|notes,? tips,? and variations)\b/i,
};

/**
 * A sub-heading naming an alternative rather than a component.
 *
 * The two are written identically and only the wording separates them. A part
 * of a dish is made alongside the other parts and the cook buys all of them; an
 * alternative replaces the others and the cook picks one. A page offering three
 * versions of a salad under `=== Variation I ===`, `=== Variation II ===` and
 * `=== Variation III ===`, above a procedure reading "Mix all ingredients in a
 * bowl", puts three tins of fish in one bowl the moment the three are read as
 * one list.
 *
 * Stated as a rule over the wording rather than as a list of the headings seen
 * so far, because the next page invents its own word for the same thing.
 */
const ALTERNATIVE_HEADING =
  /\b(?:variations?|variants?|versions?|alternatives?|alternates?|options?|substitutions?|substitutes?)\b/i;

/**
 * The text one part of a recipe covers, sub-headings included.
 *
 * A heading owns the sections nested under it, so an ingredient list split into
 * "Cake", "Soak" and "Glaze" is read whole. A nested heading that names another
 * part of the recipe is left to that part: a page filing its procedure one
 * level under its ingredients states steps, and putting them in the list would
 * offer "boil the leaves" as something to buy.
 */
function headedChunks(sections: Section[], test: RegExp): SectionChunk[] {
  const at = sections.findIndex((section) => section.level > 0 && test.test(section.title));
  if (at < 0) return [];

  const others = Object.values(HEADINGS).filter((heading) => heading !== test);
  return sectionChunks(sections, at, {
    standsAlone: (section) =>
      !test.test(section.title) && others.some((heading) => heading.test(section.title)),
    opensAlternative: (section) => ALTERNATIVE_HEADING.test(section.title),
  });
}

/**
 * Headings naming the same part of a recipe as one already read, outside it.
 *
 * A heading owns what is nested under it and stops at the next heading of its
 * own level, so a page that writes its ingredients twice at the top level
 * publishes two recipes and one of them is read. Naming the other is the whole
 * of what the answer can honestly say about it: merging the two builds a list
 * nobody would cook, and saying nothing hands back half a page as the page.
 */
function unreadSiblingSections(sections: Section[], test: RegExp): string[] {
  const at = sections.findIndex((section) => section.level > 0 && test.test(section.title));
  if (at < 0) return [];
  const level = sections[at]!.level;

  return sections
    .slice(at + 1)
    .filter((section) => section.level > 0 && section.level <= level && test.test(section.title))
    .map((section) => section.title);
}

/** Where a redirect page points, and the page that pointed there. */
export interface PageRedirect {
  kind: "redirect";
  /** The redirect page's own key, as the gateway names it. */
  key: string;
  /** The page it points at. */
  target: string;
}

/** A page document, which is either a recipe or a pointer to one. */
export type PageDocument = PageRedirect | { kind: "recipe"; page: RecipePage };

/**
 * A redirect carries a pointer and no recipe.
 *
 * The wikitext holds the target in its own words, which is the name a reader
 * would see; the gateway also sends the target as an address, which is read
 * when the wikitext is not a pointer this parser recognises.
 */
export function readRedirect(payload: Record<string, unknown>): { target: string } | null {
  const source = typeof payload.source === "string" ? payload.source : "";
  const inline = /^\s*#\s*redirect\s*:?\s*\[\[\s*([^\]|#]+)/i.exec(source);
  if (inline) {
    const target = (inline[1] ?? "").trim();
    if (target !== "") return { target };
  }

  const path = payload.redirect_target;
  if (typeof path !== "string" || path.trim() === "") return null;
  const last = path.split("?")[0]?.split("/").filter(Boolean).pop() ?? "";
  const target = safeDecode(last).replace(/_/g, " ").trim();
  return target === "" ? null : { target };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Read one page document, telling a recipe from a pointer to one.
 *
 * A redirect read as a recipe produces a title with no ingredients and no
 * steps, which is what a dish the Cookbook does not hold looks like. Naming it
 * as a pointer lets the caller reach the page a reader would land on.
 */
export function toPageDocument(payload: unknown, url: string): PageDocument {
  if (!payload || typeof payload !== "object") {
    throw parseFailure("The gateway's page answer was not an object.", { url });
  }
  const record = payload as Record<string, unknown>;
  const redirect = readRedirect(record);
  if (redirect) {
    const key = typeof record.key === "string" && record.key !== "" ? record.key : "";
    if (key === "") throw parseFailure("The gateway's page answer carried no key.", { url });
    return { kind: "redirect", key, target: redirect.target };
  }
  return { kind: "recipe", page: toRecipePage(payload, url) };
}

/** Read one recipe page out of the gateway's page document. */
export function toRecipePage(payload: unknown, url: string): RecipePage {
  if (!payload || typeof payload !== "object") {
    throw parseFailure("The gateway's page answer was not an object.", { url });
  }
  const record = payload as Record<string, unknown>;
  const published = record.source;
  if (typeof published !== "string") {
    throw parseFailure(
      "The gateway's page answer carried no wikitext, so nothing on the page could be read.",
      { url },
    );
  }
  const key = typeof record.key === "string" ? record.key : "";
  if (key === "") throw parseFailure("The gateway's page answer carried no key.", { url });

  const source = stripComments(published);
  const sections = splitSections(source);
  const lead = sections.find((section) => section.level === 0);
  const chunksOf = (test: RegExp) => headedChunks(sections, test);
  const bodyOf = (test: RegExp) =>
    chunksOf(test)
      .map((chunk) => chunk.body)
      .join("\n");

  const ingredientChunks = chunksOf(HEADINGS.ingredients);
  const ingredients: string[] = [];
  const ingredientGroups: (string | null)[] = [];
  const ingredientVariants: (string | null)[] = [];
  let unreadableIngredients = 0;
  for (const chunk of ingredientChunks) {
    const read = readIngredientList(chunk.body);
    unreadableIngredients += read.emptied;
    for (const line of read.lines) {
      ingredients.push(line);
      ingredientGroups.push(chunk.subheading);
      ingredientVariants.push(chunk.alternative);
    }
  }

  const steps = listItems(bodyOf(HEADINGS.procedure), "#*");
  // The Cookbook keeps recipes and the book's own reference pages in one
  // namespace, and a chapter index writes "Ingredients" over its links exactly
  // as a recipe writes it over its shopping list. What tells them apart is
  // whether the page cooks anything: a recipe box, the banner a recipe carries,
  // or a procedure with steps in it.
  const readsAsRecipe =
    findTemplates(source, "recipesummary").length > 0 ||
    findTemplates(source, "recipe").length > 0 ||
    steps.length > 0;
  // A page can hold two recipes, and only the first of each part is read.
  const unread = new Set(
    Object.values(HEADINGS).flatMap((heading) => unreadSiblingSections(sections, heading)),
  );
  const furtherSections = [
    ...new Set(
      sections
        .filter((section) => section.level > 0 && unread.has(section.title))
        .map((section) => section.title),
    ),
  ];

  const summary = findTemplates(source, "recipesummary")[0] ?? null;
  const servingsText = summary ? templateArg(summary, "servings") : null;
  const yieldText = summary ? (templateArg(summary, "yield") ?? servingsText) : null;
  const timeText = summary ? templateArg(summary, "time") : null;
  const difficulty = summary
    ? (readNumber(templateArg(summary, "difficulty")) ?? readNumber(templateArg(summary, "rating")))
    : null;

  const yieldCount = readYieldCount(yieldText);
  const timePhases = readTimePhases(timeText);

  return {
    key,
    title: typeof record.title === "string" ? record.title : key.replace(/_/g, " "),
    sourceUrl: pageUrl(key),
    license: readLicense(record.license),
    revisedAt: readRevisedAt(record.latest),
    redirectedFrom: [],

    description: readLead(lead?.body ?? ""),
    category: summary ? flattenOrNull(templateArg(summary, "category")) : null,
    servings: yieldCount.count,
    yieldText: yieldText ? flattenWikitext(yieldText).trim() || null : null,
    yieldUnit: yieldCount.unit,
    timeText: timeText ? flattenWikitext(timeText).trim() || null : null,
    timePhases,
    prepMinutes: labelledMinutes(timePhases, PREPARATION_LABEL),
    cookMinutes: labelledMinutes(timePhases, COOKING_LABEL),
    totalMinutes: statedTotalMinutes(timePhases),
    difficulty,
    difficultyMax: DIFFICULTY_MAX,
    energy: summary ? flattenOrNull(templateArg(summary, "energy")) : null,

    readsAsRecipe,
    furtherSections,
    ingredients,
    unreadableIngredients,
    ingredientGroups,
    ingredientVariants,
    equipment: listItems(bodyOf(HEADINGS.equipment), "*#"),
    steps,
    tips: listItems(bodyOf(HEADINGS.tips), "*#"),
    nutrition: readNutrition(source),
    categories: readCategories(source),
    sectionTitles: sections.filter((section) => section.level > 0).map((section) => section.title),
  };
}

/** The column naming what the row is about. */
const NAME_COLUMN = /^(?:ingredients?|items?|names?|products?)\b/i;

/**
 * The columns carrying an amount.
 *
 * A Cookbook table spreads one quantity over Count, Volume and Weight and fills
 * the one that suits the ingredient. A baker's percentage column is deliberately
 * absent: it states a ratio to the flour, and reading it as an amount would put
 * "9.13% sugar" in a shopping list.
 */
const QUANTITY_COLUMN = /^(?:count|quantity|amount|volume|weight|measure|size)\b/i;

/** A cell a table writes to say that this row has nothing in that column. */
const EMPTY_CELL = /^(?:n\/a|-|–|—|none)$/i;

/**
 * Read the ingredients a section states, whether as a list or as a table.
 *
 * A table row is put back together as a cook would say it: the amount from
 * whichever column carries one, then the name. A row with no amount is still an
 * ingredient the recipe uses, so it keeps its name and the scaling reports it
 * as carrying nothing to multiply.
 */
export function readIngredients(body: string): string[] {
  return readIngredientList(body).lines;
}

/** The ingredients a section states, with the entries that came back empty. */
export function readIngredientList(body: string): { lines: string[]; emptied: number } {
  const bulleted = readList(body, "*#");
  return { lines: [...bulleted.items, ...tableIngredients(body)], emptied: bulleted.emptied };
}

function tableIngredients(body: string): string[] {
  const lines: string[] = [];

  for (const table of parseTables(body)) {
    const nameAt = table.headers.findIndex((header) => NAME_COLUMN.test(header));
    // Without a column saying which cell names the ingredient, the table is
    // some other table: a temperature chart, a list of substitutions.
    if (nameAt < 0) continue;
    const quantityAt = table.headers
      .map((header, index) => (index !== nameAt && QUANTITY_COLUMN.test(header) ? index : -1))
      .filter((index) => index >= 0);

    for (const row of table.rows) {
      // A single cell spanning the table labels the rows under it, and a row
      // adding the table up is arithmetic about the recipe rather than part of
      // it.
      if (row.length < 2) continue;
      const name = row[nameAt] ?? "";
      if (name === "" || /^totals?$/i.test(name)) continue;

      const amount = quantityAt.map((index) => row[index] ?? "").find(filled) ?? "";
      lines.push(amount === "" ? name : `${amount} ${name}`);
    }
  }

  return lines;
}

function filled(cell: string): boolean {
  return cell !== "" && !EMPTY_CELL.test(cell);
}

/**
 * The opening prose, which is the page's own description of the dish.
 *
 * Navigation templates and the breadcrumb line above the introduction are
 * markup the wiki renders as links, so what is left after flattening is a run
 * of pipe-separated page names rather than a sentence.
 */
function readLead(body: string): string | null {
  const flattened = flattenWikitext(body);
  const paragraphs = flattened
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph !== "" && !/^\|/.test(paragraph) && paragraph.includes(" "));
  return paragraphs[0] ?? null;
}

function flattenOrNull(value: string | null): string | null {
  if (value === null) return null;
  const text = flattenWikitext(value).trim();
  return text === "" ? null : text;
}

function readNumber(value: string | null): number | null {
  if (value === null) return null;
  const match = /-?\d+(?:\.\d+)?/.exec(value);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Read a yield as a number and the thing it counts.
 *
 * "6" counts servings and says so by saying nothing. "24 balls" counts balls,
 * and scaling it means scaling the balls, so the word is kept. A yield given as
 * a range, as in "4 to 6", has no single count: the published wording is what
 * the caller gets, and the count stays null rather than picking an end.
 *
 * A yield written as a fraction is one number. Reading its numerator alone
 * states twice the yield and leaves the denominator standing where the thing
 * being counted goes, so every quantity on the page is rescaled from a figure
 * nobody published.
 */
export function readYieldCount(text: string | null): { count: number | null; unit: string | null } {
  if (text === null) return { count: null, unit: null };
  const flat = flattenWikitext(text).trim();
  if (flat === "") return { count: null, unit: null };

  const range = /^\d+(?:\.\d+)?\s*(?:-|–|—|to|or)\s*\d+(?:\.\d+)?/i.exec(flat);
  if (range) return { count: null, unit: readYieldUnit(flat.slice(range[0].length)) };

  const match = /^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?/.exec(flat);
  if (!match) return { count: null, unit: null };
  const divisor = match[2] === undefined ? 1 : Number(match[2]);
  const count = Number(match[1]) / divisor;
  if (!Number.isFinite(count) || count <= 0) return { count: null, unit: null };

  return { count, unit: readYieldUnit(flat.slice(match[0].length)) };
}

function readYieldUnit(after: string): string | null {
  const rest = after.trim();
  if (rest === "") return null;
  // "servings" is what a bare number already means, so repeating it says
  // nothing the count does not.
  return /^servings?$|^portions?$|^people$/i.test(rest) ? null : rest;
}

/**
 * A label naming the whole of the dish rather than one phase of it.
 *
 * Such a phase is the only thing a total can be read from: it is the page
 * saying how long the recipe takes, in its own arithmetic.
 */
const TOTAL_LABEL = /^(?:total|overall|altogether|all\s+in)\b/i;

/** A label naming the work done before anything is cooked. */
const PREPARATION_LABEL = /^(?:prep|preparation|preparing|prepping|assembly|active)\b/i;

/** A label naming the time the dish spends being cooked. */
const COOKING_LABEL =
  /^(?:cook|cooking|bake|baking|bak|fry|frying|roast|roasting|grill|grilling|boil|boiling|steam|steaming|simmer|simmering)\b/i;

/**
 * The longest a label can run before it stops looking like the name of a phase.
 *
 * The colon is also the punctuation of a sentence, so a long run of words
 * before one is prose that happens to hold it rather than a label.
 */
const LABEL_MAX_CHARS = 30;

/**
 * Read the durations a recipe box states, one per phase of the dish.
 *
 * The box holds one field for time, and a page with more than one thing to say
 * writes several durations into it, separated by line breaks and each named:
 * "Prep: 1 hour", "Fermentation: 12–24 hours", "Cooking: 10 minutes". Read as
 * one run of text, the phases run into each other and the reading depends on
 * where the words happen to fall.
 */
export function readTimePhases(raw: string | null): TimePhase[] {
  if (raw === null) return [];

  return raw
    .split(LINE_BREAK_TAG)
    .flatMap((part) => part.split("\n"))
    .map((part) => flattenWikitext(part).trim())
    .filter((part) => part !== "")
    .map((part) => {
      const colon = part.indexOf(":");
      const head = colon > 0 ? part.slice(0, colon).trim() : "";
      const labelled = head !== "" && head.length <= LABEL_MAX_CHARS && !/\d/.test(head);
      const label = labelled ? head : null;
      const text = labelled ? part.slice(colon + 1).trim() : part;
      return { label, text, ...parseDuration(text) };
    })
    .filter((phase) => phase.text !== "");
}

/** The total a page states itself, never one added up from its phases. */
function statedTotalMinutes(phases: TimePhase[]): number | null {
  const stated = phases.find((phase) => phase.label !== null && TOTAL_LABEL.test(phase.label));
  if (stated) return stated.minutes;
  const only = phases.length === 1 ? phases[0] : undefined;
  return only && only.label === null ? only.minutes : null;
}

function labelledMinutes(phases: TimePhase[], label: RegExp): number | null {
  const match = phases.find((phase) => phase.label !== null && label.test(phase.label));
  return match ? match.minutes : null;
}

/**
 * Read one duration, keeping both ends of a range.
 *
 * "12–24 hours" is a span the cook chooses inside, and answering with either
 * end alone states a certainty the page declined to state.
 */
export function parseDuration(text: string): { minutes: number | null; minutesMax: number | null } {
  const range =
    /(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|days?)\b/i.exec(
      flattenWikitext(text).toLowerCase(),
    );
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    const scale = unitMinutes(range[3] ?? "");
    if (Number.isFinite(low) && Number.isFinite(high) && high > low) {
      return { minutes: Math.round(low * scale), minutesMax: Math.round(high * scale) };
    }
  }
  return { minutes: parseMinutes(text), minutesMax: null };
}

function unitMinutes(unit: string): number {
  if (/^d/.test(unit)) return 1440;
  return /^h/.test(unit) ? 60 : 1;
}

/**
 * Read a stated time in minutes.
 *
 * Only what the page states is read. A page that gives no time gets null, and
 * never a figure added up from how many steps it has.
 */
export function parseMinutes(text: string | null): number | null {
  if (text === null) return null;
  const flat = flattenWikitext(text).toLowerCase();

  const GLYPHS: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

  let total = 0;
  let matched = false;
  // A whole number may be followed by a fraction glyph, as in "1 ½ hours", and
  // reading only the glyph would report thirty minutes for ninety.
  for (const match of flat.matchAll(
    /(\d+(?:\.\d+)?)?\s*([½¼¾⅓⅔])?\s*(hours?|hrs?|h|minutes?|mins?|m|days?)\b/g,
  )) {
    const whole = match[1] === undefined ? 0 : Number(match[1]);
    const fraction = match[2] === undefined ? 0 : (GLYPHS[match[2]] ?? 0);
    const amount = whole + fraction;
    if (!Number.isFinite(amount) || amount === 0) continue;
    const unit = match[3] ?? "";
    const minutes = /^d/.test(unit) ? 1440 : /^(?:h)/.test(unit) ? 60 : 1;
    total += amount * minutes;
    matched = true;
  }

  if (!matched) return null;
  const rounded = Math.round(total);
  return rounded > 0 ? rounded : null;
}

function readLicense(value: unknown): { title: string; url: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = nonEmpty(record.title);
  const url = nonEmpty(record.url);
  if (!title || !url) return null;
  return { title, url };
}

function readRevisedAt(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  return nonEmpty((value as Record<string, unknown>).timestamp);
}

/**
 * Read the nutrition panel, which a page gives either by name or by position.
 *
 * The panel is repeated as published, units and all: recomputing it per serving
 * would be arithmetic the page never authorised, and the serving size it
 * applies to is part of the claim.
 */
export function readNutrition(source: string): NutritionFacts | null {
  const template = findTemplates(source, "nutritionsummary")[0] ?? null;
  if (!template) return null;

  const read = (name: string, position: number) =>
    flattenOrNull(templateArg(template, name, position));

  const facts: NutritionFacts = {
    servingSize: read("servingsize", 0),
    servings: read("servings", 1),
    calories: read("cals", 2),
    caloriesFromFat: read("fatcals", 3),
    totalFat: read("totalfat", 4),
    saturatedFat: read("satfat", 5),
    cholesterol: read("cholesterol", 6),
    sodium: read("sodium", 7),
    carbohydrates: read("carbs", 8),
    fiber: read("fiber", 9),
    sugars: read("sugars", 10),
    protein: read("protein", 11),
    vitaminA: read("vitamina", 12),
    vitaminC: read("vitaminc", 13),
    calcium: read("calcium", 14),
    iron: read("iron", 15),
  };

  // An empty panel is a template call with nothing in it, which states nothing.
  return Object.values(facts).some((value) => value !== null) ? facts : null;
}
