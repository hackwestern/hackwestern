import { focusRing } from "~/components/judging/shared/judge-ui";

/** Every criterion is scored on the same slider, from 0 to 100. */
export const RUBRIC_MIN = 0;
export const RUBRIC_MAX = 100;
const RUBRIC_MID = 50;

export interface RubricCriterion {
  id: string;
  name: string;
  /** One short line shown to judges under the name. */
  description: string;
  /** Relative importance. Ignored unless the rubric is weighted. */
  weight: number;
  /** Optional anchors for "What do the points mean?" (at 0, 50 and 100). */
  low: string;
  mid: string;
  high: string;
}

export interface Rubric {
  title: string;
  /** When false, every criterion counts equally and weights are ignored. */
  weighted: boolean;
  criteria: RubricCriterion[];
}

export type Ratings = Record<string, number | undefined>;

/** The default rubric: four criteria, equal weight. */
export const DEFAULT_RUBRIC: Rubric = {
  title: "General judging rubric",
  weighted: false,
  criteria: [
    {
      id: "idea",
      name: "Idea",
      description: "",
      weight: 1,
      low: "seen it many times",
      mid: "fresh angle on a known problem",
      high: "new and clearly useful",
    },
    {
      id: "technical",
      name: "Technical",
      description: "",
      weight: 1,
      low: "mostly slides",
      mid: "core feature works live",
      high: "hard problem, works end to end",
    },
    {
      id: "design",
      name: "Design",
      description: "",
      weight: 1,
      low: "hard to follow",
      mid: "clear enough to use",
      high: "polished and intuitive",
    },
    {
      id: "pitch",
      name: "Pitch",
      description: "",
      weight: 1,
      low: "unclear what it does",
      mid: "clear demo",
      high: "compelling, handled questions",
    },
  ],
};

export const effectiveWeight = (rubric: Rubric, c: RubricCriterion) =>
  rubric.weighted && c.weight > 0 ? c.weight : 1;

/** A rating only counts while it is on the 0–100 slider. */
export const ratingOf = (c: RubricCriterion, ratings: Ratings) => {
  const r = ratings[c.id];
  return r !== undefined && r >= RUBRIC_MIN && r <= RUBRIC_MAX ? r : undefined;
};

export const hasGuide = (rubric: Rubric) =>
  rubric.criteria.some((c) => c.low || c.mid || c.high);

/**
 * Turns ratings into the 0–100 score the backend stores: the weighted average
 * of the criterion ratings (a plain average when the rubric isn't weighted).
 * It only means something once every criterion has been rated.
 */
export function scoreRubric(
  rubric: Rubric,
  ratings: Ratings,
): { score: number; label: string; rated: number } {
  let rated = 0;
  let part = 0;
  let totalWeight = 0;

  for (const c of rubric.criteria) {
    const rating = ratingOf(c, ratings);
    if (rating !== undefined) rated += 1;
    const weight = effectiveWeight(rubric, c);
    totalWeight += weight;
    part += weight * (rating ?? RUBRIC_MIN);
  }

  const score = totalWeight > 0 ? Math.round(part / totalWeight) : 0;
  return { score, label: String(score), rated };
}

interface RubricScorerProps {
  rubric: Rubric;
  ratings: Ratings;
  onRate: (criterionId: string, value: number) => void;
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
    <div className="flex flex-col gap-3">
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
                </span>
                {c.description.trim() && (
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
          </div>
        );
      })}
      {guideOpen && (
        <dl
          id="rubric-guide"
          className="flex flex-col gap-2 text-xs leading-snug text-dashboard-text-light"
        >
          {rubric.criteria.map((c) => {
            const parts: [number, string][] = [
              [RUBRIC_MIN, c.low],
              [RUBRIC_MID, c.mid],
              [RUBRIC_MAX, c.high],
            ];
            const shown = parts.filter(([, text]) => text.trim());
            if (shown.length === 0) return null;
            return (
              <div key={c.id} className="flex flex-col gap-px">
                <dt className="font-semibold text-dashboard-text-heavy">
                  {c.name}
                </dt>
                <dd>{shown.map(([p, text]) => `${p} ${text}`).join(" · ")}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
