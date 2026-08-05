/**
 * What a client sees before it calls anything: the tool list, the annotations,
 * and the guidance the server publishes about itself.
 */

import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { INSTRUCTIONS, createServer } from "../../src/server.js";
import { loadConfig } from "../../src/config.js";
import { fixture, routedFetch, silentLogger } from "./helpers.js";

async function connect() {
  const { fetchImpl } = routedFetch([
    ["/search/page", fixture("search-recipes")],
    ["/search/title", fixture("search-recipes")],
    ["/page/", fixture("page-recipe")],
  ]);
  const server = createServer({
    config: { ...loadConfig({}), cacheTtlMs: 0, minIntervalMs: 500, maxRetries: 0 },
    logger: silentLogger,
    fetchImpl,
  });
  const client = new Client({ name: "test", version: "0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe("the server as a client sees it", () => {
  it("publishes exactly the four tools", async () => {
    const { client, server } = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "get_recipe",
      "list_recipes",
      "scale_ingredients",
      "search_recipes",
    ]);
    await server.close();
  });

  it("declares every tool read-only and open-world", async () => {
    const { client, server } = await connect();
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    }
    await server.close();
  });

  it("declares an output schema on every tool", async () => {
    const { client, server } = await connect();
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.outputSchema).toBeDefined();
      expect(tool.description && tool.description.length > 80).toBe(true);
    }
    await server.close();
  });

  it("answers a call with a payload matching what it declared", async () => {
    const { client, server } = await connect();
    const result = await client.callTool({
      name: "get_recipe",
      arguments: { id: "Cookbook:Salt_Flat_Noodles", servings: 4 },
    });
    const structured = result.structuredContent as { yield: { factor: number } };
    expect(structured.yield.factor).toBe(0.667);
    await server.close();
  });

  it("rescales offline without reaching the gateway", async () => {
    const { client, server } = await connect();
    const result = await client.callTool({
      name: "scale_ingredients",
      arguments: { ingredients: ["5 egg yolks"], from_servings: 6, to_servings: 4 },
    });
    const structured = result.structuredContent as { ingredients: Array<{ text: string }> };
    expect(structured.ingredients[0]!.text).toBe("3 egg yolks");
    await server.close();
  });
});

describe("the guidance the server publishes", () => {
  it("names the flow and the tool that reads a page", () => {
    expect(INSTRUCTIONS).toContain("search_recipes");
    expect(INSTRUCTIONS).toContain("get_recipe");
    expect(INSTRUCTIONS).toContain("list_recipes");
  });

  it("warns against a model doing the arithmetic itself", () => {
    expect(INSTRUCTIONS).toContain("Do not rescale quantities yourself");
    expect(INSTRUCTIONS).toContain("2.4 eggs");
  });

  it("says that being asked to slow down is not an absence", () => {
    expect(INSTRUCTIONS).toContain("never that the recipe is missing");
  });

  it("says what a null means and what the Cookbook never publishes", () => {
    expect(INSTRUCTIONS).toContain("never zero");
    expect(INSTRUCTIONS).toContain("no reader rating");
  });
});
