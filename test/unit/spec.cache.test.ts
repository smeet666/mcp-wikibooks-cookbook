/**
 * What the cache is allowed to remember.
 *
 * An answer nobody could read must not be served back for the rest of the
 * cache's lifetime, because the failure would then outlive the fault. The clock
 * is fake and pinned.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { silentLogger } from "./helpers.js";
import { readFixture } from "./spec.helpers.js";

const EPOCH = new Date("2026-01-01T00:00:00.000Z");
const AMPLE_MS = 600_000;

function sequencedFetch(bodies: Array<{ body: unknown; status?: number }>): {
  fetchImpl: typeof fetch;
  count: () => number;
} {
  let index = 0;
  const fetchImpl = (async () => {
    const step = bodies[Math.min(index, bodies.length - 1)] as {
      body: unknown;
      status?: number;
    };
    index += 1;
    return new Response(JSON.stringify(step.body), {
      status: step.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, count: () => index };
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

describe("the cache stores answers, never failures", () => {
  it("does not remember a response it could not parse", async () => {
    const { fetchImpl, count } = sequencedFetch([
      { body: readFixture("search-no-pages") },
      { body: readFixture("search-recipes") },
    ]);
    const client = new CookbookClient({
      fetchImpl,
      logger: silentLogger,
      config: { maxRetries: 0 } as never,
    });

    const first = await drive(client.search("salt", 3).catch((error: unknown) => error));
    expect(first).toBeInstanceOf(Error);

    const second = await drive(client.search("salt", 3));
    expect(second.data.results.length).toBeGreaterThan(0);
    expect(second.cached).toBe(false);
    expect(count()).toBe(2);
  });

  it("serves a second identical read from memory and says it did", async () => {
    const { fetchImpl, count } = sequencedFetch([{ body: readFixture("search-recipes") }]);
    const client = new CookbookClient({ fetchImpl, logger: silentLogger });

    const first = await drive(client.search("salt", 3));
    const second = await drive(client.search("salt", 3));

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(count()).toBe(1);
    expect(second.data.results).toEqual(first.data.results);
  });

  it("does not confuse one page with another", async () => {
    const { fetchImpl } = sequencedFetch([
      { body: readFixture("page-recipe") },
      { body: readFixture("page-reference") },
    ]);
    const client = new CookbookClient({ fetchImpl, logger: silentLogger });

    const noodles = await drive(client.getRecipe("Cookbook:Salt_Flat_Noodles"));
    const oil = await drive(client.getRecipe("Cookbook:Lamp_Oil"));

    expect(noodles.data.key).not.toBe(oil.data.key);
    expect(oil.cached).toBe(false);
  });

  it("keeps 'skipped' for what was actually dropped", async () => {
    const { fetchImpl } = sequencedFetch([{ body: readFixture("search-recipes") }]);
    const client = new CookbookClient({ fetchImpl, logger: silentLogger });
    const read = await drive(client.search("salt", 10));
    // The corpus carries one row with no key, which is one row nobody can open.
    expect(read.skipped).toBe(1);
    expect(read.data.results.every((row) => row.key.length > 0)).toBe(true);
  });

  it("refuses an empty reference rather than fetching a page called nothing", async () => {
    const { fetchImpl, count } = sequencedFetch([{ body: readFixture("page-recipe") }]);
    const client = new CookbookClient({ fetchImpl, logger: silentLogger });
    await expect(drive(client.getRecipe("   "))).rejects.toThrow();
    expect(count()).toBe(0);
  });
});
