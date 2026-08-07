/**
 * What happens to an argument no tool declares.
 *
 * A caller who mistypes an argument name, or qualifies one this server keeps
 * plain, must be told. An argument that is read and dropped leaves the answer
 * computed on a default, which reads as an answer to the question that was
 * asked and is not one.
 *
 * Everything here goes over the protocol, because the refusal is the server's
 * answer to a client rather than an internal check.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../src/server.js";
import { silentLogger } from "./helpers.js";
import { gatewayFetch, readFixture } from "./spec.helpers.js";

const EPOCH = new Date("2026-01-01T00:00:00.000Z");
const AMPLE_MS = 300_000;

/** One valid call per tool, so a refusal is never mistaken for a broken tool. */
const CALLS: Array<[string, Record<string, unknown>]> = [
  ["search_recipes", { query: "noodles" }],
  ["list_recipes", { cuisine: "italian" }],
  ["get_recipe", { id: "Cookbook:Salt_Flat_Noodles" }],
  ["scale_ingredients", { ingredients: ["450 g flat noodles"], factor: 2 }],
];

const open = new Set<{ close: () => Promise<void> }>();

async function connect(): Promise<Client> {
  const { fetchImpl } = gatewayFetch({
    search: readFixture("search-recipes"),
    page: readFixture("page-recipe"),
  });
  const server = createServer({ fetchImpl, logger: silentLogger });
  const client = new Client({ name: "unknown-arguments", version: "0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  open.add({
    close: async () => {
      await client.close().catch(() => undefined);
      await server.close().catch(() => undefined);
    },
  });
  return client;
}

/** Wikimedia is asked for time between requests, so the clock is driven on. */
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

afterEach(async () => {
  for (const harness of open) await harness.close();
  open.clear();
  vi.useRealTimers();
});

interface CallResult {
  isError?: boolean;
  content?: Array<{ text?: string }>;
}

/** What a caller receives: whether the call failed, and what it was told. */
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; text: string }> {
  const result = (await drive(client.callTool({ name, arguments: args }))) as CallResult;
  return {
    isError: result.isError === true,
    text: (result.content ?? []).map((part) => part.text ?? "").join("\n"),
  };
}

describe("the schema a client reads before calling", () => {
  it("says on every tool that an argument it does not declare is refused", async () => {
    const client = await connect();
    const { tools } = await drive(client.listTools());
    expect(tools.length).toBe(CALLS.length);
    for (const tool of tools) {
      expect(
        (tool.inputSchema as { additionalProperties?: unknown }).additionalProperties,
        tool.name,
      ).toBe(false);
    }
  });
});

describe("an argument no tool declares", () => {
  it("is refused by every tool, and the refusal names it", async () => {
    const client = await connect();
    for (const [name, args] of CALLS) {
      const result = await call(client, name, { ...args, not_an_argument: 1 });
      expect(result.isError, name).toBe(true);
      expect(result.text, name).toContain("not_an_argument");
    }
  });

  it("is refused under the code the caller can branch on", async () => {
    const client = await connect();
    const result = await call(client, "search_recipes", { query: "noodles", not_an_argument: 1 });
    expect(result.text).toContain("invalid_input");
  });

  it("is answered with the declared name when one is close", async () => {
    const client = await connect();
    const qualified = await call(client, "search_recipes", {
      query: "noodles",
      limit_per_source: 3,
    });
    expect(qualified.text).toContain("did you mean 'limit'");

    const misspelt = await call(client, "get_recipe", {
      id: "Cookbook:Salt_Flat_Noodles",
      serving: 4,
    });
    expect(misspelt.text).toContain("did you mean 'servings'");
  });

  it("lists the names the tool does take", async () => {
    const client = await connect();
    const result = await call(client, "get_recipe", { page: "Cookbook:Salt_Flat_Noodles" });
    expect(result.text).toContain("This tool takes: id, servings, max_description_chars.");
  });

  it("leaves the arguments a tool does declare working", async () => {
    const client = await connect();
    for (const [name, args] of CALLS) {
      const result = await call(client, name, args);
      expect(result.isError, `${name}: ${result.text}`).toBe(false);
    }
  });
});
