/**
 * Every address this server calls.
 *
 * All of them live under the Wikimedia developer gateway, which is the route
 * published for programs. The wiki's own `/w/` paths are disallowed to robots
 * on en.wikibooks.org and are never called from here, whatever a workaround
 * would make possible.
 */

export const API_BASE = "https://api.wikimedia.org/core/v1/wikibooks/en";
export const SITE_BASE = "https://en.wikibooks.org/wiki";

/** Recipes and every page that supports them live under this namespace. */
export const COOKBOOK_PREFIX = "Cookbook:";

/** The gateway refuses a limit above this, so asking for more is a failed call. */
export const MAX_SEARCH_LIMIT = 100;

/**
 * The address of a page as a reader sees it.
 *
 * Built from the key rather than the title: the key already carries the
 * underscores and the capitalisation the wiki resolves, so it survives a title
 * whose display form differs from its address.
 */
export function pageUrl(key: string): string {
  return `${SITE_BASE}/${encodeURI(key.replace(/ /g, "_"))}`;
}

/**
 * Full-text search, which reads the body of a page as well as its title.
 *
 * The query is prefixed with the namespace so the ranking is pulled towards
 * the Cookbook. That is a nudge and not a filter: pages from elsewhere still
 * come back, and the client drops them by key.
 */
export function searchPageUrl(query: string, limit: number): string {
  const params = new URLSearchParams({
    q: `${COOKBOOK_PREFIX} ${query}`.trim(),
    limit: String(clampLimit(limit)),
  });
  return `${API_BASE}/search/page?${params.toString()}`;
}

/** Title search, which matches the name of a page and ignores its body. */
export function searchTitleUrl(query: string, limit: number): string {
  const params = new URLSearchParams({
    q: query.startsWith(COOKBOOK_PREFIX) ? query : `${COOKBOOK_PREFIX}${query}`,
    limit: String(clampLimit(limit)),
  });
  return `${API_BASE}/search/title?${params.toString()}`;
}

/** One page, returned as its wikitext source. */
export function pageSourceUrl(key: string): string {
  return `${API_BASE}/page/${encodeURIComponent(normaliseKey(key))}`;
}

/**
 * Put a page reference into the form the gateway resolves.
 *
 * A caller may hand over a title with spaces, a key with underscores, or a
 * bare recipe name. The namespace is added when it is missing, so a request
 * for "Spaghetti alla Carbonara" reaches the Cookbook rather than the root of
 * the wiki, where a page of that name does not exist.
 */
export function normaliseKey(reference: string): string {
  const trimmed = reference.trim().replace(/[\s_]+/g, " ");

  // Spelled with the namespace already: normalise its case and spacing.
  if (/^cookbook\s*:/i.test(trimmed)) {
    const rest = trimmed.slice(trimmed.indexOf(":") + 1).trimStart();
    return `${COOKBOOK_PREFIX}${rest}`.replace(/ /g, "_");
  }

  // Spelled with some other namespace, or with a book's path: left alone, since
  // adding "Cookbook:" would name a page that does not exist.
  if (/^[A-Za-z][A-Za-z ]{1,20}:/.test(trimmed) || trimmed.includes("/")) {
    return trimmed.replace(/ /g, "_");
  }

  return `${COOKBOOK_PREFIX}${trimmed}`.replace(/ /g, "_");
}

/** Whether a key names a page inside the Cookbook. */
export function isCookbookKey(key: string): boolean {
  return key.startsWith(COOKBOOK_PREFIX);
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 10;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.round(limit)));
}
