/**
 * What one GET does with each answer it can get back.
 *
 * The clock is fake and pinned, so a test that names a wait names an exact
 * number rather than a range a slow machine might miss.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookbookError } from "../../src/errors.js";
import { fetchJson, fetchText, parseRetryAfter } from "../../src/wikibooks/http.js";
import { RateLimiter } from "../../src/wikibooks/rateLimiter.js";
import {
  captureAsync,
  hangingFetch,
  jsonResponse,
  scriptedFetch,
  settle,
  silentLogger,
} from "./helpers.js";

const EPOCH = new Date("2026-01-01T00:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(EPOCH);
});

afterEach(() => {
  vi.useRealTimers();
});

function options(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return {
    url: "https://api.wikimedia.org/core/v1/wikibooks/en/page/Cookbook%3AX",
    userAgent: "test",
    timeoutMs: 5000,
    maxRetries: 3,
    limiter: new RateLimiter({ intervalMs: 1000 }),
    logger: silentLogger,
    fetchImpl,
    ...overrides,
  };
}

const AMPLE_MS = 120_000;

describe("parseRetryAfter", () => {
  it("reads a number of seconds", () => {
    expect(parseRetryAfter("30")).toBe(30_000);
  });

  it("reads a date as the distance from now", () => {
    expect(parseRetryAfter(new Date(EPOCH.getTime() + 45_000).toUTCString(), EPOCH.getTime())).toBe(
      45_000,
    );
  });

  it("returns null on anything else", () => {
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });
});

describe("fetchText", () => {
  it("returns the body of a clean answer", async () => {
    const { fetchImpl } = scriptedFetch([() => jsonResponse({ ok: true })]);
    const body = await settle(fetchText(options(fetchImpl)), AMPLE_MS);
    expect(JSON.parse(body)).toEqual({ ok: true });
  });

  it("calls a page that does not exist an absence, not a network failure", async () => {
    const { fetchImpl, count } = scriptedFetch([
      () =>
        jsonResponse(
          { errorKey: "rest-nonexistent-title", messageTranslations: { en: "no such page" } },
          { status: 404 },
        ),
    ]);

    const outcome = await captureAsync(() => settle(fetchText(options(fetchImpl)), AMPLE_MS));
    expect((outcome.error as CookbookError).code).toBe("not_found");
    expect((outcome.error as CookbookError).message).toBe("no such page");
    // A settled question is not asked again.
    expect(count()).toBe(1);
  });

  it("calls a refused request invalid input and repeats the gateway's reason", async () => {
    const { fetchImpl, count } = scriptedFetch([
      () =>
        jsonResponse(
          {
            errorKey: "outofrange",
            messageTranslations: {
              en: 'The value "101" for parameter "limit" must be between 1 and 100.',
            },
          },
          { status: 400 },
        ),
    ]);

    const outcome = await captureAsync(() => settle(fetchText(options(fetchImpl)), AMPLE_MS));
    expect((outcome.error as CookbookError).code).toBe("invalid_input");
    expect((outcome.error as CookbookError).message).toContain("between 1 and 100");
    expect(count()).toBe(1);
  });

  it("retries a busy gateway and returns the answer it finally gives", async () => {
    const { fetchImpl, count } = scriptedFetch([
      () => new Response("", { status: 503 }),
      () => jsonResponse({ pages: [] }),
    ]);

    const body = await settle(fetchText(options(fetchImpl)), AMPLE_MS);
    expect(JSON.parse(body)).toEqual({ pages: [] });
    expect(count()).toBe(2);
  });

  it("obeys a Retry-After it is given", async () => {
    const { fetchImpl, at } = scriptedFetch([
      () => new Response("", { status: 429, headers: { "retry-after": "7" } }),
      () => jsonResponse({ pages: [] }),
    ]);

    await settle(fetchText(options(fetchImpl)), AMPLE_MS);
    // The seven seconds asked for, which already covers the spacing this client
    // owes, so nothing is added on top of it.
    expect(at[1]! - at[0]!).toBe(7000);
  });

  it("reports a wait too long to sit through rather than sleeping it off", async () => {
    const { fetchImpl, count } = scriptedFetch([
      () => new Response("", { status: 429, headers: { "retry-after": "3600" } }),
    ]);

    const outcome = await captureAsync(() => settle(fetchText(options(fetchImpl)), AMPLE_MS));
    expect((outcome.error as CookbookError).code).toBe("rate_limited");
    expect((outcome.error as CookbookError).message).toContain("3600 seconds");
    expect(count()).toBe(1);
  });

  it("gives up on silence rather than holding the slot for every retry", async () => {
    const fetchImpl = hangingFetch();
    const outcome = await captureAsync(() => settle(fetchText(options(fetchImpl)), AMPLE_MS));
    expect((outcome.error as CookbookError).code).toBe("timeout");
  });

  it("reports an unreachable gateway as a network failure", async () => {
    const { fetchImpl } = scriptedFetch([
      () => {
        throw new Error("getaddrinfo ENOTFOUND");
      },
    ]);

    const outcome = await captureAsync(() =>
      settle(fetchText(options(fetchImpl, { maxRetries: 0 })), AMPLE_MS),
    );
    expect((outcome.error as CookbookError).code).toBe("network_error");
  });
});

describe("fetchJson", () => {
  it("separates an unreadable answer from an unreachable gateway", async () => {
    const { fetchImpl } = scriptedFetch([
      () => new Response("<html>maintenance</html>", { status: 200 }),
    ]);

    const outcome = await captureAsync(() => settle(fetchJson(options(fetchImpl)), AMPLE_MS));
    expect((outcome.error as CookbookError).code).toBe("parse_failure");
  });
});
