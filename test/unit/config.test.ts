import { describe, expect, it } from "vitest";
import { DEFAULT_USER_AGENT, MIN_ALLOWED_INTERVAL_MS, loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  it("defaults to a spacing of one second", () => {
    const config = loadConfig({});
    expect(config.minIntervalMs).toBe(1000);
    expect(config.userAgent).toBe(DEFAULT_USER_AGENT);
    expect(config.logLevel).toBe("error");
  });

  it("keeps the contact address when a caller names itself", () => {
    const config = loadConfig({ WB_USER_AGENT: "kitchen-bot/2" });
    expect(config.userAgent.startsWith("kitchen-bot/2 ")).toBe(true);
    expect(config.userAgent.endsWith(DEFAULT_USER_AGENT)).toBe(true);
  });

  it("refuses a spacing under the floor and keeps the default", () => {
    const config = loadConfig({ WB_MIN_INTERVAL_MS: String(MIN_ALLOWED_INTERVAL_MS - 1) });
    expect(config.minIntervalMs).toBe(1000);
  });

  it("accepts a spacing at the floor", () => {
    const config = loadConfig({ WB_MIN_INTERVAL_MS: String(MIN_ALLOWED_INTERVAL_MS) });
    expect(config.minIntervalMs).toBe(MIN_ALLOWED_INTERVAL_MS);
  });

  it("falls back rather than stopping when a value cannot be read", () => {
    const config = loadConfig({ WB_TIMEOUT_MS: "soon", WB_MAX_RETRIES: "2" });
    expect(config.timeoutMs).toBe(20_000);
    expect(config.maxRetries).toBe(2);
  });

  it("falls back on a log level it does not know", () => {
    expect(loadConfig({ WB_LOG_LEVEL: "loud" }).logLevel).toBe("error");
    expect(loadConfig({ WB_LOG_LEVEL: "debug" }).logLevel).toBe("debug");
  });
});
