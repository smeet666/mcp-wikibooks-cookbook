/**
 * A heading inside an HTML comment opens no section.
 *
 * A comment is invisible to whoever reads the page, so the words in it belong
 * to no part of the recipe. Taken as a heading, it cuts the ingredient list in
 * two and files the rest of it under the procedure.
 */

import { describe, expect, it } from "vitest";
import { toRecipePage } from "../../src/wikibooks/parse.js";
import { fixture } from "./helpers.js";

describe("a heading hidden in a comment", () => {
  it("leaves the ingredient list whole", () => {
    const read = toRecipePage(fixture("page-hidden-heading"), "https://example.invalid/page");
    expect(read.ingredients).toEqual(["1 cup rolled oats", "2 cups milk"]);
  });

  it("is no part of the headings the page publishes", () => {
    const read = toRecipePage(fixture("page-hidden-heading"), "https://example.invalid/page");
    expect(read.sectionTitles).toEqual(["Ingredients", "Procedure"]);
  });

  it("leaves the procedure to the heading a reader sees", () => {
    const read = toRecipePage(fixture("page-hidden-heading"), "https://example.invalid/page");
    expect(read.steps).toEqual(["Soak the oats in the milk overnight and warm them through."]);
  });
});
