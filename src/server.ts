/**
 * Wiring: one client, four tools, and the guidance a model reads before using
 * any of them.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config, Logger } from "./config.js";
import { createLogger, loadConfig } from "./config.js";
import { CookbookClient } from "./wikibooks/client.js";
import {
  getRecipeDescription,
  getRecipeInput,
  getRecipeOutput,
  runGetRecipe,
} from "./tools/getRecipe.js";
import type { GetRecipeArgs } from "./tools/getRecipe.js";
import {
  listRecipesDescription,
  listRecipesInput,
  listRecipesOutput,
  runListRecipes,
} from "./tools/listRecipes.js";
import type { ListRecipesArgs } from "./tools/listRecipes.js";
import {
  runScaleIngredients,
  scaleIngredientsDescription,
  scaleIngredientsInput,
  scaleIngredientsOutput,
} from "./tools/scaleIngredients.js";
import type { ScaleIngredientsArgs } from "./tools/scaleIngredients.js";
import {
  runSearchRecipes,
  searchRecipesDescription,
  searchRecipesInput,
  searchRecipesOutput,
} from "./tools/searchRecipes.js";
import type { SearchRecipesArgs } from "./tools/searchRecipes.js";
import { PKG_VERSION } from "./version.js";

export interface CreateServerOptions {
  config?: Config;
  logger?: Logger;
  fetchImpl?: typeof fetch;
}

/** Nothing here writes, uploads or edits; every tool only reads. */
const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const INSTRUCTIONS = [
  "Tools for the Cookbook on the English Wikibooks. No API key and no account are needed.",
  "Typical flow: search_recipes to find a page and its id, then get_recipe with that id, passing 'servings' when the user wants a different number of people.",
  "Use list_recipes when there is no dish to look up and the question is a cuisine, a kind of dish or a main ingredient.",
  "Do not rescale quantities yourself: get_recipe and scale_ingredients round countable items sensibly, move a small measurement to a smaller unit before rounding it, and flag what cannot be scaled, which is what stops answers like '2.4 eggs'.",
  "The Cookbook keeps recipes and reference pages in one namespace, so a search row can be a page about an ingredient rather than a recipe using it. Only get_recipe can tell them apart, and it says when a page carries no ingredient list.",
  "Rescaling needs a stated yield. A page without one comes back as published and says so, rather than guessing what it serves.",
  "Neither search reports a total and neither offers a second page, so 'total_available' is null and a short list is not evidence that little exists.",
  "A time, a difficulty or a nutrition panel a page does not publish is null, never zero. The Cookbook has no single author and no reader rating, so those are always null.",
  "This server paces itself, and a rate_limited error means Wikimedia asked it to slow down, never that the recipe is missing.",
  "Pages are published under a Creative Commons licence that requires attribution: every result carries a url, and get_recipe carries the licence to name alongside it.",
].join(" ");

export function createServer(options: CreateServerOptions = {}): McpServer {
  const config = options.config ?? loadConfig();
  const logger = options.logger ?? createLogger(config.logLevel);
  const client = new CookbookClient({
    config,
    logger,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });

  const server = new McpServer(
    { name: "mcp-wikibooks-cookbook", version: PKG_VERSION },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "search_recipes",
    {
      title: "Search the Cookbook",
      description: searchRecipesDescription,
      inputSchema: searchRecipesInput,
      outputSchema: searchRecipesOutput,
      annotations: READ_ONLY,
    },
    async (args) => runSearchRecipes(client, args as SearchRecipesArgs),
  );

  server.registerTool(
    "get_recipe",
    {
      title: "Read a recipe",
      description: getRecipeDescription,
      inputSchema: getRecipeInput,
      outputSchema: getRecipeOutput,
      annotations: READ_ONLY,
    },
    async (args) => runGetRecipe(client, args as GetRecipeArgs),
  );

  server.registerTool(
    "scale_ingredients",
    {
      title: "Rescale an ingredient list",
      description: scaleIngredientsDescription,
      inputSchema: scaleIngredientsInput,
      outputSchema: scaleIngredientsOutput,
      annotations: READ_ONLY,
    },
    async (args) => runScaleIngredients(args as ScaleIngredientsArgs),
  );

  server.registerTool(
    "list_recipes",
    {
      title: "Browse the Cookbook",
      description: listRecipesDescription,
      inputSchema: listRecipesInput,
      outputSchema: listRecipesOutput,
      annotations: READ_ONLY,
    },
    async (args) => runListRecipes(client, args as ListRecipesArgs),
  );

  logger.info(
    `ready: user-agent="${config.userAgent}", ${config.minIntervalMs}ms between requests, cache ${config.cacheTtlMs}ms`,
  );

  return server;
}
