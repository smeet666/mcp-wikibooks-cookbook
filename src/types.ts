/** What the parsers produce, independent of how any tool renders it. */

/** One duration a recipe box states, with the phase of the dish it covers. */
export interface TimePhase {
  /** The phase as the page names it, such as "Prep". Null when it names none. */
  label: string | null;
  /** The duration in the page's own wording. */
  text: string;
  /** That duration in minutes, or the lower bound of a range. */
  minutes: number | null;
  /** The upper bound where the page gives a range, null where it gives one figure. */
  minutesMax: number | null;
}

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
  /**
   * The redirect pages walked to reach this one, in the order they were read.
   * Empty when the page was reached directly.
   */
  redirectedFrom: string[];

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
  /**
   * The durations the box states, one per phase of the dish. A box giving a
   * single duration states one unlabelled phase.
   */
  timePhases: TimePhase[];
  /** The phase labelled as preparation, in minutes, where the box labels one. */
  prepMinutes: number | null;
  /** The phase labelled as cooking, in minutes, where the box labels one. */
  cookMinutes: number | null;
  /**
   * The whole dish in minutes, stated only where the page states a total: a
   * single duration, or a phase the page itself calls the total. Phases are
   * never added, because a fermentation and a rest are not cooking time.
   */
  totalMinutes: number | null;
  /** The box's own difficulty figure, on the scale the wiki uses. */
  difficulty: number | null;
  /** The difficulty scale's ceiling, so the figure is never read bare. */
  difficultyMax: number;
  /** Energy per serving as the box states it, such as "207Calories/866 kJ". */
  energy: string | null;

  /**
   * Whether the page cooks something, rather than pointing at pages that do.
   *
   * Recipes and the book's own chapter indexes share a namespace and write the
   * same headings over their lists. A recipe box, the banner a recipe carries
   * or a procedure with steps is what separates the two.
   */
  readsAsRecipe: boolean;
  /**
   * Headings naming a part of a recipe that stands beside one already read,
   * which is what a page carrying two recipes looks like. Only the first of
   * each part is returned, and these name what was left.
   */
  furtherSections: string[];

  ingredients: string[];
  /**
   * Ingredient lines the page writes that came back empty, everything on them
   * being markup this parser renders as nothing.
   */
  unreadableIngredients: number;
  /**
   * The sub-heading each ingredient sits under, such as "Glaze", null where the
   * page files it under none. One entry per line of `ingredients`, in the same
   * order: a recipe can call for the same quantity in two of its parts, and the
   * two lines are told apart by what they are for.
   */
  ingredientGroups: (string | null)[];
  /**
   * The alternative list each ingredient belongs to, such as "Variation II",
   * null where the line belongs to the recipe itself. One entry per line of
   * `ingredients`, in the same order. Lines carrying different alternatives
   * replace one another and are never used together.
   */
  ingredientVariants: (string | null)[];
  equipment: string[];
  steps: string[];
  /** Notes, tips and variations the page publishes under its own heading. */
  tips: string[];
  nutrition: NutritionFacts | null;
  categories: string[];
  /** Headings the page carries, so a caller can see what was not returned. */
  sectionTitles: string[];
}
