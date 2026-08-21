/**
 * Turning wikitext into the sentences a reader sees.
 *
 * Pages are stored as markup: links carry a target and a label, templates carry
 * citations and infoboxes, and references hang off the end of a sentence. What a
 * cook needs is the label, the amount and the instruction, so this module
 * flattens the markup while keeping every word that was published.
 *
 * The stripping is deliberately ordered. References go first because they hold
 * templates, templates go next because they hold links, and links go last: doing
 * it the other way round leaves a bracket from one construct inside another.
 */

/** One `{{name|...}}` call, with its arguments in the order they were written. */
export interface Template {
  name: string;
  /** Arguments given as `key=value`, keyed lowercased and trimmed. */
  named: Record<string, string>;
  /** Arguments given without a key, in order. */
  positional: string[];
}

/**
 * Find every top-level template call whose name matches, nested braces included.
 *
 * A regular expression cannot do this: an infobox holds citation templates, and
 * matching to the first `}}` cuts the box in half.
 */
export function findTemplates(source: string, name: string): Template[] {
  const wanted = normaliseName(name);
  const found: Template[] = [];

  for (let i = 0; i < source.length - 1; i += 1) {
    if (source[i] !== "{" || source[i + 1] !== "{") {
      continue;
    }
    const end = matchingClose(source, i);
    if (end === null) {
      continue;
    }

    const body = source.slice(i + 2, end);
    const parsed = parseTemplateBody(body);
    if (parsed.name === wanted) {
      found.push(parsed);
    }
    // Skip past this call rather than descending into it: a citation inside an
    // infobox is not a top-level use of the template being looked for.
    i = end + 1;
  }

  return found;
}

/**
 * Template names ignore spacing, underscores and case, so "Nutrition Summary"
 * and "nutritionsummary" name the same template and have to compare equal.
 */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "")
    .trim();
}

/** Index of the `}}` closing the `{{` at `start`, or null when it never closes. */
function matchingClose(source: string, start: number): number | null {
  let depth = 0;
  for (let i = start; i < source.length - 1; i += 1) {
    if (source[i] === "{" && source[i + 1] === "{") {
      depth += 1;
      i += 1;
      continue;
    }
    if (source[i] === "}" && source[i + 1] === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
      i += 1;
    }
  }
  return null;
}

/**
 * Split a template body on the pipes that belong to it.
 *
 * Pipes inside a nested template or inside a wiki link separate that
 * construct's own arguments, so splitting on every pipe would tear an image
 * argument apart at "[[Image:x.jpg|300px]]".
 */
function parseTemplateBody(body: string): Template {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < body.length; i += 1) {
    const two = body.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth += 1;
      current += two;
      i += 1;
      continue;
    }
    if (two === "}}" || two === "]]") {
      depth -= 1;
      current += two;
      i += 1;
      continue;
    }
    if (body[i] === "|" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += body[i];
  }
  parts.push(current);

  const name = normaliseName(parts.shift() ?? "");
  const named: Record<string, string> = {};
  const positional: string[] = [];

  for (const part of parts) {
    const split = part.indexOf("=");
    // A key is a short word before the equals sign. An equals sign inside a URL
    // is not an argument name, and treating it as one silently drops the value.
    if (split > 0 && /^[A-Za-z0-9 _-]{1,30}$/.test(part.slice(0, split))) {
      named[
        part
          .slice(0, split)
          .toLowerCase()
          .replace(/[\s_]+/g, "")
          .trim()
      ] = part.slice(split + 1).trim();
    } else {
      positional.push(part.trim());
    }
  }

  return { name, named, positional };
}

/** Read a template argument by name, falling back to its position. */
export function templateArg(template: Template, name: string, position?: number): string | null {
  const byName = template.named[name.toLowerCase().replace(/[\s_]+/g, "")];
  if (byName !== undefined && byName.trim() !== "") {
    return byName.trim();
  }
  if (position !== undefined) {
    const byPosition = template.positional[position];
    if (byPosition !== undefined && byPosition.trim() !== "") {
      return byPosition.trim();
    }
  }
  return null;
}

/**
 * Every spelling of a line break a page uses, the mistaken closing form
 * included: the wiki renders `</br>` as a break like the others.
 */
export const LINE_BREAK_TAG = /<\s*\/?\s*br\s*\/?\s*>/gi;

/**
 * Flatten wiki markup to the text a reader sees.
 *
 * `[[Cookbook:Pasta|spaghetti]]` becomes "spaghetti" and `[[Cookbook:Salt]]`
 * becomes "Salt", because the label is what the page shows and the target is an
 * address the cook has no use for.
 */
export function flattenWikitext(source: string): string {
  let text = source;

  // References carry publisher names and ISBNs that belong to a bibliography.
  text = text.replace(/<ref[^>/]*\/>/gi, "");
  text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  text = stripTemplates(text);

  // Images and files are markup around an address, with a caption a recipe line
  // never needs.
  text = text.replace(/\[\[(?:File|Image):[^[\]]*(?:\[\[[^[\]]*\]\][^[\]]*)*\]\]/gi, "");

  // A link shows its label when it has one, and its target when it does not.
  // Repeated because a label can itself hold a link.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text.replace(/\[\[([^[\]|]+)(?:\|([^[\]]*))?\]\]/g, (_match, target, label) => {
      const shown =
        typeof label === "string" && label.trim() !== "" ? label : stripNamespace(target);
      return shown;
    });
    if (next === text) {
      break;
    }
    text = next;
  }

  // An external link shows its label, or its address when it has none.
  text = text.replace(/\[(https?:\/\/\S+?)(?:\s+([^\]]*))?\]/g, (_m, url, label) =>
    typeof label === "string" && label.trim() !== "" ? label : String(url),
  );

  // A line break separates what stands on either side of it. Removed outright,
  // "1 hour<br>Cooking" becomes one word and stops being a duration.
  text = text.replace(LINE_BREAK_TAG, " ");
  // Tags the wiki renders as shape rather than as words: what a reader takes
  // from the page is the text between them.
  text = text.replace(
    /<\/?(?:nowiki|small|big|sup|sub|span|div|blockquote|center|p|em|strong|i|b|u)[^>]*>/gi,
    "",
  );
  // Bold and italic are three, four or five apostrophes around the word.
  text = text.replace(/'{2,5}/g, "");

  // A page writes a character it cannot type as an HTML entity, and the wiki
  // renders it as that character. "3&frac12; cups" is three and a half cups on
  // the page, so the flattened line has to say so too: left encoded, the half
  // reads as part of the ingredient's name and the quantity is short by one.
  text = decodeEntities(text);

  return text
    .replace(EMPTY_BRACKETS, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ +\n/g, "\n")
    .trim();
}

/**
 * A bracket left holding nothing.
 *
 * A page puts a call in brackets to gloss what stands before it, and a call
 * that renders no words leaves the brackets sitting in the sentence. Empty,
 * they announce an aside the page never made. The space in front of one goes
 * with it, since the sentence closed before the bracket opened.
 */
const EMPTY_BRACKETS = /[ \t]*\(\s*\)/g;

/**
 * Named HTML entities a page writes where the character itself would do.
 *
 * The fractions are the ones that carry meaning: a page reading "3&frac12;
 * cups" shows three and a half cups to whoever visits it, and a flattened line
 * that keeps the entity says three.
 */
const NAMED_ENTITIES: Record<string, string> = {
  frac12: "½",
  frac13: "⅓",
  frac23: "⅔",
  frac14: "¼",
  frac34: "¾",
  frac15: "⅕",
  frac18: "⅛",
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  deg: "°",
  times: "×",
  minus: "−",
  ndash: "–",
  mdash: "—",
};

/** Turn HTML entities back into the characters the wiki renders them as. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (whole, hex: string) =>
      codePoint(Number.parseInt(hex, 16), whole),
    )
    .replace(/&#(\d+);/g, (whole, digits: string) => codePoint(Number(digits), whole))
    .replace(
      /&([a-z][a-z0-9]*);/gi,
      (whole, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? whole,
    );
}

/** A code point a page named, or the entity as published when it names none. */
function codePoint(value: number, published: string): string {
  if (!Number.isInteger(value) || value < 32 || value > 0x10ffff) {
    return published;
  }
  try {
    return String.fromCodePoint(value);
  } catch {
    return published;
  }
}

/** Drop the leading `Cookbook:` or `w:` from a link target used as its own label. */
function stripNamespace(target: string): string {
  const cleaned = String(target).replace(/^:?(?:Cookbook|w|wikipedia|wikt):/i, "");
  // A section link shows the page, not the anchor.
  const hash = cleaned.indexOf("#");
  return (hash < 0 ? cleaned : cleaned.slice(0, hash)).trim();
}

/**
 * Reduce every template call to the text it puts on the page.
 *
 * Most calls put nothing a cook can use there: a citation is bibliography, a
 * banner is navigation, and an infobox is read separately before this runs. A
 * few carry the only figure in their sentence, and those are rendered. An oven
 * temperature written as a template and dropped leaves "Preheat the oven to .",
 * which reads as a finished instruction and is not one.
 *
 * A call left unclosed swallows the rest of the text: everything after it is
 * markup whose end is unknown, and guessing where it stops splices half a
 * template into a sentence.
 */
export function stripTemplates(source: string): string {
  let out = "";

  for (let i = 0; i < source.length; i += 1) {
    if (source.slice(i, i + 2) === "{{") {
      const end = matchingClose(source, i);
      if (end === null) {
        break;
      }
      out += renderTemplate(parseTemplateBody(source.slice(i + 2, end)));
      i = end + 1;
      continue;
    }
    out += source[i];
  }

  return out;
}

/**
 * What one template call contributes to the flattened text.
 *
 * Only the calls whose arguments hold a measurement render anything. The
 * measurement templates state a value, a unit, and a unit to convert it into;
 * what comes back is the value and the unit the page wrote. The converted
 * counterpart is computed rather than published, and measurements are repeated
 * here in the system the source chose.
 */
function renderTemplate(template: Template): string {
  if (template.name === "convert" || template.name === "cvt") {
    return renderConversion(template);
  }
  if (template.name === "frac" || template.name === "sfrac") {
    return renderFraction(template);
  }
  if (template.name === "cb") {
    return renderCookbookLink(template);
  }
  if (template.name === "w" || template.name === "wp" || template.name === "wikt") {
    return renderInterwikiLink(template);
  }
  if (template.name === "lang") {
    return renderForeignPhrase(template);
  }
  return "";
}

/**
 * A link to another wiki written as a template call, as the words it shows.
 *
 * The call expands to a link labelled either by the title it points at or by
 * the label given after it. Dropped, the sentence loses the word it was built
 * around: "A stew from , served warm."
 */
function renderInterwikiLink(template: Template): string {
  const [target, label] = template.positional;
  const shown = label !== undefined && label.trim() !== "" ? label : target;
  return shown?.trim() ?? "";
}

/**
 * A phrase a page marks as belonging to another language, as that phrase.
 *
 * The call states the language first and the words second, and the words are
 * what a reader sees: the marking is for whoever reads the page aloud.
 */
function renderForeignPhrase(template: Template): string {
  const [, phrase] = template.positional;
  return phrase?.trim() ?? "";
}

/**
 * A link into the Cookbook written as a template call, as the word it shows.
 *
 * The call expands to a link whose label is its argument, so what a reader sees
 * is that word. Dropped, an ingredient line keeps its amount and names nothing:
 * "500 g fresh" is a line whoever avoids an ingredient cannot check.
 */
function renderCookbookLink(template: Template): string {
  return template.positional[0]?.trim() ?? "";
}

/** Separators a conversion call puts between the two ends of a range. */
const RANGE_SEPARATORS: Record<string, string> = {
  "-": "–",
  "–": "–",
  "—": "–",
  to: " to ",
  and: " and ",
};

/**
 * A conversion call as the value and unit its arguments open with.
 *
 * The arguments run value, unit, unit-to-convert-into, and a range is written
 * by putting a separator where the first unit would be. A call whose first
 * argument is not a number states no measurement, so it contributes nothing
 * rather than a stray word.
 */
function renderConversion(template: Template): string {
  const [first, second, third, fourth] = template.positional;
  if (first === undefined || !isNumeric(first)) {
    return "";
  }

  const separator = second === undefined ? undefined : RANGE_SEPARATORS[second.toLowerCase()];
  if (separator !== undefined && third !== undefined && isNumeric(third)) {
    return withUnit(`${first}${separator}${third}`, fourth);
  }
  return withUnit(first, second);
}

/**
 * Units a conversion call names by a letter the page never shows bare.
 *
 * The wiki prints a degree sign in front of the temperature scales, and a
 * reader handed "180 C" reads a unit the page does not use.
 */
const UNIT_LABELS: Record<string, string> = { C: "°C", F: "°F", K: "K", R: "°R" };

function withUnit(value: string, unit: string | undefined): string {
  if (unit === undefined || unit.trim() === "") {
    return value;
  }
  return `${value} ${UNIT_LABELS[unit.trim()] ?? unit.trim()}`;
}

/**
 * A fraction call as the figures it holds.
 *
 * One argument names the denominator of a single part, two name a numerator
 * over a denominator, and three put a whole number in front of the fraction.
 */
function renderFraction(template: Template): string {
  const parts = template.positional.filter((part) => part.trim() !== "");
  if (parts.length === 0 || parts.length > 3 || !parts.every(isNumeric)) {
    return "";
  }
  if (parts.length === 1) {
    return `1/${parts[0]}`;
  }
  if (parts.length === 2) {
    return `${parts[0]}/${parts[1]}`;
  }
  return `${parts[0]} ${parts[1]}/${parts[2]}`;
}

function isNumeric(value: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(value.trim());
}

/**
 * Drop the HTML comments a page carries.
 *
 * A comment is invisible to whoever reads the page, so nothing inside it is
 * part of any section. Editors park a heading in one while they rewrite a page,
 * and read as markup it opens a section that exists for nobody, cutting a list
 * in two and filing the rest of it under the wrong part of the recipe.
 */
export function stripComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, "");
}

export interface Section {
  /** Heading text, flattened. The lead of a page has an empty title. */
  title: string;
  /** How many equals signs the heading carried. Zero for the lead. */
  level: number;
  /** Everything up to the next heading of any level, as raw wikitext. */
  body: string;
}

/** Split a page into its headed sections, lead first. */
export function splitSections(source: string): Section[] {
  const sections: Section[] = [];
  const heading = /^[ \t]*(={2,6})[ \t]*(.+?)[ \t]*\1[ \t]*$/gm;

  let lastIndex = 0;
  let current: { title: string; level: number } = { title: "", level: 0 };

  for (const match of source.matchAll(heading)) {
    const at = match.index;
    sections.push({ ...current, body: source.slice(lastIndex, at) });
    current = { title: flattenWikitext(match[2] ?? "").trim(), level: (match[1] ?? "").length };
    lastIndex = at + match[0].length;
  }
  sections.push({ ...current, body: source.slice(lastIndex) });

  return sections;
}

/** A run of wikitext inside a section, and the headings it sits under. */
export interface SectionChunk {
  /** The sub-heading naming the part of the dish this text belongs to. */
  subheading: string | null;
  /** The sub-heading naming the alternative this text belongs to. */
  alternative: string | null;
  body: string;
}

/** How `sectionChunks` tells one nested heading from another. */
export interface NestedHeadingRules {
  /**
   * A heading that belongs to something else than the section being read. Such
   * a heading is passed over with everything nested under it.
   */
  standsAlone?: (section: Section) => boolean;
  /**
   * A heading naming an alternative rather than a component. Its text is kept
   * and labelled with that heading, and so is everything nested under it.
   */
  opensAlternative?: (section: Section) => boolean;
}

/** One heading's effect on the two scopes a chunk can sit in. */
interface Scopes {
  part: { level: number; title: string } | null;
  alternative: { level: number; title: string } | null;
}

/**
 * The scopes a heading leaves open behind it.
 *
 * A heading closes whichever scope it is not nested inside, and then opens one
 * of its own: an alternative when the rules say the title names one, a part
 * otherwise. An untitled section changes neither.
 */
function scopesAfter(
  section: Section,
  open: Scopes,
  opensAlternative: (section: Section) => boolean,
): Scopes {
  const part = open.part !== null && section.level <= open.part.level ? null : open.part;
  const alternative =
    open.alternative !== null && section.level <= open.alternative.level ? null : open.alternative;

  const title = section.title === "" ? null : section.title;
  if (title === null) {
    return { part, alternative };
  }

  if (opensAlternative(section)) {
    return { part, alternative: { level: section.level, title } };
  }
  return { part: { level: section.level, title }, alternative };
}

/**
 * The runs of text a heading covers, its nested sections included.
 *
 * A heading on a wiki owns everything down to the next heading of its own level
 * or shallower, so a recipe that groups its ingredients under "Cake", "Soak"
 * and "Glaze" still states one list. Each run keeps the sub-heading above it,
 * because that word says what the ingredient is for and two runs can name the
 * same quantity for different parts of the dish.
 *
 * Two kinds of nested heading are not parts of what is being read. One belongs
 * to another section of the recipe: a page can file its procedure one level
 * under its ingredients, and the heading decides what it is, so it is passed
 * over. The other names an alternative to the whole: a second version of the
 * dish is written exactly like a second part of it, and folding the two
 * together builds a list nobody would cook.
 */
export function sectionChunks(
  sections: Section[],
  index: number,
  rules: NestedHeadingRules = {},
): SectionChunk[] {
  const start = sections[index];
  if (start === undefined) {
    return [];
  }
  const standsAlone = rules.standsAlone ?? (() => false);
  const opensAlternative = rules.opensAlternative ?? (() => false);

  const chunks: SectionChunk[] = [{ subheading: null, alternative: null, body: start.body }];
  let skipBelow: number | null = null;
  let part: { level: number; title: string } | null = null;
  let alternative: { level: number; title: string } | null = null;

  for (let at = index + 1; at < sections.length; at += 1) {
    const section = sections[at];
    if (section === undefined || section.level <= start.level) {
      break;
    }
    if (skipBelow !== null && section.level > skipBelow) {
      continue;
    }
    skipBelow = null;
    if (standsAlone(section)) {
      skipBelow = section.level;
      continue;
    }

    ({ part, alternative } = scopesAfter(section, { part, alternative }, opensAlternative));

    chunks.push({
      subheading: part?.title ?? null,
      alternative: alternative?.title ?? null,
      body: section.body,
    });
  }

  return chunks;
}

/** Everything `sectionChunks` covers, as one stretch of wikitext. */
export function sectionBody(
  sections: Section[],
  index: number,
  rules: NestedHeadingRules = {},
): string {
  return sectionChunks(sections, index, rules)
    .map((chunk) => chunk.body)
    .join("\n");
}

/**
 * Read a bulleted or numbered list out of a section body.
 *
 * Only the top level is kept: a sub-bullet under an ingredient is a remark
 * about it, and promoting it to a line of its own would read as a further
 * ingredient the recipe never asked for.
 */
export function listItems(body: string, markers: string): string[] {
  return readList(body, markers).items;
}

/** A list read out of a section, with the entries that flattened to nothing. */
export interface ListRead {
  items: string[];
  /**
   * Entries the page wrote that came back empty, because everything on them was
   * markup this parser renders as nothing. Counted rather than dropped: a
   * shorter list than the page publishes is a list a cook shops from.
   */
  emptied: number;
}

/** Read a bulleted or numbered list, counting the entries that came to nothing. */
export function readList(body: string, markers: string): ListRead {
  const items: string[] = [];
  let emptied = 0;
  for (const line of body.split("\n")) {
    const trimmed = line.trimEnd();
    const first = trimmed[0];
    if (!first || !markers.includes(first)) {
      continue;
    }
    if (trimmed[1] && markers.includes(trimmed[1])) {
      continue;
    }
    const written = trimmed.slice(1);
    if (written.trim() === "") {
      continue;
    }
    const text = flattenWikitext(written).trim();
    if (text === "") {
      emptied += 1;
    } else {
      items.push(text);
    }
  }
  return { items, emptied };
}

/** A `{| … |}` table, with its heading cells and its body rows, all flattened. */
export interface WikiTable {
  /** The heading cells, in column order. Empty when the table declares none. */
  headers: string[];
  /** One entry per body row, each holding that row's cells in column order. */
  rows: string[][];
}

/**
 * Read the tables a section lays out.
 *
 * Many Cookbook recipes give their ingredients as a table rather than as a
 * list, with the name in one column and the quantity spread over a Count, a
 * Volume and a Weight column of which one is filled. A reader of bullets alone
 * comes back from such a page with a procedure and no ingredients.
 *
 * References are removed before anything is split, because one can run over
 * several lines and hold pipes of its own, which is enough to tear a row apart.
 */
export function parseTables(source: string): WikiTable[] {
  const text = source.replace(/<ref[^>/]*\/>/gi, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");

  const tables: WikiTable[] = [];
  let depth = 0;
  let block: string[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.replace(/^[:*#;\s]+/, "");
    if (trimmed.startsWith("{|")) {
      depth += 1;
      if (depth === 1) {
        block = [];
      }
      continue;
    }
    if (depth === 0) {
      continue;
    }
    if (trimmed.startsWith("|}")) {
      depth -= 1;
      if (depth === 0) {
        tables.push(readTableBlock(block));
      }
      continue;
    }
    block.push(line);
  }

  return tables;
}

/**
 * Split the inside of a table into rows and cells.
 *
 * A cell runs from its own marker to the next one, so a line belonging to
 * neither continues the cell above it: a quantity written over two lines is one
 * quantity. Heading cells open with `!` and body cells with `|`, and both forms
 * can put several cells on one line.
 */
function readTableBlock(lines: string[]): WikiTable {
  const headers: string[] = [];
  const rows: string[][] = [];

  let row: string[] = [];
  let rowIsHeading = false;
  let cell: string[] | null = null;

  const closeCell = () => {
    if (cell === null) {
      return;
    }
    row.push(cleanCell(cell.join("\n")));
    cell = null;
  };
  const closeRow = () => {
    closeCell();
    if (row.length === 0) {
      return;
    }
    // A heading row names the columns rather than filling them, and a table
    // repeating its headings partway down is naming them again.
    if (rowIsHeading) {
      if (headers.length === 0) {
        headers.push(...row);
      }
    } else {
      rows.push(row);
    }
    row = [];
    rowIsHeading = false;
  };

  for (const line of lines) {
    const trimmed = line.trimStart();

    if (trimmed.startsWith("|-")) {
      closeRow();
      continue;
    }
    // A caption is the table's title rather than one of its cells.
    if (trimmed.startsWith("|+")) {
      closeCell();
      continue;
    }
    if (trimmed.startsWith("!") || trimmed.startsWith("|")) {
      closeCell();
      const heading = trimmed.startsWith("!");
      const parts = trimmed.slice(1).split(heading ? "!!" : "||");
      parts.slice(0, -1).forEach((part) => {
        row.push(cleanCell(part));
      });
      cell = [parts.at(-1) ?? ""];
      // A row holding one heading cell holds a heading row: the marker is per
      // cell, and a row mixing the two is a body row with a label in it.
      if (heading && row.length === parts.length - 1) {
        rowIsHeading = true;
      }
      continue;
    }
    if (cell !== null) {
      cell.push(line);
    }
  }

  closeRow();
  return { headers, rows };
}

/**
 * The text of one cell, without the display attributes in front of it.
 *
 * A cell may open with `colspan="2" style="…" |` before its content. The pipe
 * that ends those attributes is told from a pipe inside a link or a template by
 * what stands before it: an attribute list carries an equals sign and no
 * markup.
 */
function cleanCell(raw: string): string {
  const split = raw.indexOf("|");
  const head = split < 0 ? "" : raw.slice(0, split);
  const body = split >= 0 && /=/.test(head) && !/[[{]/.test(head) ? raw.slice(split + 1) : raw;
  return flattenWikitext(body).replace(/\s+/g, " ").trim();
}

/** Every `[[Category:…]]` the page declares, in order, without repeats. */
export function readCategories(source: string): string[] {
  const seen = new Set<string>();
  for (const match of source.matchAll(/\[\[Category:([^\]|]+)(?:\|[^\]]*)?\]\]/gi)) {
    const name = (match[1] ?? "").trim();
    if (name !== "") {
      seen.add(name);
    }
  }
  return [...seen];
}
