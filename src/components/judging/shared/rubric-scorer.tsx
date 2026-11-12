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
      id: "innovation",
      name: "Innovation & Creativity",
      description:
        "How unique or original is the project idea? Does it present a new solution to a problem or use technology in an unexpected way?",
      weight: 1,
    },
    {
      id: "technical",
      name: "Technical Complexity",
      description:
        "How technically challenging is the project? Did the team push the boundaries with complex algorithms, integrations, or hardware?",
      weight: 1,
    },
    {
      id: "completeness",
      name: "Completeness",
      description:
        "Does the project work as intended? Are there any major bugs or broken features?",
      weight: 1,
    },
    {
      id: "design",
      name: "Design",
      description:
        "How user-friendly and visually appealing is the project? Is the interface intuitive and easy to navigate?",
      weight: 1,
    },
  ],
};

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

const THUMB_PX = 24;

/**
 * How far the blue fill reaches. The thumb centre travels from half a thumb in
 * to half a thumb short of the end, so the fill follows it instead of the raw
 * percentage.
 */
const fillWidth = (value: number) => {
  const pct = (value - RUBRIC_MIN) / (RUBRIC_MAX - RUBRIC_MIN);
  return `calc(${pct * 100}% + ${(0.5 - pct) * THUMB_PX}px)`;
};

/**
 * Hand-drawn range input parts: a clear track and a round blue thumb (WebKit and
 * Firefox). The pixel cursor is set on the thumb and track as well, because
 * browsers draw those as separate parts that don't always inherit it.
 */
const SLIDER_PARTS = [
  "[&::-webkit-slider-runnable-track]:h-6 [&::-webkit-slider-runnable-track]:cursor-pixel-hover [&::-webkit-slider-runnable-track]:bg-transparent",
  "[&::-webkit-slider-thumb]:cursor-pixel-hover [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-dashboard-action-primary [&::-webkit-slider-thumb]:shadow-dashboard-card",
  "[&::-moz-range-track]:h-6 [&::-moz-range-track]:cursor-pixel-hover [&::-moz-range-track]:bg-transparent",
  "[&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:cursor-pixel-hover [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-dashboard-action-primary",
].join(" ");

interface RubricScorerProps {
  rubric: Rubric;
  ratings: Ratings;
  onRate: (criterionId: string, value: number) => void;
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
                until the judge actually touches them. Safari ignores
                accent-color on range inputs, so the track, fill and thumb are
                drawn by hand and look the same in every browser. */}
            <div
              className={`relative flex h-11 items-center ${
                current === undefined ? "opacity-dashboard-disabled" : ""
              }`}
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 h-2 rounded-full bg-dashboard-border-default"
              />
              <div
                aria-hidden="true"
                className="absolute left-0 h-2 rounded-full bg-dashboard-action-primary"
                style={{ width: fillWidth(current ?? RUBRIC_MIN) }}
              />
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
                className={`relative m-0 h-11 w-full cursor-pixel-hover appearance-none bg-transparent ${SLIDER_PARTS} ${focusRing}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}