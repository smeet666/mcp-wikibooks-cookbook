# Contributing

Thanks for looking. This is a small, single-maintainer project, and everything
below is meant to save you from writing something that then has to be rewritten.

## Where to say something

Open an issue: <https://github.com/smeet666/mcp-wikibooks-cookbook/issues>

That is the right place for a bug, a question, an idea, or "this quantity looks
wrong to me". There is no mailing list, no chat and no support address. The npm
page is not a channel: nothing posted there reaches me.

## Pull requests are welcome, but talk to me first

Please open an issue before you write the code, even when you are sure of the
fix. Not to gate you: to agree on what the right answer actually is. Most of the
decisions in this repository are about what a model should be told, and two
reasonable people land on different answers. A short exchange up front is
cheaper for you than a rewrite after review.

The exception is the obviously mechanical: a typo, a dead link, a wrong version
in the documentation. Send those straight as a pull request.

If you have already written the code, open the pull request anyway and say so.
Nothing is wasted; we will just discuss the shape in the pull request instead.

## What a good report contains

The tool you called, the arguments you passed, and what came back. A single
copy-paste of the result is worth several paragraphs of description.

If a quantity is what went wrong, give the ingredient line as the page publishes
it, the servings you asked for, and the line you expected. A rounding rule is
argued from one concrete line far more easily than in the abstract.

If the server returned an error code, include it. `not_found`, `rate_limited`,
`parse_failure`, `invalid_input`, `timeout` and `network_error` mean quite
different things, and the first question is always which one you saw.

## What this server will and will not do

It reads the Cookbook on the English Wikibooks and returns what it reads. It
does not edit the wiki, it holds no account, and it needs no API key.

Four rules shape most of the code, and a change that breaks one of them will be
turned down however useful it looks:

- **A failure is never reported as an empty result.** If a request could not be
  made, the answer says so. Silence about a failure becomes "there is no such
  recipe" in the mouth of a model, which is a false statement about the world.
- **Every result carries its page and its licence.** Cookbook text is published
  under Creative Commons Attribution-ShareAlike 4.0, so a caller who repeats it
  has to credit Wikibooks and share alike. The address and the licence go out
  with the recipe for that reason.
- **A quantity is either scaled honestly or flagged.** Rounding a countable
  thing, demoting a measurement before rounding it, refusing to cut a sealed
  packet: all of it exists so that no line comes back multiplied in a way a
  kitchen cannot follow, and no line comes back multiplied when it should not
  have been touched at all.
- **The server paces itself.** Wikimedia runs the developer gateway for free,
  and the minimum interval between requests has a floor that configuration
  cannot go below, whether the setting arrives from the environment or from a
  configuration object handed to the published client.

## Running it locally

```bash
npm install
npm run typecheck
npm test            # unit tests, everything upstream is a fixture
npm run build
npm run inspector   # drive the tools by hand in the MCP Inspector
```

The unit tests never touch the network. There is also a live suite,
`WB_LIVE=1 npm run test:live`, which does: it makes one request per route
against `api.wikimedia.org` and checks the fields the parsers depend on. Run it
if you changed anything in the parsing layer, and expect it to be slow, since
the pacing applies there too.

`npm run format` before you commit.

## The shape of the code

The access layer under `src/wikibooks` never imports the MCP SDK, and the MCP
layer under `src/tools` never performs HTTP. That separation is why the client
is published as its own subpath export and usable as a plain library, so please
keep it. Every address the server calls lives in `src/wikibooks/urls.ts`, so an
upstream rename is a one-file change. The arithmetic lives under `src/recipe`,
where `quantity.ts` reads a line, `units.ts` holds the vocabulary and `scale.ts`
decides what a scaled line is allowed to say.

The tools are `search_recipes`, `get_recipe`, `scale_ingredients` and
`list_recipes`. A new tool is a bigger conversation than a new field on an
existing one, which is another reason to open an issue first.

Every new output field needs a `.describe()` saying what it means, in the words
a cook would use rather than the words the wiki uses.

## Touching the scaling

This is where a well-meant change does the most damage, because a wrong quantity
looks exactly like a right one. Two habits keep it safe.

Add a test that states the line and the answer you want, in the units the line
uses. The suite is full of them, and one more costs nothing.

Say which rule your change belongs to. A count of eggs and a count of garlic
cloves round differently because half an egg cannot be measured out and half a
clove can; a sealed packet is not cut at all; a pinch is multiplied as pinches
because it is an amount rather than a measurement. A change that moves one line
into a different rule usually needs the rule restated, not just the line fixed.

Where a food name is rewritten in the plural, the vocabulary of irregular and
uncountable names lives with the rest of the vocabulary, and adding a word there
is a welcome and very cheap contribution.

## Writing style in the code

Comments explain why, not what, and they read as if the code had always looked
this way. Someone reading the file for the first time should not have to know
what it replaced.

## When the wiki changes

The Cookbook is written by volunteers, and the gateway serving it is a public
service rather than a versioned product. When either changes shape, the unit
tests stay green because they run on generated fixtures, and the nightly live
canary is what catches it. If you see a `parse_failure` in normal use, that is
very likely what happened, and it is worth an issue with the arguments that
triggered it.
