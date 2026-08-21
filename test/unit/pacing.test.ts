/**
 * The cache and the rate limiter, both driven by a fake clock pinned to a fixed
 * instant so nothing here depends on how fast the machine runs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Cache } from "../../src/wikibooks/cache.js";
import { RateLimiter } from "../../src/wikibooks/rateLimiter.js";
import { settlesAt } from "./helpers.js";

const EPOCH = new Date("2026-01-01T00:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(EPOCH);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Cache", () => {
  it("serves a value back until its lifetime is over", async () => {
    const cache = new Cache<string>(1000, 10);
    cache.set("a", "one");
    expect(cache.get("a")).toBe("one");

    await vi.advanceTimersByTimeAsync(999);
    expect(cache.get("a")).toBe("one");

    await vi.advanceTimersByTimeAsync(1);
    expect(cache.get("a")).toBeUndefined();
  });

  it("stores nothing when the lifetime is zero", () => {
    const cache = new Cache<string>(0, 10);
    cache.set("a", "one");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("drops the least recently used entry when it is full", () => {
    const cache = new Cache<string>(10_000, 2);
    cache.set("a", "one");
    cache.set("b", "two");
    // Reading "a" makes "b" the oldest.
    cache.get("a");
    cache.set("c", "three");

    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe("one");
    expect(cache.get("c")).toBe("three");
  });
});

describe("RateLimiter", () => {
  it("spaces requests by the interval", async () => {
    const limiter = new RateLimiter({ intervalMs: 1000 });

    await limiter.beforeRequest();
    const secondAt = settlesAt(limiter.beforeRequest());
    await vi.advanceTimersByTimeAsync(1000);

    expect(await secondAt).toBe(EPOCH.getTime() + 1000);
  });

  it("runs one task at a time", async () => {
    const limiter = new RateLimiter({ intervalMs: 1000 });
    const order: string[] = [];

    const first = limiter.schedule(async () => {
      order.push("first in");
      await new Promise((resolve) => setTimeout(resolve, 500));
      order.push("first out");
    });
    const second = limiter.schedule(async () => {
      order.push("second in");
    });

    await vi.advanceTimersByTimeAsync(500);
    await first;
    await second;

    expect(order).toEqual(["first in", "first out", "second in"]);
  });

  it("widens on push-back and narrows only after a run of clean answers", () => {
    const limiter = new RateLimiter({ intervalMs: 1000 });

    limiter.pushBack();
    expect(limiter.currentIntervalMs).toBe(2000);

    limiter.succeeded();
    limiter.succeeded();
    expect(limiter.currentIntervalMs).toBe(2000);

    limiter.succeeded();
    expect(limiter.currentIntervalMs).toBe(1000);
  });

  it("never widens past its ceiling", () => {
    const limiter = new RateLimiter({ intervalMs: 1000, maxIntervalMs: 4000 });
    for (let i = 0; i < 10; i += 1) {
      limiter.pushBack();
    }
    expect(limiter.currentIntervalMs).toBe(4000);
  });
});
