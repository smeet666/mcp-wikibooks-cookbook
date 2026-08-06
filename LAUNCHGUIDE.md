# mcp-wikibooks-cookbook

## Tagline

Search the Wikibooks Cookbook and rescale a recipe without ending up with 2.4 eggs.

## Description

An MCP server for the Cookbook on the English Wikibooks: thousands of recipes
written and maintained in the open, with their ingredients, their equipment and
their steps. Find a dish by name or by an ingredient it uses, browse by cuisine
or by kind of dish, read one page, and rescale it to the number of people you
are actually cooking for.

The arithmetic is the part worth having. A naive multiplication of a
six-serving recipe down to four gives 3.33 egg yolks and 0.67 of a pinch of
pepper, and neither is something a kitchen can produce. This server lands a
countable thing where a cook can follow it, moves a small measurement to a
smaller unit before rounding it so nothing vanishes, scales both figures on a
line that publishes two, and flags whatever cannot be multiplied rather than
multiplying it anyway.

The server is careful about what it refuses to claim. A failure is never
reported as an empty result. A page that states no yield comes back as
published, with the reason, rather than rescaled from a guess. A time, a
difficulty or a nutrition panel a page does not publish is null, never zero.
The Cookbook has no single author and no reader rating, so those are always
null. Neither search reports a total, so `total_available` is null rather than
a number nobody counted.

Cookbook pages are published under Creative Commons Attribution-ShareAlike 4.0,
which means crediting Wikibooks and sharing alike. Every answer carries the page
address, and a recipe carries the licence to name alongside it.

## Setup Requirements

- `WB_USER_AGENT` (optional): Identify your own client. This project's identifier stays appended, so Wikimedia can always reach a human.
- `WB_MIN_INTERVAL_MS` (optional): Minimum gap between requests. Default 1000, values below 500 or above 60000 are refused.
- `WB_TIMEOUT_MS` (optional): Per-request deadline. Default 20000, accepted between 1000 and 120000.
- `WB_MAX_RETRIES` (optional): Retries on a busy or rate-limited gateway. Default 3, accepted up to 8.
- `WB_CACHE_TTL_MS` (optional): In-memory cache lifetime. Default 900000. Set 0 to turn it off.
- `WB_CACHE_MAX_ENTRIES` (optional): In-memory cache size. Default 200.
- `WB_LOG_LEVEL` (optional): silent, error, info or debug. Default error, on stderr.

No API key and no account are needed.

## Category

Lifestyle & Cooking

## Features

- Full-text search of the Cookbook, which finds a dish from an ingredient inside the page
- Title search for the exact name of a page
- Reads ingredients written as a bulleted list and ingredients laid out as a table alike
- Ingredients, equipment, procedure, tips, yield, time, difficulty, category and the nutrition panel when a page carries one
- Rescale by servings, or rescale any English ingredient list offline
- A countable thing lands where a kitchen can follow: an egg on a whole one, a clove of garlic on a half
- A small measurement moves to a smaller unit before it is rounded, so it never disappears
- A container is divided by what it holds: half a can of tomatoes is an amount, half an egg is not
- An approximate measure such as a pinch is multiplied as pinches rather than converted
- A line publishing two quantities, metric and imperial, has both of them scaled
- Every scaled line says whether it was exact, rounded, or left as published
- Rescaling needs a stated yield; a page without one comes back as published and says so
- A page carrying no ingredient list says so, rather than passing for a recipe with nothing in it
- A failure is returned as an error code rather than as an empty result
- Every result carries its page address, and a recipe carries its licence
- Self-paced against the Wikimedia developer gateway, with an honest User-Agent

## Getting Started

- "Find a carbonara recipe on the Cookbook and scale it to four people"
- "What Thai soups does the Cookbook have?"
- "Read Cookbook:Crème Brûlée II and tell me what I need to buy"
- "Here is my ingredient list for 6, give it to me for 25"
- Tool: search_recipes — Finds a page by dish name or by an ingredient it uses
- Tool: get_recipe — Reads one page, optionally rescaled to a number of servings
- Tool: scale_ingredients — Rescales any English ingredient list, offline
- Tool: list_recipes — Browses by cuisine, kind of dish or main ingredient

## Tags

wikibooks, cookbook, recipes, cooking, ingredient-scaling, servings, wikimedia, creative-commons, open-content, no-api-key

## Documentation URL

https://github.com/smeet666/mcp-wikibooks-cookbook#readme
