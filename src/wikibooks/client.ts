/**
 * The one place that talks to the Wikimedia gateway.
 *
 * It holds a single rate limiter and a single cache, so pacing applies to the
 * server as a whole rather than to whichever tool happens to be running. It
 * imports nothing from the MCP layer and is published on its own, so the same
 * code serves a plain script.
 *
 * Every read fetches, parses and only then stores: a response nobody could
 * parse must not be served back for the rest of the cache's lifetime.
 */

import { invalidInput } from "../errors.js";
import type { Config, Logger } from "../config.js";
import { MIN_ALLOWED_INTERVAL_MS, createLogger, loadConfig } from "../config.js";
import { REPO_URL } from "../version.js";
import type { PageSummary, RecipePage } from "../types.js";
import { Cache } from "./cache.js";
import { fetchJson } from "./http.js";
import { parseFailure } from "../errors.js";
import { toPageDocument, toSearchResults } from "./parse.js";
import { RateLimiter } from "./rateLimiter.js";
import {
  MAX_SEARCH_LIMIT,
  normaliseKey,
  pageSourceUrl,
  searchPageUrl,
  searchTitleUrl,
} from "./urls.js";

/**
 * How many redirect pages are walked before a read gives up.
 *
 * A redirect pointing at a redirect is an editing accident the wiki fixes in
 * time, and a handful of hops covers every chain worth following. The ceiling
 * is what keeps a pair of pages pointing at each other from spending a
 * caller's whole request on the same two addresses.
 */
const MAX_REDIRECT_HOPS = 4;

export interface ClientOptions {
  config?: Partial<Config>;
  logger?: Logger;
  fetchImpl?: typeof fetch;
}

/** Every read reports whether it went out, so a caller can say what it knows. */
export interface Read<T> {
  data: T;
  cached: boolean;
  /** Rows the gateway sent that could not be read. */
  skipped?: number;
}

export interface SearchResults {
  results: PageSummary[];
  /**
   * Rows the gateway ranked that belong to another part of the wiki and were
   * dropped. A short list with a high count here means the query was answered,
   * from outside the Cookbook.
   */
  outsideCookbook: number;
  /** Rows the gateway was asked for, which caps what could come back. */
  asked: number;
}

/** Which index a search reads. */
export type SearchMode =
  /** Titles only, which is exact and misses a dish named differently. */
  | "title"
  /** The whole page, which finds a dish by an ingredient inside it. */
  | "text";

/**
 * The two things this server owes Wikimedia, applied to whatever it is handed.
 *
 * A configuration object assembled by a caller has not been through
 * `loadConfig`, so it can carry a missing value, a value of the wrong shape, or
 * a User-Agent that names somebody else. Requests stay spaced, and the address
 * Wikimedia would use to reach a human stays in the User-Agent, whichever of
 * those arrives.
 */
function withGuarantees(config: Config): Config {
  const defaults = loadConfig({});

  /** A setting that is absent or unreadable falls back rather than propagating. */
  const number = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const claimed = typeof config.userAgent === "string" ? config.userAgent.trim() : "";
  const identifier = defaults.userAgent;

  return {
    ...config,
    // A caller may say who they are. Appending rather than replacing means
    // Wikimedia can always tell which software is calling, and reach someone.
    userAgent:
      claimed === "" || claimed.includes(REPO_URL) ? identifier : `${claimed} ${identifier}`,
    minIntervalMs: Math.max(
      MIN_ALLOWED_INTERVAL_MS,
      number(config.minIntervalMs, defaults.minIntervalMs),
    ),
    timeoutMs: number(config.timeoutMs, defaults.timeoutMs),
    maxRetries: number(config.maxRetries, defaults.maxRetries),
    cacheTtlMs: number(config.cacheTtlMs, defaults.cacheTtlMs),
    cacheMaxEntries: number(config.cacheMaxEntries, defaults.cacheMaxEntries),
  };
}

export class CookbookClient {
  private readonly config: Config;
  private readonly logger: Logger;
  private readonly limiter: RateLimiter;
  private readonly cache: Cache<unknown>;
  private readonly fetchImpl: typeof fetch | undefined;

  constructor(options: ClientOptions = {}) {
    const base = { ...loadConfig(), ...options.config };
    this.config = withGuarantees(base);
    this.logger = options.logger ?? createLogger(this.config.logLevel);
    this.limiter = new RateLimiter({ intervalMs: this.config.minIntervalMs });
    this.cache = new Cache(this.config.cacheTtlMs, this.config.cacheMaxEntries);
    this.fetchImpl = options.fetchImpl;
  }

  /** The pacing in force, which widens when the gateway pushes back. */
  get intervalMs(): number {
    return this.limiter.currentIntervalMs;
  }

  /** What Wikimedia sees this client call itself. */
  get userAgent(): string {
    return this.config.userAgent;
  }

  private async read<T>(
    url: string,
    parse: (payload: unknown, onSkip: (n: number) => void) => T,
  ): Promise<Read<T>> {
    const cached = this.cache.get(url) as T | undefined;
    if (cached !== undefined) {
      this.logger.debug(`cache hit ${url}`);
      return { data: cached, cached: true };
    }

    let skipped = 0;
    const payload = await this.limiter.schedule(() =>
      fetchJson({
        url,
        userAgent: this.config.userAgent,
        timeoutMs: this.config.timeoutMs,
        maxRetries: this.config.maxRetries,
        limiter: this.limiter,
        logger: this.logger,
        ...(this.fetchImpl ? { fetchImpl: this.fetchImpl } : {}),
      }),
    );

    const data = parse(payload, (n) => {
      skipped += n;
      this.logger.warn(`skipped ${n} unreadable row(s) from ${url}`);
    });
    this.cache.set(url, data);
    return skipped > 0 ? { data, cached: false, skipped } : { data, cached: false };
  }

  /**
   * Search the Cookbook.
   *
   * The gateway ranks across the whole wiki, and rows from elsewhere are
   * dropped after the fact, so more rows are asked for than the caller wants.
   * Asking for exactly `limit` would let a single chess page take a slot a
   * recipe should have had.
   */
  async search(
    query: string,
    limit: number,
    mode: SearchMode = "text",
  ): Promise<Read<SearchResults>> {
    const trimmed = query.trim();
    if (trimmed === "") {
      return Promise.reject(
        invalidInput("A search needs something to look for.", "Name a dish or an ingredient."),
      );
    }

    const asked = Math.min(MAX_SEARCH_LIMIT, Math.max(limit, limit * 3));
    const url = mode === "title" ? searchTitleUrl(trimmed, asked) : searchPageUrl(trimmed, asked);

    const read = await this.read(url, (payload, onSkip) => toSearchResults(payload, onSkip));
    return {
      ...read,
      data: {
        results: read.data.results.slice(0, limit),
        outsideCookbook: read.data.outsideCookbook,
        asked,
      },
    };
  }

  /**
   * Read one page as wikitext and turn it into a recipe.
   *
   * A page that redirects carries a pointer and no recipe, so the pointer is
   * followed to the page a reader visiting that address would land on. Every
   * address walked on the way is reported, because the recipe returned is not
   * the one the caller named.
   */
  async getRecipe(reference: string): Promise<Read<RecipePage>> {
    const trimmed = reference.trim();
    if (trimmed === "") throw invalidInput("A page name or key is required.");

    const walked: string[] = [];
    const visited = new Set<string>([normaliseKey(trimmed)]);
    let target = trimmed;
    let cached = true;

    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop += 1) {
      const url = pageSourceUrl(target);
      const read = await this.read(url, (payload) => toPageDocument(payload, url));
      cached = cached && read.cached;

      if (read.data.kind === "recipe") {
        const data = { ...read.data.page, redirectedFrom: walked };
        return read.skipped === undefined
          ? { data, cached }
          : { data, cached, skipped: read.skipped };
      }

      walked.push(read.data.key);
      target = read.data.target;
      const next = normaliseKey(target);
      if (visited.has(next)) {
        throw parseFailure(
          `${read.data.key} redirects to ${target}, which leads back to a page already read, so no recipe page is reachable from here. The addresses walked were ${walked.join(" → ")}.`,
          { url },
        );
      }
      visited.add(next);
    }

    throw parseFailure(
      // The count is read off the addresses rather than off the ceiling, so the
      // two halves of the sentence can never state different numbers.
      `The redirects were followed ${walked.length} times without reaching a recipe, stopping at ${target}. The addresses walked were ${walked.join(" → ")}.`,
      { url: pageSourceUrl(target) },
    );
  }
}
