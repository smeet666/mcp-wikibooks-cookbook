/**
 * An ingredient written through a template call still names its ingredient.
 *
 * The wiki expands a call to the words it puts on the page, and a cook reads
 * those words. A parser that drops the call hands back a line naming nothing,
 * which is the shape of the answer somebody avoiding an ingredient acts on.
 */

import { describe, expect, it } from "vitest";
import { toRecipePage } from "../../src/wikibooks/parse.js";
import { fixture } from "./helpers.js";

function page() {
  return toRecipePage(fixture("page-template-names"), "https://example.invalid/page");
}

describe("an ingredient named by a template call", () => {
  it("keeps the word the call puts on the page", () => {
    const read = page();
    expect(read.ingredients[0]).toBe("500 g fresh late fruit");
    expect(read.ingredients[1]).toBe("2 tablespoons pale sugar");
  });

  it("counts a line that came to nothing rather than dropping it in silence", () => {
    const read = page();
    // The page writes three bullets. Whatever the third one renders to, the
    // answer must not read as a two-line list the page never wrote.
    expect(read.unreadableIngredients).toBe(1);
  });
});
