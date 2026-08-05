/** What the parsers produce, independent of how any tool renders it. */

/** A row from a search, carrying what it takes to pick one page out of many. */
export interface PageSummary {
  /** The page key, which get_recipe takes back. */
  key: string;
  title: string;
  /** The short gloss the wiki keeps for a page, when it keeps one. */
  description: string | null;
  /** The matching passage, with the search's own highlight markup removed. */
  excerpt: string | null;
  /** A thumbnail the search offered, when it offered one. */
  imageUrl: string | null;
  /** Address of the page as a reader sees it. */
  sourceUrl: string;
}

/** The nutrition panel a page may carry, repeated exactly as published. */
export interface NutritionFacts {
  servingSize: string | null;
  servings: string | null;
  calories: string | null;
  caloriesFromFat: string | null;
  totalFat: string | null;
  saturatedFat: string | null;
  cholesterol: string | null;
  sodium: string | null;
  carbohydrates: string | null;
  fiber: string | null;
  sugars: string | null;
  protein: string | null;
  vitaminA: string | null;
  vitaminC: string | null;
  calcium: string | null;
  iron: string | null;
}

export interface RecipePage {
  key: string;
  title: string;
  sourceUrl: string;
  /** Terms the wiki publishes the page under. */
  license: { title: string; url: string } | null;
  /** When the page was last edited, ISO 8601, or null when the gateway said none. */
  revisedAt: string | null;

  /** The opening prose, flattened, before the first heading. */
  description: string | null;
  /** The heading the recipe box names, such as "Pasta recipes". */
  category: string | null;
  /** How many servings the box states, when it states a number. */
  servings: number | null;
  /** The yield exactly as published, such as "24 balls" or "6". */
  yieldText: string | null;
  /** The word the yield counts, such as "balls". Null when it counts servings. */
  yieldUnit: string | null;
  /** The time the box states, as published. */
  timeText: string | null;
  /** That time in minutes, when it could be read as one. */
  totalMinutes: number | null;
  /** The box's own difficulty figure, on the scale the wiki uses. */
  difficulty: number | null;
  /** The difficulty scale's ceiling, so the figure is never read bare. */
  difficultyMax: number;
  /** Energy per serving as the box states it, such as "207Calories/866 kJ". */
  energy: string | null;

  ingredients: string[];
  equipment: string[];
  steps: string[];
  /** Notes, tips and variations the page publishes under its own heading. */
  tips: string[];
  nutrition: NutritionFacts | null;
  categories: string[];
  /** Headings the page carries, so a caller can see what was not returned. */
  sectionTitles: string[];
}
