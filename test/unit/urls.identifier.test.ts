/**
 * Putting a page reference into the form the gateway answers.
 *
 * The wiki holds one page per address, and it settles two things about an
 * address before it looks it up: the first letter of a title is a capital, and
 * an anchor names a section of a page rather than a page. A reference handed
 * over in either of those shapes names a page that exists, so the request has
 * to be built for the page it names.
 */

import { describe, expect, it } from "vitest";
import { normaliseKey, pageSourceUrl } from "../../src/wikibooks/urls.js";

describe("the capital the wiki puts on a title", () => {
  it("capitalises a bare dish name", () => {
    expect(normaliseKey("pancake")).toBe("Cookbook:Pancake");
  });

  it("capitalises a title written under the namespace", () => {
    expect(normaliseKey("cookbook:pancake")).toBe("Cookbook:Pancake");
  });

  it("leaves the rest of the title as the caller wrote it", () => {
    expect(normaliseKey("Cookbook:Spaghetti alla Carbonara")).toBe(
      "Cookbook:Spaghetti_alla_Carbonara",
    );
  });
});

describe("an anchor names a section, and the page is what is read", () => {
  it("drops the anchor from a key", () => {
    expect(normaliseKey("Cookbook:Whole Wheat Pancakes#Ingredients")).toBe(
      "Cookbook:Whole_Wheat_Pancakes",
    );
  });

  it("drops an anchor a caller left empty", () => {
    expect(normaliseKey("Cookbook:Whole_Wheat_Pancakes#")).toBe("Cookbook:Whole_Wheat_Pancakes");
  });

  it("asks the gateway for the page itself", () => {
    expect(pageSourceUrl("cookbook:pancake#Toppings")).toBe(
      "https://api.wikimedia.org/core/v1/wikibooks/en/page/Cookbook%3APancake",
    );
  });
});
