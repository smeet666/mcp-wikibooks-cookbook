# Changelog

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
