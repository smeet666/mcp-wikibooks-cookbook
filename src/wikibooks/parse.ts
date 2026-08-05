/**
 * Reading the gateway's answers.
 *
 * A row that cannot be read is dropped and counted rather than published half
 * formed: a search result with no key names a page nobody can open, and a
 * caller shown one would follow it into a dead end.
 */

import { parseFailure } from "../errors.js";
import type { NutritionFacts, PageSummary, RecipePage } from "../types.js";
import { isCookbookKey, pageUrl } from "./urls.js";
import {
  findTemplates,
  flattenWikitext,
  listItems,
  parseTables,
  readCategories,
  splitSections,
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

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
  };
  return text
    .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&[a-z]+;/gi, (entity) => named[entity.toLowerCase()] ?? entity);
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

/** Read one recipe page out of the gateway's page document. */
export function toRecipePage(payload: unknown, url: string): RecipePage {
  if (!payload || typeof payload !== "object") {
    throw parseFailure("The gateway's page answer was not an object.", { url });
  }
  const record = payload as Record<string, unknown>;
  const source = record.source;
  if (typeof source !== "string") {
    throw parseFailure(
      "The gateway's page answer carried no wikitext, so nothing on the page could be read.",
      { url },
    );
  }
  const key = typeof record.key === "string" ? record.key : "";
  if (key === "") throw parseFailure("The gateway's page answer carried no key.", { url });

  const sections = splitSections(source);
  const lead = sections.find((section) => section.level === 0);
  const bodyOf = (test: RegExp) => sections.find((section) => test.test(section.title))?.body ?? "";

  const summary = findTemplates(source, "recipesummary")[0] ?? null;
  const servingsText = summary ? templateArg(summary, "servings") : null;
  const yieldText = summary ? (templateArg(summary, "yield") ?? servingsText) : null;
  const timeText = summary ? templateArg(summary, "time") : null;
  const difficulty = summary
    ? (readNumber(templateArg(summary, "difficulty")) ?? readNumber(templateArg(summary, "rating")))
    : null;

  const yieldCount = readYieldCount(yieldText);

  return {
    key,
    title: typeof record.title === "string" ? record.title : key.replace(/_/g, " "),
    sourceUrl: pageUrl(key),
    license: readLicense(record.license),
    revisedAt: readRevisedAt(record.latest),

    description: readLead(lead?.body ?? ""),
    category: summary ? flattenOrNull(templateArg(summary, "category")) : null,
    servings: yieldCount.count,
    yieldText: yieldText ? flattenWikitext(yieldText).trim() || null : null,
    yieldUnit: yieldCount.unit,
    timeText: timeText ? flattenWikitext(timeText).trim() || null : null,
    totalMinutes: parseMinutes(timeText),
    difficulty,
    difficultyMax: DIFFICULTY_MAX,
    energy: summary ? flattenOrNull(templateArg(summary, "energy")) : null,

    ingredients: readIngredients(bodyOf(HEADINGS.ingredients)),
    equipment: listItems(bodyOf(HEADINGS.equipment), "*#"),
    steps: listItems(bodyOf(HEADINGS.procedure), "#*"),
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
  return [...listItems(body, "*#"), ...tableIngredients(body)];
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
 */
export function readYieldCount(text: string | null): { count: number | null; unit: string | null } {
  if (text === null) return { count: null, unit: null };
  const flat = flattenWikitext(text).trim();
  if (flat === "") return { count: null, unit: null };

  const range = /^\d+(?:\.\d+)?\s*(?:-|–|—|to|or)\s*\d/i.exec(flat);
  if (range) return { count: null, unit: readYieldUnit(flat) };

  const match = /^(\d+(?:\.\d+)?)/.exec(flat);
  if (!match) return { count: null, unit: null };
  const count = Number(match[1]);
  if (!Number.isFinite(count) || count <= 0) return { count: null, unit: null };

  return { count, unit: readYieldUnit(flat) };
}

function readYieldUnit(flat: string): string | null {
  const rest = flat.replace(/^[\d.\s]*(?:-|–|—|to|or)?[\d.\s]*/i, "").trim();
  if (rest === "") return null;
  // "servings" is what a bare number already means, so repeating it says
  // nothing the count does not.
  return /^servings?$|^portions?$|^people$/i.test(rest) ? null : rest;
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
