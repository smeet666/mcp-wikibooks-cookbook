/**
 * The floor under the pacing, from both directions a caller can push on it.
 *
 * The clock is fake and pinned; the gaps asserted here are gaps on that clock,
 * so nothing depends on how fast the machine is.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_ALLOWED_INTERVAL_MS, loadConfig } from "../../src/config.js";
import { CookbookClient } from "../../src/wikibooks/client.js";
import { REPO_URL } from "../../src/version.js";
import { silentLogger } from "./helpers.js";
import { REPO_ROOT, readFixture } from "./spec.helpers.js";

const EPOCH = new Date("2026-01-01T00:00:00.000Z");
const AMPLE_MS = 600_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(EPOCH);
});

afterEach(() => {
  vi.useRealTimers();
});

function timedFetch(): { fetchImpl: typeof fetch; at: number[] } {
  const at: number[] = [];
  const body = JSON.stringify(readFixture("search-recipes"));
  const fetchImpl = (async () => {
    at.push(Date.now());
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchImpl, at };
}

async function gapBetweenTwoReads(config: Record<string, unknown>): Promise<number> {
  const { fetchImpl, at } = timedFetch();
  const client = new CookbookClient({
    fetchImpl,
    logger: silentLogger,
    config: config as never,
  });
  const first = client.search("one", 3);
  const second = client.search("two", 3);
  const held = Promise.allSettled([first, second]);
  await vi.advanceTimersByTimeAsync(AMPLE_MS);
  await held;
  expect(at.length).toBe(2);
  return (at[1] as number) - (at[0] as number);
}

describe("configuration cannot speed the server up", () => {
  it("declares a floor of half a second", () => {
    expect(MIN_ALLOWED_INTERVAL_MS).toBe(500);
  });

  it("refuses an interval below the floor and keeps the default", () => {
    expect(loadConfig({ WB_MIN_INTERVAL_MS: "100" }).minIntervalMs).toBeGreaterThanOrEqual(
      MIN_ALLOWED_INTERVAL_MS,
    );
    expect(loadConfig({ WB_MIN_INTERVAL_MS: "0" }).minIntervalMs).toBeGreaterThanOrEqual(
      MIN_ALLOWED_INTERVAL_MS,
    );
    expect(loadConfig({ WB_MIN_INTERVAL_MS: "-5000" }).minIntervalMs).toBeGreaterThanOrEqual(
      MIN_ALLOWED_INTERVAL_MS,
    );
    expect(loadConfig({ WB_MIN_INTERVAL_MS: "499" }).minIntervalMs).toBeGreaterThanOrEqual(
      MIN_ALLOWED_INTERVAL_MS,
    );
  });

  it("accepts an interval at or above the floor", () => {
    expect(loadConfig({ WB_MIN_INTERVAL_MS: "500" }).minIntervalMs).toBe(500);
    expect(loadConfig({ WB_MIN_INTERVAL_MS: "2500" }).minIntervalMs).toBe(2500);
  });

  it("falls back rather than stopping on a value it cannot read", () => {
    const config = loadConfig({ WB_MIN_INTERVAL_MS: "fast", WB_MAX_RETRIES: "" });
    expect(config.minIntervalMs).toBeGreaterThanOrEqual(MIN_ALLOWED_INTERVAL_MS);
    expect(config.maxRetries).toBe(3);
  });
});

describe("the published client entry point cannot lower the floor either", () => {
  it("spaces two reads by the floor when told to space them by one millisecond", async () => {
    expect(await gapBetweenTwoReads({ minIntervalMs: 1 })).toBeGreaterThanOrEqual(
      MIN_ALLOWED_INTERVAL_MS,
    );
  });

  it("spaces two reads by the floor when told to space them by nothing at all", async () => {
    expect(await gapBetweenTwoReads({ minIntervalMs: 0 })).toBeGreaterThanOrEqual(
      MIN_ALLOWED_INTERVAL_MS,
    );
    expect(await gapBetweenTwoReads({ minIntervalMs: -1000 })).toBeGreaterThanOrEqual(
      MIN_ALLOWED_INTERVAL_MS,
    );
  });

  it("spaces two reads by the floor when handed a value of the wrong shape", async () => {
    expect(await gapBetweenTwoReads({ minIntervalMs: Number.NaN })).toBeGreaterThanOrEqual(
      MIN_ALLOWED_INTERVAL_MS,
    );
    expect(await gapBetweenTwoReads({ minIntervalMs: "1" })).toBeGreaterThanOrEqual(
      MIN_ALLOWED_INTERVAL_MS,
    );
  });

  it("reports the pacing actually in force", () => {
    const client = new CookbookClient({
      logger: silentLogger,
      config: { minIntervalMs: 1 } as never,
    });
    expect(client.intervalMs).toBeGreaterThanOrEqual(MIN_ALLOWED_INTERVAL_MS);
  });

  it("keeps a caller's own interval when it is slower than the floor", async () => {
    expect(await gapBetweenTwoReads({ minIntervalMs: 3000 })).toBeGreaterThanOrEqual(3000);
  });
});

describe("the User-Agent always reaches a human", () => {
  it("keeps the project identifier when a caller names itself", () => {
    const client = new CookbookClient({
      logger: silentLogger,
      config: { userAgent: "SomebodyElse/9.9" } as never,
    });
    expect(client.userAgent).toContain("SomebodyElse/9.9");
    expect(client.userAgent).toContain(REPO_URL);
  });

  it("keeps the project identifier when a caller sends an empty one", () => {
    const client = new CookbookClient({
      logger: silentLogger,
      config: { userAgent: "   " } as never,
    });
    expect(client.userAgent).toContain(REPO_URL);
  });

  it("keeps the project identifier when a caller sends something that is not a string", () => {
    const client = new CookbookClient({
      logger: silentLogger,
      config: { userAgent: 42 } as never,
    });
    expect(client.userAgent).toContain(REPO_URL);
  });

  it("keeps it through loadConfig as well", () => {
    expect(loadConfig({ WB_USER_AGENT: "SomebodyElse/9.9" }).userAgent).toContain(REPO_URL);
  });
});

describe("the package publishes the lower layer on its own", () => {
  it("maps './client' to a file that exists", async () => {
    const pkg = JSON.parse(
      await import("node:fs").then((fs) =>
        fs.readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
      ),
    ) as { exports: Record<string, { import?: string } | string> };
    const entry = pkg.exports["./client"];
    const path = typeof entry === "string" ? entry : (entry?.import as string);
    expect(path).toBeTruthy();
    expect(existsSync(join(REPO_ROOT, path))).toBe(true);
  });

  it("holds the floor when the built entry point is the one imported", async () => {
    const built = join(REPO_ROOT, "dist", "wikibooks", "client.js");
    expect(existsSync(built)).toBe(true);
    const module = (await import(pathToFileURL(built).href)) as {
      CookbookClient: new (options: unknown) => { intervalMs: number };
    };
    const client = new module.CookbookClient({
      logger: silentLogger,
      config: { minIntervalMs: 1 },
    });
    expect(client.intervalMs).toBeGreaterThanOrEqual(500);
  });
});
