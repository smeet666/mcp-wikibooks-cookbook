# mcp-wikibooks-cookbook

[![npm](https://img.shields.io/npm/v/mcp-wikibooks-cookbook.svg)](https://www.npmjs.com/package/mcp-wikibooks-cookbook)
[![CI](https://github.com/smeet666/mcp-wikibooks-cookbook/actions/workflows/ci.yml/badge.svg)](https://github.com/smeet666/mcp-wikibooks-cookbook/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/mcp-wikibooks-cookbook.svg)](LICENSE)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-6E56CF)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.smeet666/mcp-wikibooks-cookbook)
[![Glama](https://glama.ai/mcp/servers/smeet666/mcp-wikibooks-cookbook/badges/score.svg)](https://glama.ai/mcp/servers/smeet666/mcp-wikibooks-cookbook)

An MCP server for the [Cookbook](https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents) on
the English Wikibooks: thousands of recipes written and maintained in the open, with their
ingredients, their equipment and their steps. **Search them, read one, and rescale it to the
number of people you are actually cooking for.** No API key, no account, read-only.

_(Version française plus bas / French version below)_

## Quickstart

**One-click install**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=wikibooks-cookbook&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC13aWtpYm9va3MtY29va2Jvb2siXX0%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=wikibooks-cookbook&config=%7B%22name%22%3A%22wikibooks-cookbook%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-wikibooks-cookbook%22%5D%7D)

**Claude Code**

```bash
claude mcp add wikibooks-cookbook -- npx -y mcp-wikibooks-cookbook
```

**Claude Desktop, Cursor, and any client using the standard config format**

```json
{
  "mcpServers": {
    "wikibooks-cookbook": {
      "command": "npx",
      "args": ["-y", "mcp-wikibooks-cookbook"]
    }
  }
}
```

Node 20 or later.

**Bundle, without npm**

Download `mcp-wikibooks-cookbook-<version>.mcpb` from
[the latest release](https://github.com/smeet666/mcp-wikibooks-cookbook/releases/latest) and
open it. A client that supports MCP bundles installs it on its own, with no npm and no
configuration file to edit.

## Tools

| Tool                | What it does                                               | Key parameters                                     |
| ------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| `search_recipes`    | Finds a page by dish name or by an ingredient it uses.     | `query`, `search`, `limit`                         |
| `get_recipe`        | Reads one page, optionally rescaled.                       | `id`, `servings`, `max_description_chars`          |
| `scale_ingredients` | Rescales any English ingredient list, without the network. | `ingredients`, `factor`, `from_servings`           |
| `list_recipes`      | Browses by cuisine, kind of dish or main ingredient.       | `cuisine`, `dish_type`, `main_ingredient`, `limit` |

The server is **read-only**. It edits nothing on the wiki and uploads nothing.

## The arithmetic is the point

Ask for a six-serving recipe scaled to four and a naive multiplication gives you 3.33 egg yolks
and 0.67 of a pinch of pepper. Neither is something a kitchen can produce, and a model that
repeats them is confidently wrong about a dish somebody is about to cook.

Six rules do the work.

**A countable thing lands where a cook can divide it.** What decides is the content, not the
container: a can of tomatoes is poured and the rest kept, a packet of vanilla sugar is split by
eye, a sheet of gelatine is cut with scissors, a sprig of thyme is pinched in two, so all of
those land on a half. Half an egg would have to be beaten and
weighed, which is not an amount a recipe asks for, so a count of eggs, yolks or egg whites lands
on a whole number. The rounded line says which way it moved. A few things are decided by what
they are: a bottle, a jar and a block hold enough for a quarter to be a portion, a slice is cut
off something larger and the board takes a corner off it in the same gesture, a zest comes off
one fruit in one go and stays whole, a chicken breast is
meat and halves, and a dozen states a number of things rather than a measure of them, so
`2 dozen mushrooms` at three quarters comes back as `18 mushrooms`.

**A thing counted on its own is divided by the size of one against what a recipe puts in.** A
shrimp, a mussel, a hazelnut, a peppercorn, a juniper berry, a star anise is already a portion:
a recipe counts twelve of them and a smaller recipe puts one fewer in the pan, so they land on a
whole number. A leg of lamb, a baguette, a camembert, a pineapple, an onion, a watermelon, a
guinea fowl, a chicken, a leek sits at
the other end of that comparison, asked for by the one or the two and shared out with a knife,
so they go as far as the quarter. A cut carved off one of them stops at the half, a breast and a
thigh being the portion the knife already produced. A juice stops at the half too: half the
juice of a lemon is taken
by squeezing half the fruit, and a quarter of one has to be poured out and measured back.

**A word naming two foods is read on the line that writes it.** `clove` is the wedge broken off
a bulb when the line names garlic, and a knife splits that in two; on its own, or written
`whole cloves`, it is the dried flower bud dropped into the pot and fished back out, and a count
of those lands on a whole number.

**A shrinking line keeps the smallest share still worth measuring.** A knife takes an onion to a
quarter; a can or a packet goes to a half; an egg stops at one; a spoon walked down to the
smallest one a measuring set carries stops at a quarter of it. Under that floor the
amount is clamped up and the line says it no longer holds its share of the recipe.

**A measurement moves to a smaller unit before it is rounded.** A quantity that would fall below
one is demoted first, so 1 tablespoon quartered reads as 1 teaspoon rather than rounding away to
nothing. A large result climbs the other way, so 200 g scaled tenfold reads as 2 kg. Read
`amount` together with `unit` and never on its own: the bare number can shrink while the
quantity grows.

**An approximate measure is multiplied as a count, never converted.** A pinch, a dash, a glug, a
dollop, a capful, a spoonful: the size of one of them belongs to whoever pours it, and the count
is what carries the recipe's proportion. A pinch taken from six servings to twenty-five is four
pinches. The everyday equivalence goes in the note, never in the quantity. English says as much
in the word itself: the -ful suffix means "as much as one of these holds", so a container that
has never come up is understood the first time it appears, and the gestures whose names give
nothing away are named one by one in the vocabulary.

**A line publishing two quantities has both of them scaled.** `450 g (1 pound) spaghetti` comes
back with the metric figure and the imperial figure in step, so they cannot contradict each
other, and so does one written after a slash, as in `500 g / 1.1 lb`. A line offering a choice,
as in `2 tablespoons butter OR 30 g margarine`, has both branches scaled, so whichever one the
cook takes carries the same share.

**What cannot be multiplied is flagged rather than multiplied.** "Salt to taste" comes back as
published, marked `unscaled`, and counted in the summary.

### What a scaled ingredient looks like

Every line comes back in one shape:

```json
{
  "text": "300 g (11 ounces) flat noodles",
  "original": "450 g (1 pound) flat noodles",
  "scaling": "rounded",
  "amount": 300,
  "amount_max": null,
  "unit": "g",
  "note": "The amount is exact; the equivalent in brackets was rounded to stay readable."
}
```

`scaling` carries the honesty of the tool:

- `scaled` — the arithmetic was exact.
- `rounded` — a countable thing was moved to the smallest share a cook takes out of one of it, a
  whole, a half or a quarter, or a measurement was demoted to a smaller unit to stay usable.
- `unscaled` — the line carries nothing that can be multiplied, so it was left as published and
  flagged.

A line read off a page carries two more fields: `group`, naming the part of the dish it is for,
and `variant`, naming the alternative list it came from.

## Reading a page

### `search_recipes`

Find a page by dish name or by an ingredient it uses.

| Argument | Type              | Default | Meaning                                                            |
| -------- | ----------------- | ------- | ------------------------------------------------------------------ |
| `query`  | string            | —       | A dish, such as `carbonara`, or an ingredient, such as `guanciale` |
| `search` | `text` \| `title` | `text`  | `text` reads the whole page; `title` matches the page name only    |
| `limit`  | integer 1–50      | 10      | Rows to return                                                     |

Returns `{ query, results, result_count, total_available, source, notes }`. Each row carries
`id`, `title`, `url`, `image_url`, `description` and `excerpt`.

`total_available` is always `null`. The gateway publishes no total and offers no second page, so
any number here would be invented, and a short list is not evidence that little exists. Narrow
the query instead.

### `get_recipe`

Read one page, optionally rescaled.

| Argument                | Type          | Default | Meaning                                                             |
| ----------------------- | ------------- | ------- | ------------------------------------------------------------------- |
| `id`                    | string        | —       | Page key from a search, such as `Cookbook:Spaghetti_alla_Carbonara` |
| `servings`              | integer 1–500 | —       | Rescale the ingredients to this many                                |
| `max_description_chars` | integer       | 1200    | Ceiling on the introduction                                         |

Returns `{ id, title, url, redirected_from, yield, ingredients, equipment, steps, tips,
prep_minutes, cook_minutes, total_minutes, time_text, time_phases, category, categories, difficulty,
difficulty_max, energy, author, rating, nutrition, description, attribution, license,
revised_at, source, notes }`.

`yield` is `{ original_count, original_text, requested, unit, factor }`. `original_text` keeps
the page's own wording, because "4 to 6" and "4" are different claims. Rescaling needs a stated
yield: a page that publishes none comes back as published, and says so.

Ingredients are read from a bulleted list and from a table alike. Where a page lays them out as
a `wikitable`, the amount comes from whichever of the Count, Volume and Weight columns the row
fills, and a baker's percentage column is left out of it.

A page that groups its ingredients under sub-headings, a cake and its soak and its glaze, states
the group on every line as `group`; a page that lists them flat states `null`. Reading the group
is what tells two identical lines apart: a recipe can ask for two tablespoons of rum in each of
its parts, and the list is only a repeat if the group is thrown away.

A page offering several versions of the same dish writes them the same way, under
`=== Variation I ===` and its neighbours, and those lists replace one another: one of them is
used, even where the procedure says to mix all the ingredients. Each line says which list it came
from as `variant`, `null` for the list the recipe states for itself, and a note names the
alternatives the page carries.

An amount written as a conversion template is read as the value and the unit the page wrote:
`180 °C`, `225 g`, `170–225 g`. Nothing is converted between measuring systems, so the
counterpart such a template computes is left out.

The recipe box holds one field for time, and a page with more than one thing to say fills it with
labelled phases: a preparation, a fermentation, a rest, a cooking. Each one comes back in
`time_phases` with the page's own wording, its minutes, and both ends where the page gives a
range. `prep_minutes` and `cook_minutes` carry the phases the page labels as such.
`total_minutes` states a total only where the page states one, as a single duration or as a phase
the page itself calls the total: souring a batter for a day is not cooking, and adding the phases
would answer with a figure nobody published.

A page whose only content is a redirect is followed to the page it points at. `id` names the page
that was read, `redirected_from` names the addresses walked to reach it, and a note says so, so a
caller crediting the recipe links the page that carries it.

`author` and `rating` are always `null`: the Cookbook is written collectively and carries no
reader score. A time, a difficulty or a nutrition panel the page does not publish is `null`,
never zero and never inferred from the steps.

### `scale_ingredients`

Rescale any English ingredient list. Makes no network request, so it works on a list pasted in
from anywhere.

| Argument                        | Type     | Meaning                                 |
| ------------------------------- | -------- | --------------------------------------- |
| `ingredients`                   | string[] | Ingredient lines                        |
| `factor`                        | number   | Multiplier. Use this, or the pair below |
| `from_servings` + `to_servings` | number   | The factor is computed from the two     |

Returns `{ factor, ingredients, scaled_count, rounded_count, unscaled_count, notes }`.

### `list_recipes`

Browse by cuisine, kind of dish, or main ingredient. Give at least one of `cuisine`,
`dish_type`, `main_ingredient`; `limit` defaults to 15.

This is built on the Cookbook's search, because the route this server is allowed to use
publishes no way to list the members of a category. What comes back is a ranked sample rather
than the category itself: it is neither complete nor ordered, and its length says nothing about
how many recipes exist on the subject. The tool says so in its own notes.

## What the answers claim

The Cookbook keeps recipes and reference pages in one namespace, so a search row can be a page
about an ingredient rather than a recipe using it. Only `get_recipe` can tell them apart, and it
says when a page carries no ingredient list rather than passing for a recipe with nothing in it.
A page with no recipe box, no recipe banner and no procedure is answered with empty lists: the
book's own chapter indexes write "Ingredients" over a column of links, and those links are not a
shopping list. A page that does read as a recipe and whose list sits under a heading this server
does not know is told apart from that, and its own headings are named so the list can be found.

A failure is never returned as an empty result. A request that could not be made comes back as
an error code, because silence about a failure becomes "there is no such recipe" in the mouth of
a model.

A rescale of a page that yielded no quantities reports no factor and says the page delivered
none, rather than announcing a multiplication over an empty list.

## Licence and attribution

Cookbook pages are published under
**[Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**.
Repeating a recipe means two things: crediting Wikibooks and the page you took it from, and
sharing what you build on it under the same licence. `get_recipe` returns both `license` and the
page `url` so an answer can carry the credit with it.

This server's own code is MIT.

## Configuration

Every setting is optional.

| Variable               | Default  | Meaning                                                         |
| ---------------------- | -------- | --------------------------------------------------------------- |
| `WB_USER_AGENT`        | —        | Prefixed to this server's own identifier                        |
| `WB_MIN_INTERVAL_MS`   | `1000`   | Milliseconds between requests. Refused below 500 or above 60000 |
| `WB_TIMEOUT_MS`        | `20000`  | Per-request deadline. Accepted from 1000 to 120000              |
| `WB_MAX_RETRIES`       | `3`      | Retries on a busy or rate-limited gateway. Up to 8              |
| `WB_CACHE_TTL_MS`      | `900000` | In-memory cache lifetime. `0` turns it off                      |
| `WB_CACHE_MAX_ENTRIES` | `200`    | Cache size                                                      |
| `WB_LOG_LEVEL`         | `error`  | `silent`, `error`, `info` or `debug`. Goes to stderr            |

A value that cannot be read warns on stderr and falls back, so one typo does not take away every
tool.

## How this server treats Wikimedia

One request at a time, at least a second apart, widening when the gateway pushes back. The
`User-Agent` always ends with this project's name and address, whatever a caller sets, so
Wikimedia can reach a human about traffic it did not expect. The floor on the interval has a
hard minimum that configuration cannot go below.

Requests go to the Wikimedia developer gateway at `api.wikimedia.org`, which is the route
published for programs. The wiki's own `/w/` paths are disallowed to robots on
`en.wikibooks.org` and are never called from here.

## Using the client on its own

The layer that talks to the gateway imports nothing from the protocol and is published
separately, with the pacing, the cache and the error taxonomy attached.

```ts
import { CookbookClient } from "mcp-wikibooks-cookbook/client";

const client = new CookbookClient();
const { data } = await client.getRecipe("Cookbook:Spaghetti alla Carbonara");
console.log(data.ingredients, data.license?.url);
```

## Troubleshooting

**`rate_limited`** — Wikimedia asked this client to slow down. It says nothing about whether the
recipe exists. Wait and ask again, or raise `WB_MIN_INTERVAL_MS`.

**`not_found`** — the gateway answered, and there is no page at that address. Search for the
name rather than guessing the key.

**A search returns fewer rows than asked for** — the Cookbook shares its wiki with every other
book on Wikibooks, and rows from elsewhere are dropped. The notes say how many.

**A recipe comes back with no ingredients** — the page may be about an ingredient or a technique
rather than a recipe. Lists and ingredient tables are both read, so an empty answer means the
page states its ingredients somewhere else. The notes say so; follow the `url`, and note that no
rescale is reported for a page that yielded no quantities.

**`parse_failure`** — the gateway answered in a shape this server cannot read. Please
[open an issue](https://github.com/smeet666/mcp-wikibooks-cookbook/issues) with the arguments
you used.

## Development

```bash
npm install
npm run typecheck
npm test                      # unit tests, no network
npm run build
npm run build:fixtures        # regenerate the invented test corpus
WB_LIVE=1 npm run test:live   # one request per route against the real gateway
npm run inspector             # explore the tools in the MCP Inspector
```

Fixtures are generated rather than captured, so no wiki content lives in this repository, and
the unit suite never touches the network.

The access layer under `src/wikibooks` does not import the MCP SDK and is published separately
as `mcp-wikibooks-cookbook/client`, usable as a plain library. The arithmetic lives under
`src/recipe`.

## Contributing

Bugs, questions and ideas all belong in
[the issue tracker](https://github.com/smeet666/mcp-wikibooks-cookbook/issues). Pull requests
are welcome; please open an issue first so we can agree on what the right answer is before you
write it. [CONTRIBUTING.md](CONTRIBUTING.md) has the detail, and [SECURITY.md](SECURITY.md)
covers anything exploitable.

## Support

Free, and it stays free. If it saved you some time, you can
[buy me a coffee](https://buymeacoffee.com/smeet666).

## License

MIT. See [LICENSE](LICENSE). The licence covers this source code only, not the recipes retrieved
through it, which are published under Creative Commons Attribution-ShareAlike 4.0 and carry the
obligations that licence attaches.

This is an unofficial project, with no affiliation to or endorsement by Wikimedia or the
Wikibooks community.

---

# mcp-wikibooks-cookbook (français)

Un serveur MCP pour le [Cookbook](https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents) des
Wikibooks anglophones : des milliers de recettes écrites et entretenues au grand jour, avec
leurs ingrédients, leur matériel et leurs étapes. **Cherchez-les, lisez-en une, et remettez-la à
l'échelle du nombre de personnes que vous recevez vraiment.** Sans clé d'API, sans compte, en
lecture seule.

## Démarrage rapide

**Installation en un clic**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=wikibooks-cookbook&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC13aWtpYm9va3MtY29va2Jvb2siXX0%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=wikibooks-cookbook&config=%7B%22name%22%3A%22wikibooks-cookbook%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-wikibooks-cookbook%22%5D%7D)

**Claude Code**

```bash
claude mcp add wikibooks-cookbook -- npx -y mcp-wikibooks-cookbook
```

**Claude Desktop, Cursor, et tout client utilisant le format standard**

```json
{
  "mcpServers": {
    "wikibooks-cookbook": {
      "command": "npx",
      "args": ["-y", "mcp-wikibooks-cookbook"]
    }
  }
}
```

Node 20 ou plus récent.

**Bundle, sans npm**

Téléchargez `mcp-wikibooks-cookbook-<version>.mcpb` depuis
[la dernière release](https://github.com/smeet666/mcp-wikibooks-cookbook/releases/latest) et
ouvrez-le. Un client compatible l'installe seul, sans npm ni fichier de configuration à
modifier.

## Outils

| Outil               | Ce qu'il fait                                                      | Paramètres principaux                              |
| ------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| `search_recipes`    | Trouve une page par nom de plat ou par ingrédient qu'elle utilise. | `query`, `search`, `limit`                         |
| `get_recipe`        | Lit une page, avec remise à l'échelle facultative.                 | `id`, `servings`, `max_description_chars`          |
| `scale_ingredients` | Remet à l'échelle n'importe quelle liste anglaise, hors ligne.     | `ingredients`, `factor`, `from_servings`           |
| `list_recipes`      | Parcourt par cuisine, type de plat ou ingrédient principal.        | `cuisine`, `dish_type`, `main_ingredient`, `limit` |

Le serveur est en **lecture seule**. Il ne modifie rien sur le wiki et n'envoie rien.

## L'arithmétique est le cœur du sujet

Demandez une recette pour six ramenée à quatre : une multiplication naïve donne 3,33 jaunes
d'œuf et 0,67 pincée de poivre. Ni l'un ni l'autre ne se produit dans une cuisine, et un modèle
qui les répète se trompe avec aplomb sur un plat que quelqu'un s'apprête à cuisiner.

Six règles font le travail.

**Un dénombrable atterrit là où un cuisinier peut le diviser.** Ce qui décide, c'est le contenu
et non le contenant : une boîte de tomates se verse et le reste se garde, un sachet de sucre
vanillé se partage à l'œil, une feuille de gélatine se coupe aux ciseaux, une branche de thym se
casse en deux ; tous tombent donc sur une demie, comme une gousse d'ail. Un demi-œuf, lui,
demanderait de le battre et de le peser, ce qu'aucune recette ne demande : un nombre d'œufs, de
jaunes ou de blancs d'œufs tombe sur un entier. La ligne arrondie dit dans quel sens elle a bougé.
Quelques cas se décident sur la nature de la chose : une bouteille et un bloc en contiennent assez
pour qu'un quart soit une portion, un blanc de poulet est une viande et se coupe en deux, et une
douzaine énonce un nombre de choses plutôt qu'une mesure, si bien que « 2 dozen mushrooms »
réduits d'un quart reviennent en « 18 mushrooms ».

**Une ligne qui rétrécit garde la plus petite part qui vaille encore la peine.** Le couteau mène
un oignon au quart ; une boîte, un sachet ou une gousse s'arrêtent à la demie ; un œuf s'arrête à
l'unité ; une cuillère descendue jusqu'à la plus petite d'un jeu de mesures s'arrête à son quart.
Sous ce plancher, la quantité est remontée et la ligne dit qu'elle ne tient plus sa part
de la recette.

**Une mesure descend vers une unité plus petite avant d'être arrondie.** Une quantité qui
passerait sous l'unité est d'abord convertie, si bien qu'une cuillère à soupe divisée par quatre
se lit une cuillère à café plutôt que de s'arrondir à rien. Un résultat élevé remonte dans
l'autre sens : 200 g multipliés par dix se lisent 2 kg. Lisez toujours `amount` avec `unit` : le
nombre nu peut diminuer pendant que la quantité augmente.

**Une mesure approximative est multipliée comme un nombre, jamais convertie.** Une pincée, un
trait, un bouchon, une cuillerée : la taille de l'une d'elles appartient à qui verse, et c'est
le nombre qui porte la proportion de la recette. Une pincée passée de six parts à vingt-cinq
fait quatre pincées. L'équivalence courante va dans la note, jamais dans la quantité. L'anglais
le dit dans le mot lui-même : le suffixe -ful signifie « autant qu'il en tient là-dedans », donc
un contenant jamais rencontré est compris dès sa première apparition, et les gestes dont le nom
ne dit rien de la taille sont nommés un par un dans le vocabulaire.

**Une ligne portant deux quantités publiées voit ses deux branches mises à l'échelle.**
`450 g (1 pound) spaghetti` revient avec la valeur métrique et la valeur impériale en accord,
sans se contredire, et il en va de même d'une valeur écrite après une barre oblique, comme
`500 g / 1.1 lb`. Une ligne offrant un choix, comme `2 tablespoons butter OR 30 g margarine`,
voit ses deux branches mises à l'échelle, si bien que celle que prend le cuisinier porte la même
part.

**Ce qui ne se multiplie pas est signalé plutôt que multiplié.** « Salt to taste » revient tel
que publié, marqué `unscaled`, et compté dans le résumé.

### À quoi ressemble un ingrédient mis à l'échelle

Chaque ligne revient dans la même forme :

```json
{
  "text": "300 g (11 ounces) flat noodles",
  "original": "450 g (1 pound) flat noodles",
  "scaling": "rounded",
  "amount": 300,
  "amount_max": null,
  "unit": "g",
  "note": "The amount is exact; the equivalent in brackets was rounded to stay readable."
}
```

`scaling` porte l'honnêteté de l'outil :

- `scaled` — le calcul était exact.
- `rounded` — un dénombrable a été ramené à la plus petite part qu'on prend sur l'un d'eux, une
  unité, une demie ou un quart, ou une mesure a été descendue vers une unité plus petite pour
  rester utilisable.
- `unscaled` — la ligne ne porte rien de multipliable, elle est laissée telle que publiée et
  signalée.

Une ligne lue sur une page porte deux champs de plus : `group`, qui nomme la partie du plat à
laquelle elle sert, et `variant`, qui nomme la liste alternative dont elle vient.

## Lire une page

### `search_recipes`

Trouve une page par nom de plat ou par ingrédient qu'elle utilise.

| Argument | Type              | Défaut | Sens                                                                |
| -------- | ----------------- | ------ | ------------------------------------------------------------------- |
| `query`  | chaîne            | —      | Un plat, comme `carbonara`, ou un ingrédient, comme `guanciale`     |
| `search` | `text` \| `title` | `text` | `text` lit toute la page ; `title` ne compare que le nom de la page |
| `limit`  | entier 1–50       | 10     | Nombre de lignes                                                    |

Renvoie `{ query, results, result_count, total_available, source, notes }`. Chaque ligne porte
`id`, `title`, `url`, `image_url`, `description` et `excerpt`.

`total_available` vaut toujours `null`. La passerelle ne publie aucun total et n'offre pas de
seconde page : tout nombre ici serait inventé, et une liste courte ne prouve pas qu'il existe
peu de choses. Resserrez plutôt la requête.

### `get_recipe`

Lit une page, avec remise à l'échelle facultative.

| Argument                | Type         | Défaut | Sens                                                                         |
| ----------------------- | ------------ | ------ | ---------------------------------------------------------------------------- |
| `id`                    | chaîne       | —      | Clé de page issue d'une recherche, comme `Cookbook:Spaghetti_alla_Carbonara` |
| `servings`              | entier 1–500 | —      | Remet les ingrédients à ce nombre de parts                                   |
| `max_description_chars` | entier       | 1200   | Plafond sur l'introduction                                                   |

Renvoie `{ id, title, url, redirected_from, yield, ingredients, equipment, steps, tips,
prep_minutes, cook_minutes, total_minutes, time_text, time_phases, category, categories, difficulty,
difficulty_max, energy, author, rating, nutrition, description, attribution, license,
revised_at, source, notes }`.

`yield` vaut `{ original_count, original_text, requested, unit, factor }`. `original_text`
conserve la formulation de la page, parce que « 4 to 6 » et « 4 » ne disent pas la même chose.
Une remise à l'échelle exige un rendement annoncé : une page qui n'en publie aucun revient telle
que publiée, et le dit.

Les ingrédients sont lus aussi bien en liste à puces qu'en tableau. Quand une page les présente
en `wikitable`, la quantité vient de celle des colonnes Count, Volume et Weight que la ligne
remplit, et une colonne de pourcentage boulanger est laissée de côté.

Une page qui range ses ingrédients sous des sous-titres, un gâteau puis son sirop puis son
glaçage, porte ce groupe sur chaque ligne dans `group` ; une page qui les liste à plat y met
`null`. C'est le groupe qui distingue deux lignes identiques : une recette peut demander deux
cuillerées de rhum dans chacune de ses parties, et la liste ne devient un doublon que si l'on
jette le groupe.

Une page qui propose plusieurs versions du même plat les écrit de la même façon, sous
`=== Variation I ===` et ses voisins, et ces listes se remplacent l'une l'autre : on en utilise
une seule, même quand la préparation dit de mélanger tous les ingrédients. Chaque ligne indique
dans `variant` la liste dont elle vient, `null` pour la liste que la recette énonce pour
elle-même, et une note nomme les alternatives que porte la page.

Une quantité écrite sous forme de modèle de conversion est lue comme la valeur et l'unité que la
page a écrites : `180 °C`, `225 g`, `170–225 g`. Rien n'est converti d'un système de mesure vers
un autre, donc l'équivalent que ce modèle calcule est laissé de côté.

L'encadré de recette n'a qu'un champ pour le temps, et une page qui a plusieurs choses à dire y
met des phases nommées : une préparation, une fermentation, un repos, une cuisson. Chacune revient
dans `time_phases` avec la formulation de la page, ses minutes, et les deux bornes quand la page
donne une fourchette. `prep_minutes` et `cook_minutes` portent les phases que la page nomme ainsi.
`total_minutes` n'annonce un total que là où la page en énonce un, sous forme d'une durée unique
ou d'une phase que la page appelle elle-même le total : laisser une pâte s'acidifier une journée
n'est pas une cuisson, et additionner les phases répondrait par un chiffre que personne n'a publié.

Une page dont tout le contenu est une redirection est suivie jusqu'à la page visée. `id` nomme
la page lue, `redirected_from` nomme les adresses parcourues pour l'atteindre, et une note le
dit, pour qu'un appelant qui crédite la recette pointe la page qui la porte.

`author` et `rating` valent toujours `null` : le Cookbook s'écrit collectivement et ne porte
aucune note de lecteur. Un temps, une difficulté ou un tableau nutritionnel que la page ne
publie pas vaut `null`, jamais zéro, et n'est jamais déduit des étapes.

### `scale_ingredients`

Remet à l'échelle n'importe quelle liste d'ingrédients en anglais. Ne fait aucune requête
réseau, donc fonctionne sur une liste collée depuis n'importe où.

| Argument                        | Type     | Sens                                              |
| ------------------------------- | -------- | ------------------------------------------------- |
| `ingredients`                   | chaîne[] | Lignes d'ingrédients                              |
| `factor`                        | nombre   | Multiplicateur. Utilisez-le, ou la paire ci-après |
| `from_servings` + `to_servings` | nombre   | Le facteur est calculé à partir des deux          |

Renvoie `{ factor, ingredients, scaled_count, rounded_count, unscaled_count, notes }`.

### `list_recipes`

Parcourt par cuisine, type de plat ou ingrédient principal. Donnez au moins l'un de `cuisine`,
`dish_type`, `main_ingredient` ; `limit` vaut 15 par défaut.

C'est bâti sur la recherche du Cookbook, parce que la route que ce serveur a le droit d'utiliser
ne publie aucun moyen de lister les membres d'une catégorie. Ce qui revient est un échantillon
classé et non la catégorie elle-même : ce n'est ni complet ni ordonné, et sa longueur ne dit
rien du nombre de recettes existant sur le sujet. L'outil le dit dans ses propres notes.

## Ce que les réponses affirment

Le Cookbook garde les recettes et les pages de référence dans un seul espace de noms : une ligne
de recherche peut donc être une page sur un ingrédient plutôt qu'une recette qui l'emploie. Seul
`get_recipe` sait les distinguer, et il dit quand une page ne porte pas de liste d'ingrédients
au lieu de la faire passer pour une recette vide. Une page sans encadré de recette, sans bandeau
et sans procédure revient avec des listes vides : les sommaires du livre écrivent eux aussi
« Ingredients » au-dessus d'une colonne de liens, et ces liens ne sont pas une liste de courses.
Une page qui se lit bien comme une recette mais dont la liste est sous un titre que ce serveur
ne connaît pas est distinguée de la première, et ses propres titres sont nommés pour qu'on
retrouve la liste.

Un échec n'est jamais renvoyé comme un résultat vide. Une requête qui n'a pas pu être faite
revient sous forme de code d'erreur, parce que le silence sur un échec devient « cette recette
n'existe pas » dans la bouche d'un modèle.

La remise à l'échelle d'une page qui n'a livré aucune quantité ne rapporte aucun facteur et dit
que la page n'en a donné aucune, plutôt que d'annoncer une multiplication sur une liste vide.

## Licence et attribution

Les pages du Cookbook sont publiées sous
**[Creative Commons Attribution-Partage dans les mêmes conditions 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr)**.
Reprendre une recette engage à deux choses : citer Wikibooks et la page dont elle vient, et
partager à l'identique ce que vous en tirez, sous la même licence. `get_recipe` renvoie à la
fois `license` et l'`url` de la page, pour qu'une réponse porte la mention avec elle.

Le code de ce serveur est sous MIT.

## Configuration

Tous les réglages sont facultatifs.

| Variable               | Défaut   | Sens                                                                     |
| ---------------------- | -------- | ------------------------------------------------------------------------ |
| `WB_USER_AGENT`        | —        | Placé devant l'identifiant propre du serveur                             |
| `WB_MIN_INTERVAL_MS`   | `1000`   | Millisecondes entre deux requêtes. Refusé sous 500 ou au-dessus de 60000 |
| `WB_TIMEOUT_MS`        | `20000`  | Délai par requête. Accepté de 1000 à 120000                              |
| `WB_MAX_RETRIES`       | `3`      | Reprises sur passerelle occupée ou limitée. Jusqu'à 8                    |
| `WB_CACHE_TTL_MS`      | `900000` | Durée de vie du cache mémoire. `0` le désactive                          |
| `WB_CACHE_MAX_ENTRIES` | `200`    | Taille du cache                                                          |
| `WB_LOG_LEVEL`         | `error`  | `silent`, `error`, `info` ou `debug`. Sort sur stderr                    |

Une valeur illisible avertit sur stderr et retombe sur le défaut, pour qu'une faute de frappe
n'emporte pas tous les outils.

## Ce que ce serveur doit à Wikimedia

Une requête à la fois, au moins une seconde d'écart, en s'élargissant quand la passerelle
freine. Le `User-Agent` se termine toujours par le nom et l'adresse de ce projet, quoi qu'un
appelant y mette, pour que Wikimedia puisse joindre un humain à propos d'un trafic inattendu. Le
plancher sur l'intervalle a un minimum dur que la configuration ne peut pas franchir.

Les requêtes vont à la passerelle développeur de Wikimedia, `api.wikimedia.org`, la route
publiée pour les programmes. Les chemins `/w/` du wiki lui-même sont interdits aux robots sur
`en.wikibooks.org` et ne sont jamais appelés d'ici.

## Utiliser le client seul

La couche qui parle à la passerelle n'importe rien du protocole et est publiée séparément, avec
la cadence, le cache et la taxinomie d'erreurs.

```ts
import { CookbookClient } from "mcp-wikibooks-cookbook/client";

const client = new CookbookClient();
const { data } = await client.getRecipe("Cookbook:Spaghetti alla Carbonara");
console.log(data.ingredients, data.license?.url);
```

## Dépannage

**`rate_limited`** — Wikimedia a demandé à ce client de ralentir. Cela ne dit rien de
l'existence de la recette. Attendez et redemandez, ou augmentez `WB_MIN_INTERVAL_MS`.

**`not_found`** — la passerelle a répondu, et il n'y a aucune page à cette adresse. Cherchez le
nom plutôt que de deviner la clé.

**Une recherche renvoie moins de lignes que demandé** — le Cookbook partage son wiki avec tous
les autres livres de Wikibooks, et les lignes venues d'ailleurs sont écartées. Les notes disent
combien.

**Une recette revient sans ingrédients** — la page porte peut-être sur un ingrédient ou une
technique plutôt que sur une recette. Les listes comme les tableaux d'ingrédients sont lus, donc
une réponse vide signifie que la page énonce ses ingrédients ailleurs. Les notes le disent ;
suivez l'`url`, et notez qu'aucune remise à l'échelle n'est rapportée pour une page qui n'a
livré aucune quantité.

**`parse_failure`** — la passerelle a répondu dans une forme que ce serveur ne sait pas lire.
Merci d'[ouvrir une issue](https://github.com/smeet666/mcp-wikibooks-cookbook/issues) avec les
arguments utilisés.

## Développement

```bash
npm install
npm run typecheck
npm test                      # tests unitaires, sans réseau
npm run build
npm run build:fixtures        # régénère le corpus de test inventé
WB_LIVE=1 npm run test:live   # une requête par route sur la vraie passerelle
npm run inspector             # explorer les outils dans le MCP Inspector
```

Les fixtures sont générées et non capturées : aucun contenu du wiki ne vit dans ce dépôt, et la
suite unitaire ne touche jamais au réseau.

La couche d'accès sous `src/wikibooks` n'importe pas le SDK MCP et est publiée séparément sous
`mcp-wikibooks-cookbook/client`, utilisable comme simple bibliothèque. L'arithmétique vit sous
`src/recipe`.

## Contribuer

Bugs, questions et idées vont tous dans
[le suivi d'issues](https://github.com/smeet666/mcp-wikibooks-cookbook/issues). Les pull
requests sont bienvenues ; ouvrez d'abord une issue, pour qu'on s'accorde sur la bonne réponse
avant que vous n'écriviez le code. [CONTRIBUTING.md](CONTRIBUTING.md) donne le détail, et
[SECURITY.md](SECURITY.md) couvre tout ce qui est exploitable.

## Soutenir

Gratuit, et ça le reste. Si ça vous a fait gagner du temps, vous pouvez
[m'offrir un café](https://buymeacoffee.com/smeet666).

## Licence

MIT. Voir [LICENSE](LICENSE). Cette licence couvre le code source seul, pas les recettes
récupérées à travers lui, publiées sous Creative Commons Attribution-Partage dans les mêmes
conditions 4.0 et porteuses des obligations que cette licence attache.

Projet non officiel, sans affiliation à Wikimedia ni à la communauté Wikibooks, et sans
approbation de leur part.
