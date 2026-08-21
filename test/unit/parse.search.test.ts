import { describe, expect, it } from "vitest";
import type { CookbookError } from "../../src/errors.js";
import { cleanExcerpt, toSearchResults } from "../../src/wikibooks/parse.js";
import { capture, fixture, skipCounter } from "./helpers.js";

describe("cleanExcerpt", () => {
  it("removes the highlight markup the search wraps a match in", () => {
    expect(cleanExcerpt('a dish of <span class="searchmatch">salt</span> and oil')).toBe(
      "a dish of salt and oil",
    );
  });

  it("decodes the entities the search escapes", () => {
    expect(cleanExcerpt("charcoal burners&#039; &quot;spaghetti&quot; &amp; eggs")).toBe(
      'charcoal burners\' "spaghetti" & eggs',
    );
  });

  it("returns null rather than an empty string", () => {
    expect(cleanExcerpt("   ")).toBeNull();
    expect(cleanExcerpt(null)).toBeNull();
  });
});

describe("toSearchResults", () => {
  it("keeps the Cookbook and counts what belonged to another book", () => {
    const skips = skipCounter();
    const { results, outsideCookbook } = toSearchResults(fixture("search-recipes"), skips.onSkip);

    expect(results.map((row) => row.key)).toEqual([
      "Cookbook:Salt_Flat_Noodles",
      "Cookbook:Orchard_Butter",
    ]);
    expect(outsideCookbook).toBe(1);
  });

  it("drops a row with no key and counts it as unreadable", () => {
    const skips = skipCounter();
    toSearchResults(fixture("search-recipes"), skips.onSkip);
    expect(skips.total()).toBe(1);
  });

  it("keeps a row that came back without a description or a thumbnail as null", () => {
    const skips = skipCounter();
    const { results } = toSearchResults(fixture("search-recipes"), skips.onSkip);
    const butter = results.find((row) => row.key === "Cookbook:Orchard_Butter")!;
    expect(butter.description).toBeNull();
    expect(butter.imageUrl).toBeNull();
  });

  it("makes a protocol-relative thumbnail address absolute", () => {
    const skips = skipCounter();
    const { results } = toSearchResults(fixture("search-recipes"), skips.onSkip);
    expect(results[0]!.imageUrl).toBe(
      "https://upload.example.invalid/thumb/60px-salt-flat-noodles.jpg",
    );
  });

  it("builds an address a reader can open", () => {
    const skips = skipCounter();
    const { results } = toSearchResults(fixture("search-recipes"), skips.onSkip);
    expect(results[0]!.sourceUrl).toBe("https://en.wikibooks.org/wiki/Cookbook:Salt_Flat_Noodles");
  });

  it("returns an empty list for a search that matched nothing", () => {
    const skips = skipCounter();
    const { results, outsideCookbook } = toSearchResults(fixture("search-empty"), skips.onSkip);
    expect(results).toEqual([]);
    expect(outsideCookbook).toBe(0);
    expect(skips.total()).toBe(0);
  });

  it("calls an answer with no rows array unreadable rather than empty", () => {
    const skips = skipCounter();
    const outcome = capture(() => toSearchResults(fixture("search-no-pages"), skips.onSkip));
    expect(outcome.threw).toBe(true);
    expect((outcome.error as CookbookError).code).toBe("parse_failure");
  });
});
