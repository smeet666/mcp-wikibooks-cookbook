#!/usr/bin/env node
/**
 * Writes the JSON corpus the tests read instead of calling the gateway.
 *
 * The shapes mirror what each route returns, and every dish, ingredient and
 * sentence is invented: no wiki content is stored in this repository, and a
 * deterministic corpus means a test that fails is a change in this code rather
 * than an edit somebody made to a page. The documents carry nodes the parsers
 * must ignore, so a test cannot pass by reading a response too literally.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");
mkdirSync(OUT, { recursive: true });

const write = (name, value) => {
  writeFileSync(join(OUT, name), `${JSON.stringify(value, null, 2)}\n`);
  console.log(`${name}: ${JSON.stringify(value).length} bytes`);
};

const LICENCE = {
  url: "https://creativecommons.org/licenses/by-sa/4.0/deed.en",
  title: "Creative Commons Attribution-Share Alike 4.0",
};

/** A search row, with the nodes the parsers have no use for left in. */
const row = (key, title, extra = {}) => ({
  id: Math.abs(hash(key)),
  key,
  title,
  matched_title: null,
  anchor: null,
  description: null,
  thumbnail: null,
  ...extra,
});

function hash(text) {
  let value = 0;
  for (const character of text) value = (value * 31 + character.codePointAt(0)) | 0;
  return value;
}

write("search-recipes.json", {
  pages: [
    row("Cookbook:Salt_Flat_Noodles", "Cookbook:Salt Flat Noodles", {
      description: "a noodle dish",
      excerpt:
        'Recipes | Noodles Salt flat <span class="searchmatch">noodles</span> are a dish of the orchard country',
      thumbnail: {
        mimetype: "image/jpeg",
        width: 60,
        height: 55,
        url: "//upload.example.invalid/thumb/60px-salt-flat-noodles.jpg",
      },
    }),
    row("Cookbook:Orchard_Butter", "Cookbook:Orchard Butter", {
      excerpt:
        'a spread churned from &quot;late fruit&quot; and <span class="searchmatch">salt</span>',
    }),
    // A page from another book on the same wiki: ranked by the gateway, and no
    // part of the Cookbook.
    row("Glassblowing/Annealing", "Glassblowing/Annealing", {
      excerpt: 'the <span class="searchmatch">salt</span> bath is held just below the strain point',
    }),
    // No key means no page anybody can open, so the row is dropped and counted.
    { id: 5, title: "A row with no key", excerpt: "nothing to link to" },
  ],
});

write("search-empty.json", { pages: [] });

write("search-no-pages.json", { note: "the parsers must not read this" });

/** A recipe with everything the box and the sections can carry. */
const noodles = [
  "__NOTOC__",
  "{{recipesummary|category=Noodle recipes|servings=6|time=1 hour 10 minutes|difficulty=2|Image = [[Image:Salt flat noodles.jpg|300px]]|energy=410Calories/1715 kJ}}",
  "{{recipe}} | [[Cookbook:Noodle Recipes|Noodles]] | [[cookbook:Cuisine of the Salt Flats|Cuisine of the Salt Flats]]",
  "",
  "'''''Salt flat noodles''''' are a dish of the orchard country, built on lamp oil and late fruit.<ref name=\"reame\">{{cite book |last=Reame |first=Vashti |title=Orchard Kitchen |date=1971}}</ref>",
  "",
  "==Ingredients==",
  "*450 [[Cookbook:Gram|g]] (1 [[Cookbook:Pound|pound]]) [[Cookbook:Noodle|flat noodles]]",
  "*225–500 g (½–1 pound) salted orchard butter",
  "*5 [[Cookbook:Egg yolk|egg yolks]]",
  "*178 [[Cookbook:Milliliter|ml]] (¾ [[Cookbook:Cup|cup]]) grated hill cheese",
  "*3–4 [[Cookbook:Tablespoon|tablespoons]] lamp oil",
  "*½ tablespoon freshly-ground [[Cookbook:Pepper|pepper]]",
  "*1 pinch of dried orchard flower",
  "*[[Cookbook:Salt|Salt]]",
  "",
  "==Equipment==",
  "*Large [[Cookbook:Pots and Pans|pot]]",
  "*Wide skillet",
  "*Fork",
  "",
  "== Procedure ==",
  "#Bring a big pot of water to a [[Cookbook:Boiling|boil]] and salt it once it begins to simmer.",
  "#Cook the noodles until they are just short of soft, then drain them, keeping 1 cup of the water.",
  "#Melt the butter in the skillet over a low flame until it smells of nuts.",
  "#Whisk the reserved water into the yolks, add the cheese, and fold the lot through the noodles off the heat.",
  "",
  "==Notes, tips, and variations==",
  "",
  "* Late fruit makes this sweeter; hold back a spoon of the butter if it is very ripe.",
  "",
  "==See also==",
  "*[[Cookbook:Orchard Butter|Orchard butter]]",
  "",
  "==References==",
  "{{reflist}}",
  "[[Category:Salt Flat recipes]]",
  "[[Category:Recipes using noodles]]",
  "[[Category:Recipes with metric units]]",
  "[[Category:Recipes using noodles]]",
].join("\n");

write("page-recipe.json", {
  id: 22971,
  key: "Cookbook:Salt_Flat_Noodles",
  title: "Cookbook:Salt Flat Noodles",
  latest: { id: 4640105, timestamp: "2026-06-13T15:19:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: noodles,
  html_url: "ignored by the parsers",
});

/** A recipe counted in objects rather than servings, with a nutrition panel. */
write("page-yield-in-objects.json", {
  id: 97975,
  key: "Cookbook:Orchard_Balls",
  title: "Cookbook:Orchard Balls",
  latest: { id: 12, timestamp: "2025-02-01T08:00:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary|category=Sweet recipes|yield=24 balls|time=20 minutes|difficulty=1|energy=207Calories/866 kJ}}",
    "{{nutritionsummary|1 ball (47 g)|24|207|94|10.4 g|7.5 g|20 mg|92 mg|26.2 g|1.0 g|12.9 g|2.2 g|3%|2%|3%|4%}}",
    "{{recipe}}",
    "",
    "An '''orchard ball''' is rolled rather than baked, and keeps for a week in a cold room.",
    "",
    "== Ingredients ==",
    "* 3 ¼ [[Cookbook:Cup|cups]] (500 [[Cookbook:Gram|g]] / 1.1 [[Cookbook:Pound|lb]]) rolled oats",
    "* 1 ¼ cups (275 g) pale sugar",
    "* ⅔ cup (160 g) orchard butter, softened",
    "* 6 [[Cookbook:Tbsp|Tbsp]] (90 ml) cold lamp coffee",
    "",
    "== Procedure ==",
    "# Mix the oats and the sugar in a wide bowl.",
    "# Work the butter through the dry things until the dough holds together.",
    "# Roll into balls and chill them for an hour.",
    "",
    "[[Category:Recipes for sweets]]",
  ].join("\n"),
});

/** A yield given as a range, which is not a single number to scale from. */
write("page-yield-range.json", {
  id: 4,
  key: "Cookbook:Flat_Bread",
  title: "Cookbook:Flat Bread",
  latest: { id: 3, timestamp: "2024-11-11T11:11:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary|category=Bread recipes|servings=4 to 6|time=|difficulty=}}",
    "",
    "A '''flat bread''' cooked dry on a stone.",
    "",
    "== Ingredients ==",
    "* 250 g hard flour",
    "* Salt",
    "",
    "== Procedure ==",
    "# Work the flour and the water into a dough and let it rest.",
  ].join("\n"),
});

/** A page in the Cookbook that is not a recipe: no ingredients, no procedure. */
write("page-reference.json", {
  id: 6285,
  key: "Cookbook:Lamp_Oil",
  title: "Cookbook:Lamp Oil",
  latest: { id: 2, timestamp: "2023-05-05T05:05:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{cookwork}}",
    "{{cookdp}}",
    "",
    "'''Lamp oil''' is pressed from the late fruit of the orchard country and used for frying.",
    "",
    "== Selection ==",
    "The clearest pressing keeps the longest.",
    "",
    "[[Category:Fats and oils]]",
  ].join("\n"),
});

/** The gateway's answer for a page that does not exist. */
write("page-missing.json", {
  errorKey: "rest-nonexistent-title",
  messageTranslations: { en: "The specified page (Cookbook:No_Such_Dish) does not exist" },
  httpCode: 404,
  httpReason: "Not Found",
});

/** A page document with no wikitext, which nothing downstream can read. */
write("page-no-source.json", {
  id: 9,
  key: "Cookbook:Empty",
  title: "Cookbook:Empty",
  license: LICENCE,
});

console.log("fixtures written to test/fixtures");
