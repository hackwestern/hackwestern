import { focusRing } from "~/components/judging/shared/judge-ui";
import { ADVENTUROUS_ID } from "~/lib/judging-score";

/** Every criterion is scored on the same slider, from 0 to 10 in half steps. */
export const RUBRIC_MIN = 0;
export const RUBRIC_MAX = 10;
export const RUBRIC_STEP = 0.5;

/** Scores read with at most one decimal: 7, 7.5, 7.3. */
export const formatScore = (n: number) => String(Math.round(n * 10) / 10);

export interface RubricCriterion {
  id: string;
  name: string;
  /** One short line shown to judges under the name. */
  description: string;
  /** Relative importance. Ignored unless the rubric is weighted. */
  weight: number;
  /**
   * A track criterion (Adventurous): judges still rate it, but it's left out
   * of the overall score and only feeds its track's score.
   */
  track?: boolean;
}

export interface Rubric {
  title: string;
  /** When false, every criterion counts equally and weights are ignored. */
  weighted: boolean;
  criteria: RubricCriterion[];
}

export type Ratings = Record<string, number | undefined>;

/**
 * The default rubric. The four general criteria count equally toward the
 * overall score; Adventurous only feeds the Adventurous track score (every
 * team is in the track), so it doesn't move the general ranking.
 * Completeness is off the rubric: organizers check it for the top teams.
 */
export const DEFAULT_RUBRIC: Rubric = {
  title: "General judging rubric",
  weighted: false,
  criteria: [
    {
      id: "innovation",
      name: "Innovation + Impact",
      description:
        "How original is the idea, and how much would it matter to the people it's built for?",
      weight: 1,
    },
    {
      id: "creativity",
      name: "Creativity",
      description:
        "How inventive is the approach? Does it use technology or ideas in an unexpected way?",
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
      id: "design",
      name: "Design/Polish",
      description:
        "How user-friendly, visually appealing and finished does the project feel?",
      weight: 1,
    },
    {
      id: ADVENTUROUS_ID,
      name: "Adventurous",
      description:
        "How bold is the project? Did the team take risks with an ambitious idea or tools new to them?",
      weight: 1,
      track: true,
    },
  ],
};

/** The toggle only appears when at least one criterion has a description. */
export const hasGuide = (rubric: Rubric) =>
  rubric.criteria.some((c) => c.description.trim());

export const effectiveWeight = (rubric: Rubric, c: RubricCriterion) =>
  rubric.weighted && c.weight > 0 ? c.weight : 1;

/** A rating only counts while it is on the 0–10 slider. */
export const ratingOf = (c: RubricCriterion, ratings: Ratings) => {
  const r = ratings[c.id];
  return r !== undefined && r >= RUBRIC_MIN && r <= RUBRIC_MAX ? r : undefined;
};

/**
 * Turns ratings into the 0-10 score the backend stores: the weighted average
 * of the criterion ratings (a plain average when the rubric isn't weighted).
 * Track criteria count toward `rated` but not toward the score.
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
    if (c.track) continue;
    const weight = effectiveWeight(rubric, c);
    totalWeight += weight;
    part += weight * (rating ?? RUBRIC_MIN);
  }

  // Kept to two decimals: half-point ratings averaged over a few criteria.
  const score =
    totalWeight > 0 ? Math.round((part / totalWeight) * 100) / 100 : 0;
  return { score, label: formatScore(score), rated };
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
  /** Show the score to the right of each slider. On by default. */
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
            </div>
            {/* Sliders start at 0 but stay dimmed, and don't count as scored,
                until the judge actually touches them. Safari ignores
                accent-color on range inputs, so the track, fill and thumb are
                drawn by hand and look the same in every browser. */}
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="w-[2ch] shrink-0 text-right text-sm font-semibold tabular-nums text-dashboard-text-light"
              >
                {RUBRIC_MIN}
              </span>
              <div
                className={`relative flex h-11 min-w-0 flex-1 items-center ${
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
                  step={RUBRIC_STEP}
                  value={current ?? RUBRIC_MIN}
                  aria-labelledby={labelId}
                  aria-valuetext={
                    current === undefined
                      ? "Not scored yet"
                      : `${formatScore(current)} out of ${RUBRIC_MAX}`
                  }
                  onChange={(e) => onRate(c.id, Number(e.target.value))}
                  onPointerUp={(e) =>
                    onRate(c.id, Number(e.currentTarget.value))
                  }
                  className={`relative m-0 h-11 w-full cursor-pixel-hover appearance-none bg-transparent ${SLIDER_PARTS} ${focusRing}`}
                />
              </div>
              <span
                aria-hidden="true"
                className="w-[2ch] shrink-0 text-sm font-semibold tabular-nums text-dashboard-text-light"
              >
                {RUBRIC_MAX}
              </span>
              {showValues && (
                <output
                  aria-hidden="true"
                  className={`min-w-[3.5ch] shrink-0 rounded-dashboard-md px-1.5 py-0.5 text-center text-base font-bold tabular-nums ${
                    current === undefined
                      ? "bg-dashboard-bg-inset text-dashboard-text-disabled"
                      : "bg-dashboard-bg-highlight text-dashboard-text-active"
                  }`}
                >
                  {current === undefined ? "–" : formatScore(current)}
                </output>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
