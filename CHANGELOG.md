# Changelog

## 2.0.1

- **Every tool is documented, with its arguments and what its answer carries.**
  The README is written for a person deciding whether to install and for a
  program installing on its own, and a test holds both halves to what the server
  registers.
- **The privacy policy travels in the package.** It states the hosts contacted,
  what a request carries, what is held and for how long.
- **The manifest names every tool the server registers**, which a host reads
  before installing anything.

## 2.0.0

- **This server now needs node 24 or later.** Node 20 reached its end of
  support on 2026-04-30 and node 22 is no longer what this code is built and
  typed against. That is what makes this a major version: an install on an
  older node is refused rather than left to fail somewhere later.
- **Every refusal of an argument opens with `invalid_input`.** A value outside
  its bounds, of the wrong type, or outside the set an argument reads used to
  come back in the validator's own words, with no code to branch on.
- **A container image is published for each version**, on ghcr, for amd64 and
  arm64. The readme carries the configuration that runs it.
- The published package carries its changelog, and the entry point it declares
  for the package root now publishes its types.

## 1.3.1

- The README carries the same badge row as every server here: npm, CI, the
  licence, the MCP registry entry, the Glama score, and one-click installs for
  Cursor and VS Code. Each install link encodes this package. npm serves the
  README frozen at publish time, so a release is what puts it there.

## 1.3.0

- Keep the ingredient a template call names. A Cookbook page can write the name
  of an ingredient as `{{cb|apple}}`, which the wiki expands to a link showing
  that word, and the call was removed with the word inside it: the page
  `Cookbook:Homemade Cider Vinegar` asked for "4 kg (8.8 lb) fresh s". A line
  whose whole content was such a call disappeared from the list with no trace
  and no count, which is the answer somebody avoiding an ingredient acts on. The
  call now contributes the word it puts on the page, and a bullet that still
  comes back empty is counted and named in a note rather than dropped.

- Scale the quantity a line states in brackets while asking for no fixed amount.
  `Warm water as required (about 1 ½ cups)` was answered "No quantity given;
  adjust to taste", so the flour of a doubled chapati doubled and the water did
  not. The bracket is read when everything inside it is one amount with a unit,
  which leaves "(about 110 °F)" and "(the riper the better)" as the prose they
  are; the figure grows with the recipe and the wording in front of it is
  repeated as published.

- Scale both branches of a choice written in brackets. `4 eggs (or 8 egg yolks)`
  tripled gave "12 eggs (or 8 egg yolks)", and a cook taking the second branch
  got a third of the recipe; the same choice written without brackets was
  already handled. A bracket opening on "or" now splits the line the same way,
  each branch is scaled on its own, and the line says how far one stands for the
  other is the page's claim. A quantity written with a fraction character, as in
  "1½ cup", is recognised where it sits inside a branch, so a second amount left
  as published is named instead of passing unremarked.

- Say what a page has to carry before its lists are called a recipe's. The
  Cookbook keeps recipes and the book's own chapter indexes in one namespace and
  both write "Ingredients" over a bulleted list, so `Cookbook:Table of Contents`
  came back with twelve ingredients, five pieces of equipment and a note stating
  that the page publishes ingredients. A page with no recipe box, no recipe
  banner and no procedure now returns empty lists and says the bullets under its
  headings are links to other pages.

- Stop telling a recipe it may not be one. `Cookbook:Banana Bread III` states a
  yield, a difficulty and seven numbered steps, and its shopping list sits under
  a heading of the page's own choosing; the answer offered "It may be a page
  about an ingredient, a technique or a cuisine rather than a recipe". Such a
  page is now named as a recipe whose list was not found, and the headings it
  does publish are named so the list can be read where the page put it.

- Read a heading only where a reader would see one. A heading parked inside an
  HTML comment while a page is being rewritten is invisible on the page, and it
  opened a section all the same: the ingredient list was cut at the comment and
  the rest of it filed under the procedure. Comments are removed before the page
  is divided into sections. No page of the Cookbook was found doing this, and
  the mechanism was reproduced on a page written for the purpose.

- Name the sections a page carries beside the ones read. A heading owns what is
  nested under it and stops at the next heading of its own level, so a page
  writing its ingredients twice at the top level publishes two recipes and only
  the first was returned, in silence. What was left is now named in a note:
  merging the two would build a list nobody would cook, and saying nothing hands
  back half a page as the page. No Cookbook page was found carrying two recipes
  this way; `Cookbook:Broth and Stock` loses a second "Ingredient" section to the
  same rule and now says so.

- Say what a title search matched on. Searching titles for "aubergine" returns
  `Cookbook:Eggplant`, and the answer said the row had "matched inside the page
  rather than in the title" on a search that opens no page. A row whose name does
  not carry the words is now named for what it is: a page the Cookbook files
  under another name.

- Read the amount a page writes as a template call. A Cookbook page states its
  oven temperature and many of its weights through `{{convert}}`, and its
  fractions through `{{frac}}`, which puts the only figure in the sentence
  inside the call. The call was removed with everything in it, so a recipe read
  "Preheat the oven to ." and asked for "1 cup () white sugar": an instruction
  and a shopping line that both look finished and carry no number. What comes
  back is the value and the unit the page wrote, both ends of a range included.
  The counterpart such a template computes belongs to the other measuring
  system and is left out, since measurements here are repeated in the system
  the source chose.

- Tell an alternative ingredient list from a part of the dish. Both are written
  as a sub-heading under the ingredients, and only the wording separates them: a
  cake and its glaze are made together, a first and a second version of a salad
  replace one another. Read alike, three versions of a tuna salad became one
  list of nineteen lines, three tins of fish and two and a half cups of
  mayonnaise, under a procedure whose first step is "Mix all ingredients in a
  bowl". A heading naming a variation, a version, an option or a substitution
  now opens a list of its own: every line says which one it came from as
  `variant`, `group` stays null on those lines because they name no part of the
  dish, the lists are printed apart, and a note says one of them is used instead
  of the others. Stated as a rule over the wording rather than as a list of the
  headings met so far.

- Say what a total time can honestly claim. The recipe box holds one field, and
  a page with more than one thing to say writes several durations into it,
  separated by a line break: "Prep: 1 hour", "Fermentation: 12–24 hours",
  "Cooking: 5 minutes". The break was removed without a space, gluing "1 hour"
  to the next label until it stopped being a duration, and what was left was
  read as the time of the whole dish: ten minutes for a ravioli that takes an
  hour to make, five for an injera whose batter sours overnight. Each duration
  is now read on its own and published in `time_phases`, with the page's own
  wording and both ends of a range; `prep_minutes` and `cook_minutes` carry the
  phases the page labels as such. `total_minutes` states a total only where the
  page states one, as a single duration or as a phase the page itself calls the
  total. Phases are never added: a fermentation, a marinade and a rest measure
  different things from a cooking, and their sum is a figure no page published.
  Where the total is null and the phases are not, a note says so.
- Read an ingredient list that a page splits across sub-headings. A heading on a
  wiki owns the sections nested under it, and the list was cut at the first
  sub-heading: a cake with its soak and its glaze under `=== Cake ===`,
  `=== Soak ===` and `=== Glaze ===` came back with no ingredients at all, on a
  page carrying ten, and the same cut emptied the equipment, the steps and the
  notes of any page that groups them. Every part now covers what is nested under
  it, stopping at a nested heading that names another part of the recipe: a page
  filing its procedure one level under its ingredients still states steps, not
  things to buy. Each line carries the sub-heading it sits under as `group`, so
  two tablespoons of rum for the soak and two for the glaze read as the recipe
  rather than as a repeat.

- Follow a page whose only content is a redirect. `Cookbook:Carbonara` points at
  `Cookbook:Spaghetti alla Carbonara`, and it was read as a recipe with a title,
  no ingredients and no steps, which is what a dish the Cookbook does not hold
  looks like. The pointer is followed to the page a reader would land on; `id`
  names the page that was read, `redirected_from` names the addresses walked,
  and a note says the hop was made. A chain that loops or keeps going is
  refused, naming the addresses it walked, rather than answering with the shell
  it ended on.

- Read an abbreviated unit carrying a plural mark. `Cookbook:Bánh chưng` writes
  "1 tbsp vegetable oil" and "3 tbsps fried shallot" three lines apart, and only
  the first was recognised as a spoon: the other went to the branch that counts
  indivisible objects, where a quarter of a spoonful was clamped up to the
  "1/2 tbsps" no kitchen owns. Every abbreviation now answers to the plural mark
  a page writes on it, so two neighbouring lines of one page are scaled by the
  same rule.

- Put a floor under a spoonful. A cup divided a thousandfold walked down to the
  smallest spoon and stopped at "0.05 teaspoon flour", where a clove of garlic
  in the same recipe was clamped up to a half and said it no longer held its
  share. A spoon measure that reaches the bottom of its ladder still under what
  a measuring set carries is now clamped the same way and says the same thing.
  Figures a note quotes are written with the digits they have: an amount too
  small for the two decimals a note prints was rendered "0", so a line read
  "Rounded up from 0 cup" beside a quantity that was not zero, and the clamped
  amount is stated in the unit the line came back in.

- Count a tin as the container it is. The vocabulary carried the can and not the
  tin, so `Cookbook:Pizza Soup` and `Cookbook:Vegetable Stew and Dumplings` had
  their tin read as no measure at all and the question of how far one divides
  fell to what was inside it: a quarter of a tin of tomatoes, because a tomato
  is quartered. A tin now divides as a can does, at the half. The tool
  description and the shape of a scaled line state the three shares a counted
  thing can land on, which is what the code applies.

- Read a page reference the way the wiki reads an address. A title opens on a
  capital and an anchor names a section of a page rather than a page, and the
  gateway answers a reference in either shape by pointing at the form below;
  followed, that pointer led to a page in HTML, and a mistyped identifier came
  back as `parse_failure` blaming Wikimedia and inviting a bug report.
  `Cookbook:Whole Wheat Pancakes#Ingredients` now reads the recipe, a lowercase
  first letter is raised, and a name the Cookbook does not hold is the
  `not_found` it always was.

- Answer for the words a page publishes and the numbers it states. A yield of
  "1/2" was read as one serving counted in "/2", so every quantity was rescaled
  from twice the yield; the fraction is now read as the number it is. Text
  quoted inside `<blockquote>` comes back as the sentence a reader sees. A
  template standing in a sentence contributes the words it shows: an interwiki
  link and a phrase marked as foreign kept their brackets and lost their word,
  and a call that renders nothing left the brackets it stood in sitting empty.
  The redirect ceiling states as many hops as it lists addresses.

## 1.2.0

- Decode the HTML entities a page writes for a character it cannot type. A line
  reading "3&frac12; cups" shows three and a half cups to whoever visits the
  page, and it was read as three: doubling it answered six where the page asked
  for seven, and called the arithmetic exact. Where the entity carried the whole
  amount, as in "&#8532; cups", the line came back saying it had no quantity at
  all.

- Read a number grouped in thousands. "1,500 g flour" was read as one gram with
  ",500 g" left over in the name of the ingredient, and doubled to "2 ,500 g": a
  broken line, a quantity a thousandfold too small, and a label saying the
  arithmetic had been exact. Where a comma groups anything other than three
  digits the number belongs to another convention, and the line comes back as
  published rather than under a guess that could be wrong by a factor of a
  thousand.

- Stop multiplying a figure that was never a count. "4 to 5-pound boneless pork
  loin roast" describes one roast and was doubled into eight to ten of them, and
  an amount stated per person already carries the change the factor asks for.
  Both come back as the page published them, with a note saying why.

- Read the quantity behind the word that hid it. "~1 cup water" and "about 6
  medium lemons" carried an amount that was answered as if the line had none, and
  "1 small handful of parsley" lost the handful, and with it the fact that a
  handful is held to no better than the hand. Both now read through to the
  figure and the measure, and put the word and the sign back where the page had
  them.

- Read the remaining shapes a Cookbook page takes: a plural mark written as
  "tablespoon(s)", a bracket the page left empty, and "recipe" naming another
  dish of the book, which took its plural on the dish rather than on the count.

- Put both ends of a range in one unit, chosen from the lower one, where it was
  chosen from the upper one and "225–500 g" doubled came back as "0.45–1 kg". A
  range whose two ends land on the same amount states that amount once and says
  so, instead of offering "1–1 large egg".

- Round a mass or a volume in the smaller of the two units when the answer moves
  to a bigger one, so a promotion no longer costs precision the page had. A
  recipe made smaller never comes out asking for more than the page published,
  where reducing a line by one percent could raise it by one, and a result a
  hundredth away from a product of six thousandths is now reported as rounded
  rather than exact.

- Say more about what happened to a line. A range whose two ends moved names each
  of them with its own direction, rather than naming one and stating the wrong
  direction for half the quantity; a second quantity left at its published size
  is reported even on a line that was also rounded, where the two notes competed
  and the rounding won; a quantity below what a kitchen scale resolves says so;
  and a line whose amount came from an article says which word it read as a
  number. The exact product quoted in a note is written in decimals, since a
  kitchen fraction snapped from 2.25 to "2 1/4" prints the figure being compared
  against as a different number.

- Take a clove of garlic to the half and no finer, as the person who cooks these
  recipes has it. The clove that names no garlic is the dried bud, and stays
  whole.

## 1.1.0

- Refuse an argument the schema does not declare, rather than dropping it in
  silence. A caller who misspells one was answered from the defaults as though
  the call had been understood. The refusal names the argument, suggests the real
  one when it is close, and lists what the tool takes.

- Rewrite the rule that decides how far a counted thing can be divided. It read
  the packaging, so a can of tomatoes was never halved although half a can of
  apricots in syrup is poured out and the rest kept. What decides is the size of
  one unit against what a recipe puts in: a shrimp, a mussel, a peppercorn is
  already a portion, counted by the dozen, and a smaller recipe puts one fewer in
  the pan; a leg of lamb, a camembert, a pineapple is asked for by the one and
  shared out with a knife. An egg, a yolk and a white stay whole, since halving
  one means beating it and weighing the result. A juice stops at the half.

- Tell the two cloves apart. The word names the garlic clove, which a recipe
  counts by the four and divides, and the clove spice, which stays whole; the
  line itself says which one it is.

- Read a dozen as the twelve it stands for, and tell a chicken egg from a chicken
  breast from the bird, which one word names and which divide differently.

- Agree a counted noun with the number that precedes it in more places. The
  -ves to -f rule applied to every word, so four whole cloves came back as
  "1 whole clof".

## 1.0.0

First release.

- `search_recipes`: full-text or title search of the Cookbook, scoped to the namespace, with a
  count of the ranked pages that belonged to other books and were dropped.
- `get_recipe`: ingredients, equipment, procedure, tips, yield, time, difficulty, category and
  the nutrition panel when a page carries one, with an optional rescale by servings.
- `scale_ingredients`: the same rescaling on any list, offline.
- `list_recipes`: browse by cuisine, kind of dish or main ingredient.
- Countable things land on a whole or a half, a measurement is demoted to a smaller unit before
  it is rounded, both ends of a range and every bracketed equivalent are scaled together, and
  what cannot be multiplied is flagged rather than multiplied.
