/** Schemas, error mapping and rendering shared by the four tools. */

import { z } from "zod";
import { CookbookError } from "../errors.js";
import type { ScaledIngredient } from "../recipe/scale.js";

/**
 * Many MCP clients render only the text block, so it has to answer on its own.
 * This ceiling is what keeps a long recipe from arriving as a wall of text.
 */
export const MAX_TEXT_CHARS = 2200;

export const ATTRIBUTION = "Source: Wikibooks Cookbook";

export interface ToolResult {
  // The SDK's result type carries an index signature for protocol extensions.
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export const searchResultSchema = z.object({
  id: z.string().describe("Page key. Pass this to get_recipe."),
  title: z.string(),
  url: z.string().describe("Public page. Show this when citing the recipe."),
  image_url: z.string().nullable().describe("Thumbnail the search offered, when it offered one."),
  description: z.string().nullable().describe("The short gloss the wiki keeps for the page."),
  excerpt: z.string().nullable().describe("The matching passage, with highlight markup removed."),
});

export const scaledIngredientSchema = z.object({
  text: z.string().describe("The line as it now reads, identical to 'original' when unscaled."),
  original: z.string().describe("The line as the page publishes it."),
  scaling: z
    .enum(["scaled", "rounded", "unscaled"])
    .describe(
      "'scaled' means the arithmetic was exact. 'rounded' means a countable item was moved to a " +
        "whole, a half or a quarter, whichever is the smallest share a cook takes out of one of " +
        "it, or a measurement was demoted to a smaller unit to stay usable. " +
        "'unscaled' means the line carries nothing that can be multiplied and was left alone.",
    ),
  amount: z
    .number()
    .nullable()
    .describe(
      "The quantity, expressed in 'unit', and the lower bound when the line gives a range. Read the " +
        "two together: a large result is moved to a bigger unit, so 200 g scaled tenfold reads as " +
        "2 kg, and the bare number shrinks while the quantity grows.",
    ),
  amount_max: z.number().nullable().describe("Upper bound when the line gives a range."),
  unit: z
    .string()
    .nullable()
    .describe("The unit 'amount' is in, which may differ from the page's."),
  note: z.string().optional().describe("Why the line was rounded, clamped or left alone."),
});

export type ScaledIngredientOut = z.infer<typeof scaledIngredientSchema>;

export function toScaledIngredientOut(entry: ScaledIngredient): ScaledIngredientOut {
  const out: ScaledIngredientOut = {
    text: entry.text,
    original: entry.original,
    scaling: entry.scaling,
    amount: entry.amount,
    amount_max: entry.amountMax,
    unit: entry.unit,
  };
  if (entry.note !== undefined) {
    out.note = entry.note;
  }
  return out;
}

/**
 * Keep text from the wiki out of the shape this server's own lines take.
 *
 * The block ends with lines opening "Note:" and "Source:", and a caller has no
 * way to tell one of those from the same words inside a recipe's own tips.
 * Indenting a body line that opens with one of those words keeps the two apart,
 * and costs nothing: the structured output still carries the text exactly as it
 * was published.
 */
function indentMarkerLines(body: string): string {
  return body.replace(/^(Note:|Source:)/gm, " $1");
}

/**
 * Build a result whose text block ends with its notes and its credit.
 *
 * The body is truncated to fit around the trailer rather than the whole block
 * being cut afterwards. Appending the credit and then truncating loses exactly
 * the credit, which is the one line that must survive.
 *
 * The notes belong to the trailer for the same reason. They are what qualifies
 * an answer, saying that a list was capped, that a quantity was rounded, or
 * that a page states no yield to scale from. A client rendering only the text
 * reads an unqualified answer without them.
 */
export function ok(
  structured: Record<string, unknown>,
  body: string,
  options: { notes?: string[]; sourceUrl?: string } = {},
): ToolResult {
  const credit = options.sourceUrl ? `${ATTRIBUTION} — ${options.sourceUrl}` : ATTRIBUTION;

  // A long run of notes must not crowd out the answer it qualifies.
  const noteLines = (options.notes ?? []).map((note) => `Note: ${note}`);
  while (noteLines.length > 0 && noteLines.join("\n").length > MAX_TEXT_CHARS / 2) {
    noteLines.pop();
  }
  const trailer = [...noteLines, credit].join("\n");

  const cut = "\n\n[shortened; the full result is in the structured output]";
  const budget = MAX_TEXT_CHARS - `\n\n${trailer}`.length;
  const safe = indentMarkerLines(body);
  const text =
    safe.length <= budget
      ? `${safe}\n\n${trailer}`
      : `${truncate(safe, Math.max(0, budget - cut.length))}${cut}\n\n${trailer}`;

  return { content: [{ type: "text", text }], structuredContent: structured };
}

/**
 * Errors carry no structured payload: the SDK checks it against the tool's
 * declared output schema, and a failure does not fit that shape.
 */
export function toToolError(error: unknown): ToolResult {
  const known =
    error instanceof CookbookError
      ? error
      : new CookbookError("network_error", error instanceof Error ? error.message : String(error));

  const lines = [`[${known.code}] ${known.message}`];
  if (known.details.hint) {
    lines.push(`Hint: ${known.details.hint}`);
  }
  return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

/** A compact listing, carrying what it takes to pick one page out of many. */
export function renderResults(rows: z.infer<typeof searchResultSchema>[]): string {
  return rows
    .map((row, index) => {
      const head = [`${index + 1}. ${row.title}`, row.description ? `· ${row.description}` : ""]
        .filter(Boolean)
        .join(" ");
      // The address goes on its own line: a client that renders only text has
      // nothing else to cite from, and a model with a key and no link will
      // build one.
      return `${head}\n   id: ${row.id}\n   ${row.url}`;
    })
    .join("\n");
}

/** Wording used wherever a scaled list reaches the caller. */
export const SCALING_CAVEAT =
  "Quantities were recomputed by this server, not by the page. Read 'scaling' on each line: a rounded " +
  "line is close to its share rather than exactly it, and an unscaled line was left as published.";
