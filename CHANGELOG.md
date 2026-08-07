# Changelog

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
