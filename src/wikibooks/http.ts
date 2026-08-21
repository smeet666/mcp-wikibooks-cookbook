/**
 * One GET, with a deadline and bounded retries.
 *
 * Two things separate a retry worth making from one that only adds load. A
 * refusal that carries a time to come back is obeyed rather than guessed at,
 * and an answer the gateway meant is never retried: asking again for a page
 * that does not exist wastes a request and delays the honest answer.
 */

import {
  invalidInput,
  networkError,
  notFound,
  parseFailure,
  rateLimited,
  timeout as timeoutError,
} from "../errors.js";
import type { Logger } from "../config.js";
import type { RateLimiter } from "./rateLimiter.js";

export interface FetchOptions {
  url: string;
  userAgent: string;
  timeoutMs: number;
  maxRetries: number;
  limiter: RateLimiter;
  logger: Logger;
  fetchImpl?: typeof fetch;
}

/** Statuses worth another attempt: the gateway is busy, not answering "no". */
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);
/** Statuses that mean the gateway is asking for room. */
const PUSH_BACK = new Set([429, 503]);

/**
 * The longest wait worth taking rather than reporting.
 *
 * A refusal may name any delay, and an hour is a legal answer. Sleeping through
 * it holds the one request slot this server has, so every other tool waits
 * behind a call whose caller has long since given up. Past this point the wait
 * is the answer, and the caller decides what to do with it.
 */
const LONGEST_WAIT_MS = 30_000;

/**
 * How many times a request that never answered is worth repeating.
 *
 * A route that did not respond within its budget is busy. Repeating the same
 * query adds load to what is already struggling, and each attempt holds the
 * slot for the full deadline again.
 */
const RETRIES_AFTER_SILENCE = 1;

/**
 * Read a Retry-After header, which is either a number of seconds or a date.
 * Returns null when it says neither, so the caller falls back to its own wait.
 */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) {
    return null;
  }
  return Math.max(0, at - now);
}

/** What a refusal from the gateway amounts to, and what it costs the pacing. */
type Refusal =
  | { kind: "refused"; error: Error; pushBack: boolean }
  | { kind: "again"; waitMs: number; pushBack: boolean };

/**
 * Read a status the gateway answered with, apart from the loop that retries.
 *
 * An abandoned body keeps its socket out of the pool until it is consumed or
 * cancelled, so a body this never reads is cancelled here. A request the
 * gateway read and would not run, and a page it says does not exist, are both
 * settled questions: calling either a network failure invites a retry of
 * something only the caller can fix.
 */
async function readRefusal(
  response: Response,
  url: string,
  attempt: number,
  maxRetries: number,
): Promise<Refusal> {
  if (PUSH_BACK.has(response.status)) {
    await response.body?.cancel().catch(() => undefined);
    const asked = parseRetryAfter(response.headers.get("retry-after"));

    if (asked !== null && asked > LONGEST_WAIT_MS) {
      return {
        kind: "refused",
        pushBack: true,
        error: rateLimited(
          `Wikimedia asked this client to wait ${Math.round(asked / 1000)} seconds (HTTP ${response.status}).`,
          { url, status: response.status },
        ),
      };
    }
    if (attempt >= maxRetries) {
      return {
        kind: "refused",
        pushBack: true,
        error: rateLimited(`Wikimedia asked this client to slow down (HTTP ${response.status}).`, {
          url,
          status: response.status,
        }),
      };
    }
    return { kind: "again", pushBack: true, waitMs: asked ?? backoffMs(attempt) };
  }

  if (RETRYABLE.has(response.status) && attempt < maxRetries) {
    await response.body?.cancel().catch(() => undefined);
    return { kind: "again", pushBack: false, waitMs: backoffMs(attempt) };
  }

  if (response.status === 400 || response.status === 422) {
    const detail = await readGatewayMessage(response);
    return {
      kind: "refused",
      pushBack: false,
      error: invalidInput(
        detail ?? "The Wikimedia gateway would not accept this request.",
        "Check the arguments: a limit out of range or an empty query is refused rather than answered.",
      ),
    };
  }

  if (response.status === 404 || response.status === 410) {
    const detail = await readGatewayMessage(response);
    return {
      kind: "refused",
      pushBack: false,
      error: notFound(detail ?? "The English Wikibooks holds no page at this address.", {
        url,
        status: response.status,
      }),
    };
  }

  return {
    kind: "refused",
    pushBack: false,
    error: networkError(`The Wikimedia gateway answered HTTP ${response.status}.`, {
      url,
      status: response.status,
    }),
  };
}

/**
 * What a thrown attempt amounts to, or the error it has become.
 *
 * An error this module raised on purpose already says what happened. Silence is
 * given fewer attempts than a refusal, since asking again costs both sides the
 * same wait.
 */
function readFailure(
  error: unknown,
  attempts: { url: string; attempt: number; maxRetries: number; timeoutMs: number },
): Error {
  const { url, attempt, maxRetries, timeoutMs } = attempts;

  if (error instanceof Error && error.name === "CookbookError") {
    throw error;
  }

  if (error instanceof Error && error.name === "AbortError") {
    if (attempt >= Math.min(maxRetries, RETRIES_AFTER_SILENCE)) {
      throw timeoutError(`No answer from the Wikimedia gateway within ${timeoutMs}ms.`, { url });
    }
    return error;
  }

  const failure = error instanceof Error ? error : new Error(String(error));
  if (attempt >= maxRetries) {
    throw networkError(`Could not reach the Wikimedia gateway: ${failure.message}`, { url });
  }
  return failure;
}

/** Growing wait with jitter, so several clients do not return in step. */
function backoffMs(attempt: number): number {
  const base = Math.min(8000, 400 * 2 ** attempt);
  return base + Math.floor(Math.random() * 250);
}

export async function fetchText(options: FetchOptions): Promise<string> {
  const { url, userAgent, timeoutMs, maxRetries, limiter, logger } = options;
  const doFetch = options.fetchImpl ?? fetch;

  let lastError: Error | null = null;
  /** Honoured before the next attempt rather than slept after the last one. */
  let askedWaitMs = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (askedWaitMs > 0) {
      logger.debug(`waiting ${askedWaitMs}ms, as asked`);
      await new Promise((resolve) => setTimeout(resolve, askedWaitMs));
      askedWaitMs = 0;
    }
    await limiter.beforeRequest();

    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), timeoutMs);

    try {
      logger.debug(`GET ${url}`);
      const response = await doFetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "user-agent": userAgent, accept: "application/json" },
      });

      if (response.ok) {
        limiter.succeeded();
        return await response.text();
      }

      const verdict = await readRefusal(response, url, attempt, maxRetries);
      if (verdict.pushBack) {
        limiter.pushBack();
      }
      if (verdict.kind === "refused") {
        throw verdict.error;
      }
      askedWaitMs = verdict.waitMs;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      clearTimeout(deadline);

      lastError = readFailure(error, { url, attempt, maxRetries, timeoutMs });
      askedWaitMs = backoffMs(attempt);
    } finally {
      clearTimeout(deadline);
    }
  }

  throw networkError(
    `Could not reach the Wikimedia gateway: ${lastError?.message ?? "no attempt was made"}`,
    { url },
  );
}

/**
 * The gateway explains its refusals in the body, in a shape of its own. Reading
 * it turns "HTTP 400" into the sentence a caller can act on. A body that says
 * nothing useful yields null and the caller keeps its own wording.
 */
async function readGatewayMessage(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") {
      return null;
    }
    const record = payload as Record<string, unknown>;
    const translations = record.messageTranslations;
    if (translations && typeof translations === "object") {
      const english = (translations as Record<string, unknown>).en;
      if (typeof english === "string" && english.trim() !== "") {
        return english;
      }
    }
    if (typeof record.errorKey === "string" && record.errorKey.trim() !== "") {
      return `The Wikimedia gateway refused this request (${record.errorKey}).`;
    }
    return null;
  } catch {
    return null;
  }
}

/** Fetch and parse JSON, keeping the two failures apart. */
export async function fetchJson<T = unknown>(options: FetchOptions): Promise<T> {
  const body = await fetchText(options);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw parseFailure("The Wikimedia gateway answered with something that is not JSON.", {
      url: options.url,
    });
  }
}
