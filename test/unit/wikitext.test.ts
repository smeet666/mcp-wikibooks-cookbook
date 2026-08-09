import { describe, expect, it } from "vitest";
import {
  findTemplates,
  flattenWikitext,
  listItems,
  readCategories,
  sectionBody,
  sectionChunks,
  splitSections,
  templateArg,
} from "../../src/wikibooks/wikitext.js";

describe("flattenWikitext", () => {
  it("shows the label of a link, and the page when there is no label", () => {
    expect(flattenWikitext("450 [[Cookbook:Gram|g]] [[Cookbook:Salt]]")).toBe("450 g Salt");
  });

  it("drops the namespace from a target used as its own label", () => {
    expect(flattenWikitext("[[Cookbook:Olive Oil]]")).toBe("Olive Oil");
    expect(flattenWikitext("[[w:Fika]]")).toBe("Fika");
  });

  it("shows the page rather than the anchor on a section link", () => {
    expect(flattenWikitext("[[Cookbook:Mixing#Tossing|Toss]] it")).toBe("Toss it");
    expect(flattenWikitext("[[Cookbook:Mixing#Tossing]]")).toBe("Mixing");
  });

  it("removes references, which are bibliography rather than instruction", () => {
    const source = 'Made in the 20th century.<ref name="a">{{cite book |title=X}}</ref> Really.';
    expect(flattenWikitext(source)).toBe("Made in the 20th century. Really.");
  });

  it("removes a self-closing reference", () => {
    expect(flattenWikitext('Cream is rare.<ref name="a" /> In Italy.')).toBe(
      "Cream is rare. In Italy.",
    );
  });

  it("removes an image with a caption holding its own link", () => {
    expect(flattenWikitext("[[File:X.jpg|thumb|A [[Cookbook:Pot|pot]]]]after")).toBe("after");
  });

  it("removes bold and italic marks without eating apostrophes", () => {
    expect(flattenWikitext("'''''Carbonara''''' is the cook's own")).toBe(
      "Carbonara is the cook's own",
    );
  });

  it("keeps the label of an external link", () => {
    expect(flattenWikitext("see [https://example.invalid/x the notes] there")).toBe(
      "see the notes there",
    );
  });
});

describe("findTemplates", () => {
  const source =
    "{{recipesummary|category=Pasta recipes|servings=6|time=1 hour|difficulty=2|Image = [[Image:X.JPG|300px]]}}\n" +
    "text<ref>{{cite book |title=Guida |url=http://x.invalid/?a=b&c=d}}</ref>\n" +
    "{{nutritionsummary|1 ball (47 g)|24|207}}";

  it("reads an infobox whose arguments hold their own markup", () => {
    const box = findTemplates(source, "recipesummary")[0]!;
    expect(templateArg(box, "category")).toBe("Pasta recipes");
    expect(templateArg(box, "servings")).toBe("6");
    expect(templateArg(box, "image")).toBe("[[Image:X.JPG|300px]]");
  });

  it("matches a name whatever its spacing and case", () => {
    expect(findTemplates(source, "Recipe Summary")).toHaveLength(1);
  });

  it("does not return a template nested inside another", () => {
    const nested = "{{recipesummary|servings={{convert|4}}|time=1 hour}}";
    expect(findTemplates(nested, "convert")).toHaveLength(0);
    expect(templateArg(findTemplates(nested, "recipesummary")[0]!, "time")).toBe("1 hour");
  });

  it("reads arguments given by position", () => {
    const panel = findTemplates(source, "nutritionsummary")[0]!;
    expect(templateArg(panel, "servingsize", 0)).toBe("1 ball (47 g)");
    expect(templateArg(panel, "cals", 2)).toBe("207");
    expect(templateArg(panel, "iron", 15)).toBeNull();
  });

  it("does not read an equals sign inside a URL as an argument name", () => {
    const cite = findTemplates("{{cite web|url=http://x.invalid/?a=b|title=T}}", "cite web")[0]!;
    expect(templateArg(cite, "url")).toBe("http://x.invalid/?a=b");
    expect(templateArg(cite, "title")).toBe("T");
  });

  it("returns nothing for a template that never closes", () => {
    expect(findTemplates("{{recipesummary|servings=4", "recipesummary")).toEqual([]);
  });
});

describe("splitSections", () => {
  const source = "lead text\n\n==Ingredients==\n*a\n\n===Sub===\n*b\n\n== Procedure ==\n#step\n";

  it("keeps the lead under an empty title", () => {
    const sections = splitSections(source);
    expect(sections[0]!.level).toBe(0);
    expect(sections[0]!.body.trim()).toBe("lead text");
  });

  it("names each heading and stops it at the next one of any level", () => {
    const sections = splitSections(source);
    expect(sections.map((section) => section.title)).toEqual([
      "",
      "Ingredients",
      "Sub",
      "Procedure",
    ]);
    expect(sections[1]!.body).toContain("*a");
    expect(sections[1]!.body).not.toContain("*b");
  });
});

describe("sectionBody", () => {
  const source = [
    "lead",
    "==Ingredients==",
    "*a",
    "===Cake===",
    "*b",
    "====Crumb====",
    "*c",
    "===Glaze===",
    "*d",
    "==Procedure==",
    "#step",
  ].join("\n");
  const sections = splitSections(source);

  it("covers every section nested under the heading, however deep", () => {
    const body = sectionBody(sections, 1);
    expect(body).toContain("*a");
    expect(body).toContain("*b");
    expect(body).toContain("*c");
    expect(body).toContain("*d");
  });

  it("stops at the next heading of the same level or shallower", () => {
    expect(sectionBody(sections, 1)).not.toContain("#step");
  });

  it("leaves out a nested section that stands on its own, and its own children", () => {
    const body = sectionBody(sections, 1, { standsAlone: (section) => section.title === "Cake" });
    expect(body).toContain("*a");
    expect(body).not.toContain("*b");
    expect(body).not.toContain("*c");
    expect(body).toContain("*d");
  });

  it("returns nothing for an index no section stands at", () => {
    expect(sectionBody(sections, 99)).toBe("");
  });
});

describe("sectionChunks", () => {
  const sections = splitSections(
    ["==Ingredients==", "*a", "===Cake===", "*b", "====Crumb====", "*c"].join("\n"),
  );

  it("names the sub-heading each run of text sits under", () => {
    // Index 1: index 0 is the lead, which a page opening on a heading leaves empty.
    const chunks = sectionChunks(sections, 1);
    expect(chunks.map((chunk) => chunk.subheading)).toEqual([null, "Cake", "Crumb"]);
    expect(chunks[1]!.body).toContain("*b");
  });
});

describe("listItems", () => {
  it("reads a bulleted list and flattens what is in it", () => {
    expect(listItems("*450 [[Cookbook:Gram|g]] pasta\n*Salt\n", "*#")).toEqual([
      "450 g pasta",
      "Salt",
    ]);
  });

  it("reads a numbered list", () => {
    expect(listItems("#First\n#Second\n", "#*")).toEqual(["First", "Second"]);
  });

  it("leaves a sub-bullet out, because it is a remark and not a further line", () => {
    expect(listItems("*Onion\n**finely diced\n*Salt\n", "*#")).toEqual(["Onion", "Salt"]);
  });

  it("returns nothing for a section laid out as a table", () => {
    expect(listItems('{| class="wikitable"\n!Ingredient\n|-\n|Sugar\n|}', "*#")).toEqual([]);
  });
});

describe("readCategories", () => {
  it("reads each category once, in the order the page declares them", () => {
    const source =
      "[[Category:Italian recipes]]\n[[Category:Featured recipes|*]]\n[[Category:Italian recipes]]";
    expect(readCategories(source)).toEqual(["Italian recipes", "Featured recipes"]);
  });
});
