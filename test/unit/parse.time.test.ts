/**
 * The time a recipe box states, and what a total is allowed to claim.
 *
 * The box holds one field, and a page that wants to say more writes several
 * durations into it on separate lines, each with the name of the phase it
 * covers: a preparation, a fermentation, a marinade, a rest, a cooking. Joined
 * without the line break, "1 hour" and "Cooking" become one word and stop being
 * a duration at all.
 *
 * Each phase is read on its own, and `totalMinutes` states a total only where
 * the page states one. Waiting for a batter to sour is not cooking, and adding
 * the phases would answer with a figure the page never published.
 */

import { describe, expect, it } from "vitest";
import { readTimePhases, toRecipePage } from "../../src/wikibooks/parse.js";
import { fixture } from "./helpers.js";

const URL = "https://api.wikimedia.org/core/v1/wikibooks/en/page/x";

describe("a time written as phases on separate lines", () => {
  const page = toRecipePage(fixture("page-phased-time"), URL);

  it("keeps the two phases apart", () => {
    expect(page.timePhases).toEqual([
      { label: "Prep", text: "1 hour", minutes: 60, minutesMax: null },
      { label: "Cooking", text: "10 minutes", minutes: 10, minutesMax: null },
    ]);
  });

  it("puts each phase in the field that names it", () => {
    expect(page.prepMinutes).toBe(60);
    expect(page.cookMinutes).toBe(10);
  });

  it("claims no total, because the page states none", () => {
    expect(page.totalMinutes).toBeNull();
  });

  it("keeps the words of the box, with the phases readable apart", () => {
    expect(page.timeText).toBe("Prep: 1 hour Cooking: 10 minutes");
  });
});

describe("a time whose longest phase is a wait", () => {
  const page = toRecipePage(fixture("page-fermented-time"), URL);

  it("reads both ends of the range the page gives the wait", () => {
    expect(page.timePhases).toEqual([
      { label: "Fermentation", text: "12–24 hours", minutes: 720, minutesMax: 1440 },
      { label: "Cooking", text: "5 minutes per loaf", minutes: 5, minutesMax: null },
    ]);
  });

  it("never answers five minutes for a batter that sours for a day", () => {
    expect(page.totalMinutes).not.toBe(5);
    expect(page.totalMinutes).toBeNull();
  });

  it("names no preparation, because the page names none", () => {
    expect(page.prepMinutes).toBeNull();
    expect(page.cookMinutes).toBe(5);
  });
});

describe("a time given as one duration", () => {
  const page = toRecipePage(fixture("page-recipe"), URL);

  it("states it as the total, since the page states nothing else", () => {
    expect(page.totalMinutes).toBe(70);
    expect(page.timePhases).toEqual([
      { label: null, text: "1 hour 10 minutes", minutes: 70, minutesMax: null },
    ]);
  });
});

describe("readTimePhases", () => {
  it("splits on every spelling of a line break", () => {
    expect(readTimePhases("Prep: 20 minutes<br>Rest: 2 hours").map((phase) => phase.label)).toEqual(
      ["Prep", "Rest"],
    );
    expect(readTimePhases("Prep: 20 minutes<br />Rest: 2 hours")).toHaveLength(2);
    expect(readTimePhases("Prep: 20 minutes</br>Rest: 2 hours")).toHaveLength(2);
  });

  it("takes the total the page states rather than adding the phases up", () => {
    const phases = readTimePhases("Total: 45 minutes<br>Prep: 20 minutes<br>Cooking: 25 minutes");
    expect(phases.map((phase) => phase.label)).toEqual(["Total", "Prep", "Cooking"]);
  });

  it("reads a phase the page leaves unlabelled", () => {
    expect(readTimePhases("30 minutes")).toEqual([
      { label: null, text: "30 minutes", minutes: 30, minutesMax: null },
    ]);
  });

  it("keeps a phase whose wording is no duration, without a figure", () => {
    expect(readTimePhases("Resting: overnight")).toEqual([
      { label: "Resting", text: "overnight", minutes: null, minutesMax: null },
    ]);
  });

  it("reads nothing out of nothing", () => {
    expect(readTimePhases(null)).toEqual([]);
    expect(readTimePhases("  ")).toEqual([]);
  });
});

describe("a page that states a total beside its phases", () => {
  it("answers with the total the page published", () => {
    const payload = {
      key: "Cookbook:Stated_Total",
      title: "Cookbook:Stated Total",
      source: [
        "{{recipesummary|category=Bread recipes|servings=4",
        "|time=Total: 45 minutes<br>Prep: 20 minutes<br>Cooking: 25 minutes}}",
        "== Ingredients ==",
        "* 250 g flour",
      ].join("\n"),
    };
    const page = toRecipePage(payload, URL);
    expect(page.totalMinutes).toBe(45);
    expect(page.prepMinutes).toBe(20);
    expect(page.cookMinutes).toBe(25);
  });
});
