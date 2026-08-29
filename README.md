# mcp-wikibooks-cookbook

[![npm](https://img.shields.io/npm/v/mcp-wikibooks-cookbook.svg)](https://www.npmjs.com/package/mcp-wikibooks-cookbook)
[![CI](https://github.com/smeet666/mcp-wikibooks-cookbook/actions/workflows/ci.yml/badge.svg)](https://github.com/smeet666/mcp-wikibooks-cookbook/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/mcp-wikibooks-cookbook.svg)](./LICENSE)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-6E56CF)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.smeet666/mcp-wikibooks-cookbook)
[![Glama](https://glama.ai/mcp/servers/smeet666/mcp-wikibooks-cookbook/badges/score.svg)](https://glama.ai/mcp/servers/smeet666/mcp-wikibooks-cookbook)
[![M8ven](https://m8ven.ai/badge/mcp/smeet666-mcp-wikibooks-cookbook-1n3o1b?variant=verified)](https://m8ven.ai/mcp/smeet666-mcp-wikibooks-cookbook-1n3o1b)
[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=wikibooks-cookbook&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC13aWtpYm9va3MtY29va2Jvb2siXX0%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=wikibooks-cookbook&config=%7B%22name%22%3A%22wikibooks-cookbook%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-wikibooks-cookbook%22%5D%7D)

<!-- m8ven-verify: b1666486e14cfe82ed7e94a03c514317 -->

The [Cookbook](https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents) is the
recipe collection of the English Wikibooks, a Wikimedia project. Thousands of
recipes are written and maintained there in the open, each with its ingredients,
the equipment it calls for, its steps, the tips and variations its authors added,
and the categories it files itself under: a cuisine, a kind of dish, a main
ingredient. The pages are published under Creative Commons Attribution-ShareAlike
4.0.

This server connects a chat client to that collection. You can search the recipes
by dish or by ingredient, list them by cuisine, kind of dish or main ingredient,
read one with its ingredients rescaled to the number of people at your table, and
rescale any ingredient list of your own. It needs no API key and no account.

_[Version française](#mcp-wikibooks-cookbook-français)_

---

## Install

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

Node 24 or later is required, and no environment variable has to be set.

### With Docker

```json
{
  "mcpServers": {
    "wikibooks-cookbook": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/smeet666/mcp-wikibooks-cookbook:2.0.1"]
    }
  }
}
```

`-i` keeps stdin open, which is where the protocol travels, and `-t` is left out
because a TTY rewrites the stream. The container needs outbound HTTPS to
`api.wikimedia.org`, and nothing else: no volume, no port, no credential.

### Bundle, without npm

Download `mcp-wikibooks-cookbook-2.0.1.mcpb` from
[the latest release](https://github.com/smeet666/mcp-wikibooks-cookbook/releases/latest)
and open it. A client that supports MCP bundles installs it on its own, with no
npm and no configuration file to edit. The bundle carries its dependencies, so
nothing is fetched at install time.

## What you can ask

- "Find me a carbonara recipe in the Cookbook."
- "Read it for six people instead of four."
- "What Thai soups does the collection hold?"
- "Which recipes are built on lentils?"
- "Scale this ingredient list by 2.5 for me."

The ordinary path runs from a search to a reading: a row carries an `id`, the
page key, and `get_recipe` takes that key.

## Tools

| Tool                | What it does                                                   |
| ------------------- | -------------------------------------------------------------- |
| `search_recipes`    | Finds recipes by dish or by ingredient.                        |
| `get_recipe`        | Reads one recipe, rescaled to a number of servings on request. |
| `scale_ingredients` | Rescales any ingredient list, with no request to the wiki.     |
| `list_recipes`      | Lists recipes by cuisine, kind of dish or main ingredient.     |

### `search_recipes`

Searches the Cookbook, either across the whole text of its pages or across their
titles alone.

| Argument | Type                              | Required | What it does                                                        |
| -------- | --------------------------------- | -------- | ------------------------------------------------------------------- |
| `query`  | string, 1 to 300 characters       | yes      | A dish, such as `carbonara`, or an ingredient, such as `guanciale`. |
| `search` | `text` or `title`, default `text` | no       | `text` reads the whole page; `title` matches the page name alone.   |
| `limit`  | integer, 1 to 50, default `10`    | no       | Rows to serve.                                                      |

**In return:** rows carrying `id`, the page key `get_recipe` takes; `title`;
`url`; `image_url`; `description`, the short gloss the wiki keeps for a page; and
`excerpt`, the matching passage with the highlight markup taken off. Each of the
last three is `null` where the search offered none. `total_available` is always
`null`: the search route publishes no total and no paging, so `result_count`
counts the rows this call returned.

### `get_recipe`

Reads one recipe, and rescales its ingredients when a number of servings is
given.

| Argument                | Type                                  | Required | What it does                                               |
| ----------------------- | ------------------------------------- | -------- | ---------------------------------------------------------- |
| `id`                    | string, 1 to 300 characters           | yes      | The page key, such as `Cookbook:Spaghetti_alla_Carbonara`. |
| `servings`              | integer, 1 to 500                     | no       | Rescale the ingredients to this many servings.             |
| `max_description_chars` | integer, 100 to 20000, default `1200` | no       | How much of the page's prose to serve.                     |

**In return:** `title`, `url`, `ingredients`, `equipment`, `steps`, `tips` for
the notes and variations the page publishes, `prep_minutes`, `cook_minutes`,
`total_minutes`, `time_text` in the page's own wording, `time_phases`, `category`
and `categories` for every category the page files itself under. A figure the
page states nothing for is `null`. `id` names the page that was read, which
differs from the key asked for after a redirect, and `redirected_from` then names
the key that led there. `yield` says what the recipe was written for and what it
was rescaled to, and each ingredient carries `scaling`, reading `scaled`,
`rounded` or `unscaled`.

### `scale_ingredients`

Applies the same arithmetic to any list of ingredient lines, with no request to
the wiki.

| Argument        | Type                                       | Required   | What it does                               |
| --------------- | ------------------------------------------ | ---------- | ------------------------------------------ |
| `ingredients`   | array of 1 to 100 strings, up to 300 chars | yes        | The lines to rescale.                      |
| `factor`        | number, above 0 and up to 100              | one of two | The multiplier to apply.                   |
| `from_servings` | number, above 0 and up to 500              | one of two | How many servings the list is written for. |
| `to_servings`   | number, above 0 and up to 500              | one of two | How many servings are wanted.              |

Pass `factor`, or the `from_servings` and `to_servings` pair.

**In return:** the `factor` used, the rescaled `ingredients` in the shape
`get_recipe` returns, and `scaled_count`, `rounded_count` and `unscaled_count`.

### `list_recipes`

Lists recipes along the categories the Cookbook files them under. The arguments
combine, and the answer says which search was built from them.

| Argument          | Type                           | Required | What it does                                          |
| ----------------- | ------------------------------ | -------- | ----------------------------------------------------- |
| `cuisine`         | string, up to 80 characters    | no       | A cuisine or a country, such as `Italian` or `Thai`.  |
| `dish_type`       | string, up to 80 characters    | no       | A kind of dish, such as `soup`, `dessert` or `bread`. |
| `main_ingredient` | string, up to 80 characters    | no       | The ingredient a recipe is built on.                  |
| `limit`           | integer, 1 to 50, default `15` | no       | Rows to serve.                                        |

**In return:** the rows `search_recipes` returns, with `query` naming the search
this server built from the arguments, and each argument echoed back or `null`
where it was left out.

## Rescaling the quantities

A quantity is stated in the unit that suits it, so a line can come back in a
different unit from the one the recipe used: 200 g multiplied by twenty reads
`4 kg`.

How finely an ingredient can be divided depends on what it is. A loaf can be cut
in two, in three or in four; an egg cannot be shared out. A quantity landing
between the two is rounded, and the rescaled recipe then departs a little from
the proportions of the original. The line carries `rounded`, and its note says
what was done.

The figures are this server's arithmetic, so say they were recomputed when you
show them. A recipe whose page states no number of servings cannot be put to a
number of people, and the answer says so.

## Licence and attribution

Cookbook pages are published under
[Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Repeating a recipe means crediting Wikibooks and the page it came from, and
sharing what is built on it under the same licence. `get_recipe` returns both
`license` and the page `url`, so an answer carries the credit with it.

## Configuration

Every variable is optional. Set them in the `env` block of your client config.

| Variable               | Default              | What it does                                                                        |
| ---------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| `WB_USER_AGENT`        | the project identity | Names your application to Wikimedia, with an address where a person can be reached. |
| `WB_MIN_INTERVAL_MS`   | `1000`               | Gap between two requests, from 500 to 60000.                                        |
| `WB_TIMEOUT_MS`        | `20000`              | Deadline for one request, from 1000 to 120000.                                      |
| `WB_MAX_RETRIES`       | `3`                  | Attempts after a transient failure, from 0 to 8.                                    |
| `WB_CACHE_TTL_MS`      | `900000`             | How long a page stays in memory, from 0 to 86400000.                                |
| `WB_CACHE_MAX_ENTRIES` | `200`                | Pages held in memory at once, from 1 to 5000.                                       |
| `WB_LOG_LEVEL`         | `error`              | `silent`, `error`, `info` or `debug`, written to stderr.                            |

A value outside its range falls back to the default, and the reason is written to
stderr.

## Errors

Every failure carries one of six codes, a message, and where it helps a hint
naming the next move.

| Code            | What happened                                           | What to do                                                                                                   |
| --------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `not_found`     | The wiki answered, and holds no such page.              | Check the page key with `search_recipes`.                                                                    |
| `invalid_input` | The arguments were refused before any request went out. | Read the message, which names the argument.                                                                  |
| `rate_limited`  | Wikimedia asked this client to slow down.               | Wait the number of seconds the hint names and call again with the same arguments. The recipe is still there. |
| `parse_failure` | The page loaded and the expected content was absent.    | Report it at [the issue tracker](https://github.com/smeet666/mcp-wikibooks-cookbook/issues).                 |
| `network_error` | The request did not complete.                           | Try again shortly.                                                                                           |
| `timeout`       | The request passed its deadline.                        | Raise `WB_TIMEOUT_MS`, or ask for fewer rows.                                                                |

## As a library

The layer reading the wiki is published on its own, with its pacing, its cache
and its errors, and with no protocol attached.

```ts
import { WikibooksClient } from "mcp-wikibooks-cookbook/client";

const client = new WikibooksClient();
const { data, cached } = await client.getRecipe("Cookbook:Spaghetti_alla_Carbonara");
console.log(data.title, data.ingredients.length, cached);
```

`search` and `getRecipe` each answer `{ data, cached }`, and throw an error
carrying one of the six codes. The floor between two requests holds here as well.

## Pacing and attribution

Requests go out one at a time with at least a second between them, and the floor
of half a second holds however the server is configured. The `User-Agent` always
ends with the project identity and an address where a person can be reached.

Reads go to `api.wikimedia.org`, the host Wikimedia documents and maintains for
developers. Every result carries the address of the page it was read from, and
the licence it is published under.

This MCP server is an unofficial project, with no affiliation to Wikimedia or to
the Wikibooks community.

## Privacy

This server collects nothing about you and sends nothing to its author. It runs
on your machine, contacts `api.wikimedia.org` and nothing else, holds its answers in memory
while it runs, and writes nothing to disk.
[PRIVACY.md](PRIVACY.md) states what a request carries and which settings change
any of it.

## Development

```bash
npm install
npm run build:fixtures
npm test
npm run check
```

Tests run against generated fixtures and make no network request. The live suite,
`npm run test:live`, makes one request per route and runs nightly against the
service itself.

## Contributing

Bugs, questions and ideas belong in
[the issue tracker](https://github.com/smeet666/mcp-wikibooks-cookbook/issues).
Pull requests are welcome; opening an issue first helps agree on the shape of the
change. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT for this server's own code, see [LICENSE](LICENSE). The Cookbook pages belong
to their authors and to the Wikibooks community, under CC BY-SA 4.0.

---

<a name="mcp-wikibooks-cookbook-français"></a>

# mcp-wikibooks-cookbook (français)

_[English version](#mcp-wikibooks-cookbook)_

Le [Cookbook](https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents) est la
collection de recettes des Wikibooks anglophones, un projet Wikimedia. Des
milliers de recettes y sont écrites et entretenues à découvert, chacune avec ses
ingrédients, le matériel qu'elle demande, ses étapes, les conseils et variantes
que ses auteurs ont ajoutés, et les catégories sous lesquelles elle se range : une
cuisine, un type de plat, un ingrédient principal. Les pages sont publiées sous
Creative Commons Attribution-Partage dans les mêmes conditions 4.0.

Ce serveur relie un client de conversation à cette collection. On peut y chercher
des recettes par plat ou par ingrédient, les lister par cuisine, type de plat ou
ingrédient principal, en lire une avec ses ingrédients adaptés au nombre de
convives, et adapter n'importe quelle liste d'ingrédients. Aucune clé d'API,
aucun compte.

## Installation

**Installation en un clic**

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=wikibooks-cookbook&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcC13aWtpYm9va3MtY29va2Jvb2siXX0%3D)
[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install-0098FF?style=flat&logo=visualstudiocode&logoColor=white)](https://insiders.vscode.dev/redirect/mcp/install?name=wikibooks-cookbook&config=%7B%22name%22%3A%22wikibooks-cookbook%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22mcp-wikibooks-cookbook%22%5D%7D)

**Claude Code**

```bash
claude mcp add wikibooks-cookbook -- npx -y mcp-wikibooks-cookbook
```

**Claude Desktop, Cursor, et tout client au format de configuration standard**

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

Node 24 ou plus récent est nécessaire, et aucune variable d'environnement n'est à
renseigner.

### Avec Docker

```json
{
  "mcpServers": {
    "wikibooks-cookbook": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "ghcr.io/smeet666/mcp-wikibooks-cookbook:2.0.1"]
    }
  }
}
```

`-i` garde l'entrée standard ouverte, qui est le canal du protocole, et `-t` est
omis parce qu'un TTY réécrit le flux. Le conteneur a besoin d'un accès HTTPS
sortant vers `api.wikimedia.org`, et de rien d'autre : aucun volume, aucun port,
aucun identifiant.

### Bundle, sans npm

Téléchargez `mcp-wikibooks-cookbook-2.0.1.mcpb` depuis
[la dernière publication](https://github.com/smeet666/mcp-wikibooks-cookbook/releases/latest)
et ouvrez-le. Un client qui gère les bundles MCP l'installe seul, sans npm et
sans fichier de configuration à modifier. Le bundle emporte ses dépendances, donc
rien n'est téléchargé à l'installation.

## Ce qu'on peut demander

- « Trouve-moi une recette de carbonara dans le Cookbook. »
- « Lis-la pour six personnes au lieu de quatre. »
- « Quelles soupes thaïes la collection contient-elle ? »
- « Quelles recettes sont bâties sur les lentilles ? »
- « Multiplie cette liste d'ingrédients par 2,5. »

Le chemin ordinaire va d'une recherche à une lecture : une ligne porte un `id`,
la clé de page, et `get_recipe` reprend cette clé.

## Les outils

| Outil               | Ce qu'il fait                                                         |
| ------------------- | --------------------------------------------------------------------- |
| `search_recipes`    | Trouve des recettes par plat ou par ingrédient.                       |
| `get_recipe`        | Lit une recette, adaptée à un nombre de parts sur demande.            |
| `scale_ingredients` | Adapte n'importe quelle liste d'ingrédients, sans requête au wiki.    |
| `list_recipes`      | Liste des recettes par cuisine, type de plat ou ingrédient principal. |

### `search_recipes`

Cherche dans le Cookbook, soit dans tout le texte de ses pages, soit dans leurs
seuls titres.

| Argument | Type                             | Requis | Ce qu'il fait                                                          |
| -------- | -------------------------------- | ------ | ---------------------------------------------------------------------- |
| `query`  | chaîne, 1 à 300 caractères       | oui    | Un plat, comme `carbonara`, ou un ingrédient, comme `guanciale`.       |
| `search` | `text` ou `title`, défaut `text` | non    | `text` lit toute la page ; `title` ne correspond qu'au nom de la page. |
| `limit`  | entier, 1 à 50, défaut `10`      | non    | Lignes à servir.                                                       |

**En retour :** des lignes portant `id`, la clé de page que `get_recipe`
reprend ; `title` ; `url` ; `image_url` ; `description`, la courte glose que le
wiki garde pour une page ; et `excerpt`, le passage correspondant débarrassé de
son balisage de surlignage. Chacun des trois derniers vaut `null` là où la
recherche n'en a proposé aucun. `total_available` vaut toujours `null` : la route
de recherche ne publie ni total ni pagination, donc `result_count` compte les
lignes rendues par cet appel.

### `get_recipe`

Lit une recette, et adapte ses ingrédients quand un nombre de parts est donné.

| Argument                | Type                               | Requis | Ce qu'il fait                                              |
| ----------------------- | ---------------------------------- | ------ | ---------------------------------------------------------- |
| `id`                    | chaîne, 1 à 300 caractères         | oui    | La clé de page, comme `Cookbook:Spaghetti_alla_Carbonara`. |
| `servings`              | entier, 1 à 500                    | non    | Adapte les ingrédients à ce nombre de parts.               |
| `max_description_chars` | entier, 100 à 20000, défaut `1200` | non    | La quantité de prose de la page à servir.                  |

**En retour :** `title`, `url`, `ingredients`, `equipment`, `steps`, `tips` pour
les notes et variantes que la page publie, `prep_minutes`, `cook_minutes`,
`total_minutes`, `time_text` dans les termes de la page, `time_phases`,
`category` et `categories` pour chaque catégorie sous laquelle la page se range.
Un chiffre que la page n'indique pas vaut `null`. `id` nomme la page qui a été
lue, qui diffère de la clé demandée après une redirection, et `redirected_from`
nomme alors la clé qui y a mené. `yield` dit pour quoi la recette est écrite et
vers quoi elle a été adaptée, et chaque ingrédient porte `scaling`, valant
`scaled`, `rounded` ou `unscaled`.

### `scale_ingredients`

Applique la même arithmétique à n'importe quelle liste d'ingrédients, sans
requête au wiki.

| Argument        | Type                                               | Requis        | Ce qu'il fait                             |
| --------------- | -------------------------------------------------- | ------------- | ----------------------------------------- |
| `ingredients`   | tableau de 1 à 100 chaînes, jusqu'à 300 caractères | oui           | Les lignes à adapter.                     |
| `factor`        | nombre, au-delà de 0 jusqu'à 100                   | l'un des deux | Le multiplicateur à appliquer.            |
| `from_servings` | nombre, au-delà de 0 jusqu'à 500                   | l'un des deux | Le nombre de parts de la liste d'origine. |
| `to_servings`   | nombre, au-delà de 0 jusqu'à 500                   | l'un des deux | Le nombre de parts voulu.                 |

Passez `factor`, ou le couple `from_servings` et `to_servings`.

**En retour :** le `factor` employé, les `ingredients` adaptés dans la forme que
rend `get_recipe`, et `scaled_count`, `rounded_count` et `unscaled_count`.

### `list_recipes`

Liste des recettes selon les catégories sous lesquelles le Cookbook les range.
Les arguments se combinent, et la réponse dit quelle recherche en a été bâtie.

| Argument          | Type                          | Requis | Ce qu'il fait                                        |
| ----------------- | ----------------------------- | ------ | ---------------------------------------------------- |
| `cuisine`         | chaîne, jusqu'à 80 caractères | non    | Une cuisine ou un pays, comme `Italian` ou `Thai`.   |
| `dish_type`       | chaîne, jusqu'à 80 caractères | non    | Un type de plat, comme `soup`, `dessert` ou `bread`. |
| `main_ingredient` | chaîne, jusqu'à 80 caractères | non    | L'ingrédient sur lequel une recette est bâtie.       |
| `limit`           | entier, 1 à 50, défaut `15`   | non    | Lignes à servir.                                     |

**En retour :** les lignes que rend `search_recipes`, avec `query` qui nomme la
recherche bâtie par ce serveur à partir des arguments, et chaque argument redonné
ou `null` là où il a été omis.

## L'adaptation des quantités

Une quantité est exprimée dans l'unité qui lui convient. Après adaptation, une
ligne peut donc apparaître dans une autre unité que celle de la recette : 200 g
multipliés par vingt donnent `4 kg`.

La finesse à laquelle un ingrédient se coupe dépend de sa nature. Un pain se
coupe en deux, en trois ou en quatre ; un oeuf ne se partage pas. Une quantité
qui tombe entre les deux est donc arrondie, et la recette adaptée s'écarte alors
un peu des proportions de l'originale. La ligne porte `rounded`, et sa note dit
ce qui a été fait.

Les chiffres sont l'arithmétique de ce serveur, donc dites qu'ils ont été
recalculés quand vous les montrez. Une recette dont la page n'indique aucun
nombre de parts ne peut pas être portée à un nombre de convives, et la réponse le
dit.

## La licence et l'attribution

Les pages du Cookbook sont publiées sous
[Creative Commons Attribution-Partage dans les mêmes conditions 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr).
Reprendre une recette demande de créditer Wikibooks et la page d'où elle vient,
et de partager ce qu'on bâtit dessus sous la même licence. `get_recipe` rend à la
fois `license` et l'`url` de la page, donc une réponse emporte le crédit avec
elle.

## Configuration

Chaque variable est facultative. Elles se posent dans le bloc `env` de la
configuration du client.

| Variable               | Défaut               | Ce qu'elle fait                                                                        |
| ---------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| `WB_USER_AGENT`        | l'identité du projet | Nomme votre application auprès de Wikimedia, avec une adresse où joindre une personne. |
| `WB_MIN_INTERVAL_MS`   | `1000`               | Écart entre deux requêtes, de 500 à 60000.                                             |
| `WB_TIMEOUT_MS`        | `20000`              | Délai d'une requête, de 1000 à 120000.                                                 |
| `WB_MAX_RETRIES`       | `3`                  | Tentatives après un échec passager, de 0 à 8.                                          |
| `WB_CACHE_TTL_MS`      | `900000`             | Durée pendant laquelle une page reste en mémoire, de 0 à 86400000.                     |
| `WB_CACHE_MAX_ENTRIES` | `200`                | Pages gardées en mémoire à la fois, de 1 à 5000.                                       |
| `WB_LOG_LEVEL`         | `error`              | `silent`, `error`, `info` ou `debug`, écrit sur la sortie d'erreur.                    |

Une valeur hors de sa plage retombe sur le défaut, et la raison est écrite sur la
sortie d'erreur.

## Erreurs

Chaque échec porte un des six codes, un message, et quand cela aide une
indication du geste suivant.

| Code            | Ce qui s'est passé                                 | Que faire                                                                                          |
| --------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `not_found`     | Le wiki a répondu, et n'a pas cette page.          | Vérifiez la clé de page avec `search_recipes`.                                                     |
| `invalid_input` | Les arguments ont été refusés avant toute requête. | Lisez le message, qui nomme l'argument.                                                            |
| `rate_limited`  | Wikimedia demande à ce client de ralentir.         | Attendez les secondes indiquées et rappelez avec les mêmes arguments. La recette est toujours là.  |
| `parse_failure` | La page a chargé et le contenu attendu est absent. | Signalez-le sur [le suivi d'incidents](https://github.com/smeet666/mcp-wikibooks-cookbook/issues). |
| `network_error` | La requête n'a pas abouti.                         | Réessayez sous peu.                                                                                |
| `timeout`       | La requête a dépassé son délai.                    | Augmentez `WB_TIMEOUT_MS`, ou demandez moins de lignes.                                            |

## Comme bibliothèque

La couche qui lit le wiki est publiée seule, avec son rythme, son cache et ses
erreurs, sans protocole attaché.

```ts
import { WikibooksClient } from "mcp-wikibooks-cookbook/client";

const client = new WikibooksClient();
const { data, cached } = await client.getRecipe("Cookbook:Spaghetti_alla_Carbonara");
console.log(data.title, data.ingredients.length, cached);
```

`search` et `getRecipe` répondent chacun `{ data, cached }`, et lèvent une erreur
portant un des six codes. Le plancher entre deux requêtes tient également ici.

## Rythme et attribution

Les requêtes partent une à une avec au moins une seconde entre elles, et le
plancher d'une demi-seconde tient quelle que soit la configuration. Le
`User-Agent` se termine toujours par l'identité du projet et une adresse où
joindre une personne.

Les lectures vont vers `api.wikimedia.org`, l'hôte que Wikimedia documente et
maintient pour les développeurs. Chaque résultat porte l'adresse de la page d'où
il a été lu, et la licence sous laquelle elle est publiée.

Ce MCP est un projet non officiel, sans affiliation à Wikimedia ni à la
communauté Wikibooks.

## Confidentialité

Ce serveur ne collecte rien sur vous et n'envoie rien à son auteur. Il tourne sur
votre machine, ne joint que `api.wikimedia.org`, garde ses réponses en mémoire le temps qu'il
tourne, et n'écrit rien sur le disque. [PRIVACY.md](PRIVACY.md) dit ce qu'une
requête emporte et quels réglages changent cela.

## Développement

```bash
npm install
npm run build:fixtures
npm test
npm run check
```

Les tests s'exécutent sur des fixtures engendrées et n'émettent aucune requête.
La suite en direct, `npm run test:live`, émet une requête par route et tourne
chaque nuit contre le service lui-même.

## Contribuer

Les anomalies, les questions et les idées ont leur place dans
[le suivi d'incidents](https://github.com/smeet666/mcp-wikibooks-cookbook/issues).
Les propositions de modification sont bienvenues ; ouvrir un ticket d'abord aide
à s'accorder sur la forme du changement. Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT pour le code de ce serveur, voir [LICENSE](LICENSE). Les pages du Cookbook
appartiennent à leurs auteurs et à la communauté Wikibooks, sous CC BY-SA 4.0.
