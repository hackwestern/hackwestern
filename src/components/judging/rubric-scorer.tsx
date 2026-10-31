import { focusRing } from "~/components/judging/judge-ui";

/** Highest point a criterion can offer. Keeps the button row usable on a phone. */
export const MAX_POINT = 10;

export interface RubricCriterion {
  id: string;
  name: string;
  /** One short line shown to judges under the name. */
  description: string;
  min: number;
  max: number;
  /** Relative importance. Ignored unless the rubric is weighted. */
  weight: number;
  /** Optional anchors for "What do the points mean?" */
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

/** The rubric judges already had before the builder existed (1–5, equal weight). */
export const DEFAULT_RUBRIC: Rubric = {
  title: "General judging rubric",
  weighted: false,
  criteria: [
    {
      id: "idea",
      name: "Idea",
      description: "",
      min: 1,
      max: 5,
      weight: 1,
      low: "seen it many times",
      mid: "fresh angle on a known problem",
      high: "new and clearly useful",
    },
    {
      id: "technical",
      name: "Technical",
      description: "",
      min: 1,
      max: 5,
      weight: 1,
      low: "mostly slides",
      mid: "core feature works live",
      high: "hard problem, works end to end",
    },
    {
      id: "design",
      name: "Design",
      description: "",
      min: 1,
      max: 5,
      weight: 1,
      low: "hard to follow",
      mid: "clear enough to use",
      high: "polished and intuitive",
    },
    {
      id: "pitch",
      name: "Pitch",
      description: "",
      min: 1,
      max: 5,
      weight: 1,
      low: "unclear what it does",
      mid: "clear demo",
      high: "compelling, handled questions",
    },
  ],
};

export const isValidScale = (c: Pick<RubricCriterion, "min" | "max">) =>
  Number.isInteger(c.min) &&
  Number.isInteger(c.max) &&
  c.min >= 0 &&
  c.max <= MAX_POINT &&
  c.max > c.min;

export const scaleOf = (c: Pick<RubricCriterion, "min" | "max">): number[] =>
  isValidScale(c)
    ? Array.from({ length: c.max - c.min + 1 }, (_, i) => c.min + i)
    : [];

export const effectiveWeight = (rubric: Rubric, c: RubricCriterion) =>
  rubric.weighted && c.weight > 0 ? c.weight : 1;

/** A rating only counts while it is still on the criterion's scale. */
export const ratingOf = (c: RubricCriterion, ratings: Ratings) => {
  const r = ratings[c.id];
  return r !== undefined && r >= c.min && r <= c.max ? r : undefined;
};

export const hasGuide = (rubric: Rubric) =>
  rubric.criteria.some((c) => c.low || c.mid || c.high);

/**
 * Turns ratings into the 0–100 score the backend stores. Each criterion is
 * normalised to 0–1 on its own scale, then averaged by weight. With equal
 * weights and 4 criteria on 1–5 this is the old (total - 4) / 16 formula.
 */
export function scoreRubric(
  rubric: Rubric,
  ratings: Ratings,
): { score: number; label: string; rated: number } {
  const { criteria } = rubric;
  let rated = 0;
  let sum = 0;
  let maxSum = 0;
  let part = 0;
  let totalWeight = 0;

  for (const c of criteria) {
    const rating = ratingOf(c, ratings);
    if (rating !== undefined) rated += 1;
    const weight = effectiveWeight(rubric, c);
    totalWeight += weight;
    part += (weight * ((rating ?? c.min) - c.min)) / Math.max(1, c.max - c.min);
    sum += rating ?? 0;
    maxSum += c.max;
  }

  const score = totalWeight > 0 ? Math.round((100 * part) / totalWeight) : 0;
  // Unweighted reads back as raw points ("14/20"); weighted as the 0–100 score.
  const label = rubric.weighted ? String(score) : `${sum}/${maxSum}`;
  return { score, label, rated };
}

interface RubricScorerProps {
  rubric: Rubric;
  ratings: Ratings;
  onRate: (criterionId: string, value: number) => void;
  guideOpen: boolean;
}

/** The rating rows judges tap through. Used by the judge screen and the builder preview. */
export function RubricScorer({
  rubric,
  ratings,
  onRate,
  guideOpen,
}: RubricScorerProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {rubric.criteria.map((c) => {
        const current = ratingOf(c, ratings);
        const scale = scaleOf(c);
        return (
          <div
            key={c.id}
            role="group"
            aria-labelledby={`rubric-${c.id}`}
            className="flex flex-col gap-1"
          >
            <div className="flex flex-col">
              <span id={`rubric-${c.id}`} className="text-[15px] font-bold">
                {c.name.trim() || "Untitled criterion"}
              </span>
              {c.description.trim() && (
                <span className="text-xs leading-snug text-[#4a5d73]">
                  {c.description}
                </span>
              )}
            </div>
            {scale.length === 0 ? (
              <p className="m-0 text-xs text-[#4a5d73]">
                Set a valid point scale.
              </p>
            ) : (
              <div className="flex flex-wrap gap-[5px]">
                {scale.map((value) => {
                  const on = current === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${c.name} ${value} of ${c.max}`}
                      onClick={() => onRate(c.id, value)}
                      className={`min-h-[44px] min-w-[44px] flex-1 rounded-[10px] border-[1.5px] text-lg font-bold ${
                        on
                          ? "border-[#5b3fa0] bg-[#5b3fa0] text-white"
                          : "border-[#c3cad8] bg-white text-[#0b2238] hover:bg-[#f6f7fa]"
                      } ${focusRing}`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {guideOpen && (
        <dl
          id="rubric-guide"
          className="flex flex-col gap-2 text-xs leading-snug text-[#4a5d73]"
        >
          {rubric.criteria.map((c) => {
            const parts: [number, string][] = [
              [c.min, c.low],
              [Math.round((c.min + c.max) / 2), c.mid],
              [c.max, c.high],
            ];
            const shown = parts.filter(([, text]) => text.trim());
            if (shown.length === 0) return null;
            return (
              <div key={c.id} className="flex flex-col gap-px">
                <dt className="font-bold text-[#0b2238]">{c.name}</dt>
                <dd>{shown.map(([p, text]) => `${p} ${text}`).join(" · ")}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}