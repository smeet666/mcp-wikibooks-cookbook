/**
 * What flattening leaves behind in a sentence.
 *
 * A page writes prose with markup inside it, and the reader sees the words the
 * markup renders. A construct removed rather than rendered takes a word out of
 * the sentence, and the punctuation that framed it stays: what comes back then
 * reads as a sentence somebody wrote, which is the one thing it is not.
 */

import { describe, expect, it } from "vitest";
import { flattenWikitext } from "../../src/wikibooks/wikitext.js";

describe("a tag the wiki renders as layout", () => {
  it("shows the quoted text without the tag around it", () => {
    expect(flattenWikitext("<blockquote>Serve hot.</blockquote>")).toBe("Serve hot.");
  });
});

describe("a template standing inside a sentence", () => {
  it("keeps the word an interwiki link shows", () => {
    expect(flattenWikitext("A stew from {{w|Provence}}, served warm.")).toBe(
      "A stew from Provence, served warm.",
    );
  });

  it("keeps the label an interwiki link is given", () => {
    expect(flattenWikitext("Braised in {{w|Vitis vinifera|wine}}.")).toBe("Braised in wine.");
  });

  it("keeps the words of a phrase written in another language", () => {
    expect(flattenWikitext("A dish of {{lang|fr|haute cuisine}}.")).toBe(
      "A dish of haute cuisine.",
    );
  });

  it("leaves no empty brackets where a call rendered nothing", () => {
    expect(flattenWikitext("Bake it ({{cookdp}}) until done.")).toBe("Bake it until done.");
  });
});
