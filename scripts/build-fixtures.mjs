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
  for (const character of text) {
    value = (value * 31 + character.codePointAt(0)) | 0;
  }
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
  id: 22_971,
  key: "Cookbook:Salt_Flat_Noodles",
  title: "Cookbook:Salt Flat Noodles",
  latest: { id: 4_640_105, timestamp: "2026-06-13T15:19:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: noodles,
  html_url: "ignored by the parsers",
});

/** A recipe counted in objects rather than servings, with a nutrition panel. */
write("page-yield-in-objects.json", {
  id: 97_975,
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

/**
 * A recipe whose parts each get their own sub-heading.
 *
 * Every heading this parser reads carries sub-headings here, because a wiki
 * heading owns the sections nested under it and a reader that stops at the
 * first one comes back with two ingredients out of seven.
 */
write("page-grouped-ingredients.json", {
  id: 51_201,
  key: "Cookbook:Orchard_Layer_Cake",
  title: "Cookbook:Orchard Layer Cake",
  latest: { id: 88, timestamp: "2025-09-09T09:09:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary|category=Sweet recipes|servings=8|time=1 hour|difficulty=2}}",
    "{{recipe}}",
    "",
    "An '''orchard layer cake''' is baked in one tin, soaked warm and glazed cold.",
    "",
    "== Ingredients ==",
    "",
    "=== Cake ===",
    "* 125 [[Cookbook:Gram|g]] orchard butter, softened",
    "* 150 g pale sugar",
    "* 3 [[Cookbook:Egg|eggs]]",
    "",
    "=== Soak ===",
    "* 2 [[Cookbook:Tablespoon|tablespoons]] lamp syrup",
    "* 2 tablespoons water",
    "",
    "=== Glaze ===",
    "* 2 tablespoons lamp syrup",
    "* 50 g icing sugar",
    "",
    "== Equipment ==",
    "=== For the cake ===",
    "* Cake pan",
    "=== For the glaze ===",
    "* Small bowl",
    "",
    "== Procedure ==",
    "# Cream the butter and the sugar, then work the eggs through them.",
    "# Bake for 45 minutes and soak the cake the moment it leaves the oven.",
    "=== Finishing ===",
    "# Stir the icing sugar into the syrup and pour it over the cold cake.",
    "",
    "== Notes, tips, and variations ==",
    "* Glaze the day after baking.",
    "=== Keeping ===",
    "* It keeps three days in a cold room.",
    "",
    "[[Category:Recipes for cake]]",
  ].join("\n"),
});

/**
 * A recipe whose procedure is nested one level under its ingredients.
 *
 * The wiki nesting says the steps belong to the ingredient list, and the
 * headings say they are the procedure. The headings win: folding these lines
 * into the list would offer "boil the leaves" as something to buy.
 */
write("page-nested-procedure.json", {
  id: 33_440,
  key: "Cookbook:Wrapped_Rice_Cake",
  title: "Cookbook:Wrapped Rice Cake",
  latest: { id: 7, timestamp: "2025-03-03T03:03:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary|category=Rice recipes|servings=4|time=|difficulty=1}}",
    "",
    "A '''wrapped rice cake''' is boiled in leaves for the best part of a day.",
    "",
    "== Ingredients ==",
    "* 2 [[Cookbook:Cup|cups]] sticky rice, soaked overnight",
    "* 1 cup mung beans, soaked overnight",
    "* 500 [[Cookbook:Gram|g]] pork belly",
    "",
    "=== Procedure ===",
    "* Simmer the beans until they mash, and season them.",
    "* Wrap the rice around the filling and boil the parcels until the rice sets.",
    "",
    "== References ==",
    "{{reflist}}",
  ].join("\n"),
});

/**
 * A recipe whose amounts are written as template calls.
 *
 * A page states an oven temperature and half its weights through `{{convert}}`
 * and its fractions through `{{frac}}`, so the value and the unit live in the
 * template's arguments rather than in the running text.
 */
write("page-measure-templates.json", {
  id: 60_112,
  key: "Cookbook:Lamp_Oil_Buns",
  title: "Cookbook:Lamp Oil Buns",
  latest: { id: 41, timestamp: "2026-01-20T10:00:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary|category=Bread recipes|servings=12|time=40 minutes|difficulty=2}}",
    "",
    "A '''lamp oil bun''' is enriched with the late pressing and baked hot.",
    "",
    "== Ingredients ==",
    "* 1 [[Cookbook:Cup|cup]] ({{convert|225|g|oz|abbr=on|disp=s}}) pale sugar",
    "* {{frac|1|4}} cup lamp oil",
    "* {{convert|170|-|225|g|oz|abbr=on}} orchard butter",
    "* {{sfrac|2|1|2}} cups hard flour",
    "* {{convert|2.5|g}} salt",
    "",
    "== Procedure ==",
    "# Preheat the [[Cookbook:Oven|oven]] to {{convert|180|C|F}} and grease a tray.",
    "# Roll the dough {{convert|0.5|in|cm}} thick and bake it for 20 minutes.",
    "",
    "[[Category:Recipes for bread]]",
  ].join("\n"),
});

/**
 * A recipe publishing alternative ingredient lists under its own sub-headings.
 *
 * The three lists replace one another, and the procedure says to mix
 * everything, so a reader handed one flat list puts three tins of fish in one
 * bowl.
 */
write("page-alternative-lists.json", {
  id: 60_113,
  key: "Cookbook:Lamp_Fish_Salad",
  title: "Cookbook:Lamp Fish Salad",
  latest: { id: 42, timestamp: "2026-02-02T12:00:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary|category=Salad recipes|servings=4|difficulty=1}}",
    "",
    "A '''lamp fish salad''' is eaten cold on toast.",
    "",
    "== Ingredients ==",
    "* 2 [[Cookbook:Cup|cups]] cooked lamp fish",
    "",
    "=== Variation I ===",
    "* 1 large tin lamp fish",
    "* ½ cup orchard cream",
    "",
    "=== Variation II ===",
    "* 2 tins lamp fish",
    "* 3 tablespoons orchard cream",
    "",
    "=== Substitutions ===",
    "* Sour cream in place of orchard cream",
    "",
    "== Procedure ==",
    "# Mix all ingredients in a bowl.",
    "# Chill before serving.",
    "",
    "[[Category:Recipes for salad]]",
  ].join("\n"),
});

/**
 * A recipe stating its time as labelled phases on separate lines.
 *
 * The box holds one field and the page writes two durations into it, separated
 * by a line break, each with the name of the phase it covers.
 */
write("page-phased-time.json", {
  id: 60_114,
  key: "Cookbook:Lamp_Oil_Flatbread",
  title: "Cookbook:Lamp Oil Flatbread",
  latest: { id: 43, timestamp: "2026-03-03T13:00:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary",
    "| Category = Bread recipes",
    "| Servings = 6",
    "| Time = Prep: 1 hour</br>Cooking: 10 minutes",
    "| Difficulty = 2",
    "}}",
    "",
    "A '''lamp oil flatbread''' is rolled thin and cooked dry.",
    "",
    "== Ingredients ==",
    "* 250 [[Cookbook:Gram|g]] hard flour",
    "* 2 tablespoons lamp oil",
    "",
    "== Procedure ==",
    "# Work the flour and the oil into a dough and let it rest.",
    "# Roll it thin and cook it dry on a hot stone.",
  ].join("\n"),
});

/**
 * A recipe stating a fermentation that runs for a range of hours.
 *
 * Waiting is the longest thing the page asks for and it is not cooking, so the
 * two durations describe different things and neither stands for the dish.
 */
write("page-fermented-time.json", {
  id: 60_115,
  key: "Cookbook:Sour_Lamp_Bread",
  title: "Cookbook:Sour Lamp Bread",
  latest: { id: 44, timestamp: "2026-03-04T14:00:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary",
    "| Category = Bread recipes",
    "| Servings = 8",
    "| Time = Fermentation: 12–24 hours<br/>Cooking: 5 minutes per loaf",
    "| Difficulty = 2",
    "}}",
    "",
    "A '''sour lamp bread''' is left to sour before it ever meets a pan.",
    "",
    "== Ingredients ==",
    "* 1 [[Cookbook:Cup|cup]] hard flour",
    "* 1½ cups warm water",
    "",
    "== Procedure ==",
    "# Mix the flour and the water and leave the batter to sour.",
    "# Cook thin rounds of it on a dry pan.",
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

/**
 * The book's own contents page, which is navigation and not a dish.
 *
 * Its headings read like a recipe's and its bullets are links to the chapters
 * behind them, so anything reading headings alone comes back with a shopping
 * list of chapter names.
 */
write("page-index.json", {
  id: 100,
  key: "Cookbook:Orchard_Contents",
  title: "Cookbook:Orchard Contents",
  latest: { id: 4, timestamp: "2026-01-01T01:01:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "__NOTOC__",
    "{{book title|Orchard Cookbook|A collection of recipes from the orchard country.}}",
    "",
    "=== Ingredients ===",
    "* [[Cookbook:Lamp_Oil|Fats & Oils]]",
    "* [[Cookbook:Late_Fruit|Fruit]]",
    "* [[Cookbook:Hard_Flour|Cereals & Grains]]",
    "",
    "=== Equipment ===",
    "* [[Cookbook:Cake_Pan|Bakeware]]",
    "* [[Cookbook:Cookware|Pots & Pans]]",
  ].join("\n"),
});

/**
 * A recipe whose shopping list sits under a heading of the page's own choosing.
 *
 * The box, the banner and the numbered steps all say the page is a recipe. Only
 * the heading over the ingredients is one this parser does not read.
 */
write("page-unread-heading.json", {
  id: 101,
  key: "Cookbook:Orchard_Loaf",
  title: "Cookbook:Orchard Loaf",
  latest: { id: 5, timestamp: "2026-01-02T02:02:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary|category=Bread recipes|yield=1 loaf|difficulty=2}}",
    "{{recipe}}",
    "",
    "An '''orchard loaf''' is baked from late fruit and hard flour.",
    "",
    "== What you need ==",
    "* 3 [[Cookbook:Cup|cups]] hard flour",
    "* 2 late fruit, mashed",
    "",
    "== Procedure ==",
    "# Work the flour and the fruit into a dough.",
    "# Bake it until a skewer comes out clean.",
    "",
    "[[Category:Recipes for bread]]",
  ].join("\n"),
});

/**
 * A recipe whose ingredient names are written as template calls.
 *
 * The wiki expands each call to the word a reader sees, so a parser that drops
 * the call hands back a line naming nothing, and a line that was only a call
 * disappears from the list entirely.
 */
write("page-template-names.json", {
  id: 102,
  key: "Cookbook:Orchard_Compote",
  title: "Cookbook:Orchard Compote",
  latest: { id: 6, timestamp: "2026-01-03T03:03:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary|category=Sweet recipes|servings=4|difficulty=1}}",
    "{{recipe}}",
    "",
    "An '''orchard compote''' is stewed slowly and eaten cold.",
    "",
    "== Ingredients ==",
    "* 500 [[Cookbook:Gram|g]] fresh {{cb|late fruit}}",
    "* 2 [[Cookbook:Tablespoon|tablespoons]] {{cb|pale sugar}}",
    "* {{orchard note|stir once}}",
    "",
    "== Procedure ==",
    "# Stew the fruit with the sugar until it falls apart.",
  ].join("\n"),
});

/**
 * A page whose editors left a heading inside an HTML comment.
 *
 * A comment is invisible to a reader, so the words inside it belong to no
 * section of the page and cannot open one.
 */
write("page-hidden-heading.json", {
  id: 103,
  key: "Cookbook:Orchard_Porridge",
  title: "Cookbook:Orchard Porridge",
  latest: { id: 7, timestamp: "2026-01-04T04:04:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary|category=Breakfast recipes|servings=2|difficulty=1}}",
    "{{recipe}}",
    "",
    "An '''orchard porridge''' is soaked overnight.",
    "",
    "== Ingredients ==",
    "* 1 [[Cookbook:Cup|cup]] rolled oats",
    "<!--",
    "== Procedure ==",
    "an editor left this heading here while rewriting the page",
    "-->",
    "* 2 cups milk",
    "",
    "== Procedure ==",
    "# Soak the oats in the milk overnight and warm them through.",
  ].join("\n"),
});

/** A page carrying two recipes for one dish, each with its own sections. */
write("page-two-recipes.json", {
  id: 104,
  key: "Cookbook:Orchard_Pudding",
  title: "Cookbook:Orchard Pudding",
  latest: { id: 8, timestamp: "2026-01-05T05:05:00Z" },
  content_model: "wikitext",
  license: LICENCE,
  source: [
    "{{recipesummary|category=Sweet recipes|servings=4|difficulty=2}}",
    "{{recipe}}",
    "",
    "Two households of the orchard country make '''orchard pudding''' their own way.",
    "",
    "== Ingredients ==",
    "* 200 [[Cookbook:Gram|g]] late fruit",
    "* 100 g pale sugar",
    "",
    "== Procedure ==",
    "# Stew the fruit with the sugar and chill it.",
    "",
    "== Ingredients (baked) ==",
    "* 300 g late fruit",
    "* 2 [[Cookbook:Egg|eggs]]",
    "",
    "== Procedure (baked) ==",
    "# Beat the eggs through the fruit and bake the pudding.",
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
