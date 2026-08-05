/**
 * What a client sees over the protocol: tool names, argument names, hints and
 * the schema each answer is checked against.
 *
 * The names are not this server's to choose. A caller merging two recipe
 * servers asks both the same question, so the argument names are part of the
 * contract rather than an internal detail.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../src/server.js";
import { silentLogger } from "./helpers.js";
import { gatewayFetch, readFixture } from "./spec.helpers.js";

const EPOCH = new Date("2026-01-01T00:00:00.000Z");
const AMPLE_MS = 300_000;

async function connected(): Promise<Client> {
  const { fetchImpl } = gatewayFetch({
    search: readFixture("search-recipes"),
    page: readFixture("page-recipe"),
  });
  const server = createServer({ fetchImpl, logger: silentLogger });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "spec", version: "1.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

async function drive<T>(pending: Promise<T>): Promise<T> {
  const held = pending.catch(() => undefined);
  await vi.advanceTimersByTimeAsync(AMPLE_MS);
  await held;
  return pending;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(EPOCH);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the tools a client is offered", () => {
  it("carries the three names the recipe contract fixes", async () => {
    const client = await connected();
    const { tools } = await drive(client.listTools());
    const names = tools.map((tool) => tool.name).sort();
    expect(names).toContain("search_recipes");
    expect(names).toContain("get_recipe");
    expect(names).toContain("scale_ingredients");
  });

  it("declares every tool read-only, idempotent and open-world", async () => {
    const client = await connected();
    const { tools } = await drive(client.listTools());
    for (const tool of tools) {
      expect(tool.annotations, `${tool.name} has no annotations`).toBeDefined();
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
      expect(tool.annotations?.idempotentHint).toBe(true);
      expect(tool.annotations?.openWorldHint).toBe(true);
      expect(tool.outputSchema, `${tool.name} declares no output schema`).toBeDefined();
    }
  });

  it("takes the argument names the contract fixes", async () => {
    const client = await connected();
    const { tools } = await drive(client.listTools());
    const propertiesOf = (name: string) => {
      const tool = tools.find((entry) => entry.name === name);
      return Object.keys(
        (tool?.inputSchema as { properties?: Record<string, unknown> })?.properties ?? {},
      ).sort();
    };
    expect(propertiesOf("search_recipes")).toEqual(["limit", "query", "search"]);
    expect(propertiesOf("get_recipe")).toEqual(["id", "max_description_chars", "servings"]);
    expect(propertiesOf("scale_ingredients")).toEqual([
      "factor",
      "from_servings",
      "ingredients",
      "to_servings",
    ]);
    expect(propertiesOf("list_recipes")).toEqual([
      "cuisine",
      "dish_type",
      "limit",
      "main_ingredient",
    ]);
  });

  it("tells a model what search_recipes cannot count", async () => {
    const client = await connected();
    const { tools } = await drive(client.listTools());
    const search = tools.find((tool) => tool.name === "search_recipes");
    expect(search?.description).toMatch(/total_available.*null/i);
    expect(search?.description).toMatch(/no second page|narrow the query/i);
  });

  it("tells a model that list_recipes is a search rather than a category", async () => {
    const client = await connected();
    const { tools } = await drive(client.listTools());
    const list = tools.find((tool) => tool.name === "list_recipes");
    expect(list?.description).toMatch(/built on|search/i);
    expect(list?.description).toMatch(/not the category|ranked sample/i);
    expect(list?.description).toMatch(/neither complete|says nothing about how many/i);
  });

  it("tells a model that author and rating are always null", async () => {
    const client = await connected();
    const { tools } = await drive(client.listTools());
    const get = tools.find((tool) => tool.name === "get_recipe");
    expect(get?.description).toMatch(/'author' and 'rating' are always null/i);
    expect(get?.description).toMatch(/null, never zero/i);
  });
});

describe("an answer that reaches a client", () => {
  it("passes its own declared output schema", async () => {
    const client = await connected();
    const result = (await drive(
      client.callTool({
        name: "scale_ingredients",
        arguments: { ingredients: ["450 g (1 pound) flat noodles", "Salt"], factor: 2 },
      }),
    )) as { isError?: boolean; structuredContent?: Record<string, unknown> };
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent?.factor).toBe(2);
  });

  it("carries a link back on a recipe", async () => {
    const client = await connected();
    const result = (await drive(
      client.callTool({ name: "get_recipe", arguments: { id: "Cookbook:Salt_Flat_Noodles" } }),
    )) as {
      isError?: boolean;
      structuredContent?: Record<string, unknown>;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent?.url).toMatch(/^https:\/\/en\.wikibooks\.org\//);
    expect(result.content.map((block) => block.text).join("\n")).toContain(
      result.structuredContent?.url as string,
    );
  });

  it("refuses arguments the schema does not accept rather than answering anyway", async () => {
    const client = await connected();
    const result = (await drive(
      client.callTool({ name: "get_recipe", arguments: { id: "" } }),
    )) as { isError?: boolean };
    expect(result.isError).toBe(true);
  });
});
