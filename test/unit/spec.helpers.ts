/**
 * Scaffolding for the independent contract suite.
 *
 * Nothing here reads the modules under test. Unit conversion is restated from
 * the definitions of the units themselves, so an assertion about "the same
 * quantity in a smaller unit" is checked against arithmetic this file owns.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = join(HERE, "..", "..");

export function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(REPO_ROOT, "test", "fixtures", `${name}.json`), "utf8"));
}

export interface ScaledLine {
  text: string;
  original: string;
  scaling: "scaled" | "rounded" | "unscaled";
  amount: number | null;
  amount_max: number | null;
  unit: string | null;
  note?: string;
}

/** Grams per unit of mass, millilitres per unit of volume. */
const MASS: Record<string, number> = {
  mg: 0.001,
  milligram: 0.001,
  milligrams: 0.001,
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.349523125,
  ounce: 28.349523125,
  ounces: 28.349523125,
  lb: 453.59237,
  lbs: 453.59237,
  pound: 453.59237,
  pounds: 453.59237,
};

const VOLUME: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  tsp: 4.92892159375,
  teaspoon: 4.92892159375,
  teaspoons: 4.92892159375,
  tbsp: 14.78676478125,
  tablespoon: 14.78676478125,
  tablespoons: 14.78676478125,
  cup: 236.5882365,
  cups: 236.5882365,
};

export type Dimension = "mass" | "volume" | "count";

export function dimensionOf(unit: string | null): Dimension {
  if (unit === null) return "count";
  const key = unit.trim().toLowerCase();
  if (key in MASS) return "mass";
  if (key in VOLUME) return "volume";
  return "count";
}

/**
 * A quantity expressed in the base of its dimension, so 2 kg and 2000 g compare
 * equal and a demotion to a smaller unit is not mistaken for a change of value.
 */
export function canonical(amount: number, unit: string | null): number {
  if (unit === null) return amount;
  const key = unit.trim().toLowerCase();
  if (key in MASS) return amount * (MASS[key] as number);
  if (key in VOLUME) return amount * (VOLUME[key] as number);
  return amount;
}

/** True when the unit is one this file can convert, so a check is meaningful. */
export function known(unit: string | null): boolean {
  if (unit === null) return true;
  const key = unit.trim().toLowerCase();
  return key in MASS || key in VOLUME;
}

export const EXACT = 1e-9;

/** Every number a line reads as, so an assertion can look at the prose. */
export function numbersIn(text: string): number[] {
  return (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map((raw) => Number(raw.replace(",", ".")));
}

export function structuredOf(result: {
  structuredContent?: Record<string, unknown>;
}): Record<string, unknown> {
  expect(
    result.structuredContent,
    "a successful tool result carries a structured payload",
  ).toBeDefined();
  return result.structuredContent as Record<string, unknown>;
}

export function textOf(result: { content: Array<{ type: "text"; text: string }> }): string {
  return result.content.map((block) => block.text).join("\n");
}

/** A fetch that answers from the fixture corpus and records what it was asked. */
export function gatewayFetch(answers: { search?: unknown; page?: unknown; status?: number }): {
  fetchImpl: typeof fetch;
  urls: string[];
} {
  const urls: string[] = [];
  const fetchImpl = (async (input: unknown) => {
    const url = String(input);
    urls.push(url);
    const body = url.includes("/search/") ? answers.search : answers.page;
    return new Response(JSON.stringify(body ?? {}), {
      status: answers.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, urls };
}
