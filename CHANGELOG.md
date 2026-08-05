# Changelog

## Unreleased

- Ingredients written as a `wikitable` are read: the amount comes from whichever of the Count,
  Volume and Weight columns the row fills, and a baker's percentage column is left out of it.
- A rescale of a page that yielded no quantities reports no factor and says the page delivered
  none, rather than announcing a multiplication over an empty list.
- A count of eggs, yolks or whites lands on a whole number, and a rounded line says which way
  it moved. A clove of garlic still halves.
- An approximate measure is scaled as a count: "a pinch" taken from six servings to twenty-five
  is four pinches, with the everyday equivalence in the note rather than in the quantity.
- A measure named after what holds it is read from the word itself: the -ful suffix means "as
  much as one of these holds", so a capful, a spoonful or a jarful is scaled as a count in the
  same way as a pinch, and a container that has never come up is understood the first time it
  appears. The gestures a name says nothing about the size of, such as a glug, a dollop, a
  squeeze or a grating, are carried in the vocabulary alongside the pinch and the dash.
- A line stating a share of one thing takes the article with the share: "2/3 of a bottle of
  orange blossom water" scaled sixfold reads "4 bottles of orange blossom water", with the
  plural on the thing being counted rather than on the last word of the line.
- A fraction spelled out is read like one written in figures, so "half a bottle", "half of a
  bottle" and "two thirds of a cup" all carry an amount, and the unit standing behind the
  article is found: "half a teaspoon salt" tripled is "1.5 teaspoons salt". A share of a thing
  named elsewhere, as in "half of the dough", carries no amount of its own and is left as
  published.
- `search_recipes` says how many rows matched inside the page rather than in the title, because
  the Cookbook links to dishes it does not hold.
- Names of food that take no plural, such as broccoli, and those whose plural is irregular, such
  as potato, keep their spelling when a count is rewritten.

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
