import { useState } from "react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import { card, primaryButton } from "~/components/judging/shared/judge-ui";
import {
  DEFAULT_RUBRIC,
  type Ratings,
  type Rubric,
  RubricScorer,
  hasGuide,
  requiredCount,
  scoreRubric,
} from "~/components/judging/shared/rubric-scorer";
import { CARD, MUTED } from "./control-shared";

type Props = {
  /** The rubric to show. Defaults to the hardcoded, unweighted one. */
  rubric?: Rubric;
};

/**
 * A visual preview of the judging rubric, as judges see it.
 * Nothing here can be changed or saved.
 */
export function RubricBuilder({ rubric = DEFAULT_RUBRIC }: Props) {
  // What the "judge" has tapped. Never saved.
  const [ratings, setRatings] = useState<Ratings>({});
  const [guideOpen, setGuideOpen] = useState(false);

  const count = requiredCount(rubric);
  const result = scoreRubric(rubric, ratings);
  const complete = count > 0 && result.rated === count;

  return (
    <div className="flex flex-col gap-4 font-figtree">
      <h1 className="m-0 text-2xl font-bold">Rubric</h1>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ----------------------------- Criteria ---------------------------- */}
        <section
          aria-label="Criteria"
          className={`${CARD} min-w-0 gap-3 sm:p-4`}
        >
          <h2 className="m-0 text-[17px] font-bold">{rubric.title}</h2>
          <p className={`m-0 text-sm ${MUTED}`}>
            Every criterion counts equally. {count}{" "}
            {count === 1 ? "criterion" : "criteria"}.
          </p>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {rubric.criteria.map((c) => (
              <li key={c.id} className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{c.name}</span>
                {c.description.trim() && (
                  <span className={`text-sm ${MUTED}`}>{c.description}</span>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* ----------------------------- Preview ----------------------------- */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <p className={`mb-2 text-sm font-semibold ${MUTED}`}>
            What judges will see
          </p>
          <div className="mx-auto flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-gray-1 bg-offwhite p-3">
            <p className={`m-0 truncate px-1 text-[13px] ${MUTED}`}>
              {rubric.title}
            </p>
            <section
              aria-label="Score this team (preview)"
              className={`${card} flex flex-col gap-2 px-3.5 py-3`}
            >
              {hasGuide(rubric) && (
                <DashboardButton
                  type="button"
                  variant="tertiary"
                  aria-expanded={guideOpen}
                  aria-controls="rubric-guide"
                  onClick={() => setGuideOpen((o) => !o)}
                  className="min-h-11 self-end"
                >
                  {guideOpen
                    ? "Hide descriptions"
                    : "Show descriptions"}
                </DashboardButton>
              )}
              <RubricScorer
                rubric={rubric}
                ratings={ratings}
                onRate={(id, value) =>
                  setRatings((r) => ({ ...r, [id]: value }))
                }
                guideOpen={guideOpen}
              />
            </section>
            <button
              type="button"
              disabled={!complete}
              className={primaryButton}
            >
              {complete
                ? `Submit ${result.label} & next team`
                : `${result.rated} of ${count} scored`}
            </button>
            <p className={`m-0 px-1 text-[13px] ${MUTED}`}>
              {complete
                ? `Saved as ${result.score} out of 100.`
                : "Drag the sliders to try it. Nothing here is saved."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}