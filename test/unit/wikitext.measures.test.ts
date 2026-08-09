/**
 * Amounts a page writes as a template call.
 *
 * A Cookbook page states an oven temperature and many of its weights through
 * `{{convert}}`, and its fractions through `{{frac}}`, which puts the figure
 * and the unit in the template's arguments. A reader that drops the call keeps
 * the sentence around it and loses the only number in it, and the loss is
 * silent: "Preheat the oven to ." and "1 cup () white sugar" both read as
 * finished lines.
 *
 * What is rendered is the value and the unit the page wrote. The counterpart
 * the template computes belongs to the other measuring system, and this server
 * repeats measures as the source publishes them.
 */

import { describe, expect, it } from "vitest";
import { flattenWikitext } from "../../src/wikibooks/wikitext.js";
import { toRecipePage } from "../../src/wikibooks/parse.js";
import { fixture } from "./helpers.js";

const URL = "https://api.wikimedia.org/core/v1/wikibooks/en/page/x";

describe("a conversion template", () => {
  it("states the temperature the page wrote", () => {
    expect(flattenWikitext("Preheat the oven to {{convert|180|C|F}}.")).toBe(
      "Preheat the oven to 180 °C.",
    );
  });

  it("states the weight the page wrote, inside the brackets that held it", () => {
    expect(flattenWikitext("1 cup ({{convert|225|g|oz|abbr=on|disp=s}}) white sugar")).toBe(
      "1 cup (225 g) white sugar",
    );
  });

  it("keeps a value given with no target unit", () => {
    expect(flattenWikitext("{{convert|2.5|g}} salt")).toBe("2.5 g salt");
  });

  it("keeps both ends of a range in the unit they were written in", () => {
    expect(flattenWikitext("{{convert|170|-|225|g|oz|abbr=on}} butter")).toBe("170–225 g butter");
  });

  it("reads the call however it is spelled", () => {
    expect(flattenWikitext("{{Convert|350|F|C}}")).toBe("350 °F");
    expect(flattenWikitext("{{cvt|20|cm|in}}")).toBe("20 cm");
  });

  it("drops a call whose arguments carry no number, rather than inventing one", () => {
    expect(flattenWikitext("Bake until done{{convert}}.")).toBe("Bake until done.");
  });
});

describe("a fraction template", () => {
  it("reads a numerator over a denominator", () => {
    expect(flattenWikitext("{{frac|1|4}} cup lamp oil")).toBe("1/4 cup lamp oil");
  });

  it("reads a whole number carrying a fraction", () => {
    expect(flattenWikitext("{{sfrac|2|1|2}} cups flour")).toBe("2 1/2 cups flour");
  });

  it("reads a lone argument as one part of that many", () => {
    expect(flattenWikitext("{{frac|16}} of a pound")).toBe("1/16 of a pound");
  });
});

describe("a recipe whose amounts are written as templates", () => {
  const page = toRecipePage(fixture("page-measure-templates"), URL);

  it("states every quantity the page publishes", () => {
    expect(page.ingredients).toEqual([
      "1 cup (225 g) pale sugar",
      "1/4 cup lamp oil",
      "170–225 g orchard butter",
      "2 1/2 cups hard flour",
      "2.5 g salt",
    ]);
  });

  it("states the oven temperature in the step that calls for it", () => {
    expect(page.steps[0]).toBe("Preheat the oven to 180 °C and grease a tray.");
    expect(page.steps[1]).toBe("Roll the dough 0.5 in thick and bake it for 20 minutes.");
  });

  it("leaves no empty brackets where a call stood", () => {
    for (const line of [...page.ingredients, ...page.steps]) {
      expect(line).not.toMatch(/\(\s*\)/);
    }
  });
});
