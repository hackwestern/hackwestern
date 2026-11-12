import { focusRing } from "~/components/judging/shared/judge-ui";

/** Every criterion is scored on the same slider, from 0 to 100. */
export const RUBRIC_MIN = 0;
export const RUBRIC_MAX = 100;

export interface RubricCriterion {
  id: string;
  name: string;
  /** One short line shown to judges under the name. */
  description: string;
  /** Relative importance. Ignored unless the rubric is weighted. */
  weight: number;
  /**
   * Optional extra credit. Judges may leave it unrated, and it only counts
   * toward the score when it raises the average.
   */
  bonus?: boolean;
}

export interface Rubric {
  title: string;
  /** When false, every criterion counts equally and weights are ignored. */
  weighted: boolean;
  criteria: RubricCriterion[];
}

export type Ratings = Record<string, number | undefined>;

/** The default rubric: four required criteria plus an optional bonus, equal weight. */
export const DEFAULT_RUBRIC: Rubric = {
  title: "General judging rubric",
  weighted: false,
  criteria: [
    {
      id: "creativity",
      name: "Creativity",
      description: "How creative is this project?",
      weight: 1,
    },
    {
      id: "technical",
      name: "Technical Difficulty",
      description:
        "Simpler and less technical projects (no-code tools and mockups allowed!) will not be penalized.",
      weight: 1,
    },
    {
      id: "learning",
      name: "Demonstrates Learning",
      description:
        "Has your team demonstrated growth or a journey to learn a new skill?",
      weight: 1,
    },
    {
      id: "usefulness",
      name: "Usefulness",
      description:
        "Would this be something that could be used in the real world? Does this solve the problem it's trying to solve?",
      weight: 1,
    },
    {
      id: "polish",
      name: "Polish",
      description:
        "How is the presentation of the project? Is there a video? Does the team present the project well?",
      weight: 1,
      bonus: true,
    },
  ],
};

/** How many criteria a judge has to rate before submitting. Bonus ones are optional. */
export const requiredCount = (rubric: Rubric) =>
  rubric.criteria.filter((c) => !c.bonus).length;

/** The toggle only appears when at least one criterion has a description. */
export const hasGuide = (rubric: Rubric) =>
  rubric.criteria.some((c) => c.description.trim());

export const effectiveWeight = (rubric: Rubric, c: RubricCriterion) =>
  rubric.weighted && c.weight > 0 ? c.weight : 1;

/** A rating only counts while it is on the 0–100 slider. */
export const ratingOf = (c: RubricCriterion, ratings: Ratings) => {
  const r = ratings[c.id];
  return r !== undefined && r >= RUBRIC_MIN && r <= RUBRIC_MAX ? r : undefined;
};

/**
 * Turns ratings into the 0-100 score the backend stores: the weighted average
 * of the required criteria (a plain average when the rubric isn't weighted).
 * A bonus criterion that was rated is added to that average only if doing so
 * raises it, so a low bonus rating never hurts a team. `rated` counts required
 * criteria only; it only means something once all of them have been rated.
 */
export function scoreRubric(
  rubric: Rubric,
  ratings: Ratings,
): { score: number; label: string; rated: number } {
  let rated = 0;
  let part = 0;
  let totalWeight = 0;
  let bonusPart = 0;
  let bonusWeight = 0;

  for (const c of rubric.criteria) {
    const rating = ratingOf(c, ratings);
    const weight = effectiveWeight(rubric, c);

    if (c.bonus) {
      if (rating !== undefined) {
        bonusPart += weight * rating;
        bonusWeight += weight;
      }
      continue;
    }

    if (rating !== undefined) rated += 1;
    totalWeight += weight;
    part += weight * (rating ?? RUBRIC_MIN);
  }

  const base = totalWeight > 0 ? part / totalWeight : 0;
  const withBonus =
    totalWeight > 0 && bonusWeight > 0
      ? (part + bonusPart) / (totalWeight + bonusWeight)
      : base;

  const score = Math.round(Math.max(base, withBonus));
  return { score, label: String(score), rated };
}

interface RubricScorerProps {
  rubric: Rubric;
  ratings: Ratings;
  /** `undefined` clears a rating. Only optional (bonus) criteria offer that. */
  onRate: (criterionId: string, value: number | undefined) => void;
  /** When true, each criterion's description shows beside its name. */
  guideOpen: boolean;
  /** Show the number beside each slider. On by default; the judge app turns it off. */
  showValues?: boolean;
}

/** The slider rows judges work through. Used by the judge screens and the builder preview. */
export function RubricScorer({
  rubric,
  ratings,
  onRate,
  guideOpen,
  showValues = true,
}: RubricScorerProps) {
  return (
    <div id="rubric-guide" className="flex flex-col gap-3">
      {rubric.criteria.map((c) => {
        const current = ratingOf(c, ratings);
        const labelId = `rubric-${c.id}`;

        return (
          <div
            key={c.id}
            role="group"
            aria-labelledby={labelId}
            className="flex flex-col gap-1"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span
                  id={labelId}
                  className="text-base font-semibold text-dashboard-text-heavy"
                >
                  {c.name.trim() || "Untitled criterion"}
                  {c.bonus && (
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-dashboard-text-light">
                      Bonus · optional
                    </span>
                  )}
                </span>
                {guideOpen && c.description.trim() && (
                  <span className="text-xs leading-snug text-dashboard-text-light">
                    {c.description}
                  </span>
                )}
              </div>
              {showValues && (
                <output
                  aria-hidden="true"
                  className={`min-w-[3ch] text-right text-2xl font-semibold tabular-nums leading-none ${
                    current === undefined
                      ? "text-dashboard-text-disabled"
                      : "text-dashboard-text-active"
                  }`}
                >
                  {current ?? RUBRIC_MIN}
                </output>
              )}
            </div>
            {/* Sliders start at 0 but stay dimmed, and don't count as scored,
                until the judge actually touches them. */}
            <input
              type="range"
              min={RUBRIC_MIN}
              max={RUBRIC_MAX}
              step={1}
              value={current ?? RUBRIC_MIN}
              aria-labelledby={labelId}
              aria-valuetext={
                current === undefined ? "Not scored yet" : String(current)
              }
              onChange={(e) => onRate(c.id, Number(e.target.value))}
              onPointerUp={(e) => onRate(c.id, Number(e.currentTarget.value))}
              className={`h-11 w-full cursor-pixel-hover accent-dashboard-action-primary ${
                current === undefined ? "opacity-dashboard-disabled" : ""
              } ${focusRing}`}
            />
            {c.bonus && current !== undefined && (
              <button
                type="button"
                onClick={() => onRate(c.id, undefined)}
                className={`min-h-11 self-end px-2 text-sm font-semibold text-dashboard-text-medium hover:text-dashboard-text-light ${focusRing}`}
              >
                Clear bonus
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
