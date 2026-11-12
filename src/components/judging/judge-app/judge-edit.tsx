import { JudgeTeamLinks } from "~/components/judging/judge-app/judge-team-links";
import { type TeamLinks } from "~/server/api/utils/judge-data";
import { useState } from "react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  card,
  field,
  touch,
  warningBanner,
} from "~/components/judging/shared/judge-ui";
import { type JudgedTeam } from "~/components/judging/judge-app/judge-teams";
import {
  type Ratings,
  type Rubric,
  RubricScorer,
  hasGuide,
  requiredCount,
  scoreRubric,
} from "~/components/judging/shared/rubric-scorer";

export interface EditedScore {
  ratings: Ratings;
  score: number;
  notes: string;
}

interface JudgeEditProps {
  team: JudgedTeam;
  rubric: Rubric;
  /** GitHub and Devpost links, if the team added any. */
  links?: TeamLinks;
  /** Saving to the server. */
  saving: boolean;
  /** Why the last save failed, if it did. */
  error: string | null;
  /** Resolves true once the server has the change. */
  onSave: (updated: EditedScore) => Promise<boolean>;
  onCancel: () => void;
}

/**
 * Change the score and notes for a team already judged. Saving updates the
 * mark on the server. A mark scored without the rubric starts with empty
 * sliders, so all of them need rating again. Key it by mark.
 */
export function JudgeEdit({
  team,
  rubric,
  links,
  saving,
  error,
  onSave,
  onCancel,
}: JudgeEditProps) {
  const [ratings, setRatings] = useState<Ratings>(team.ratings);
  const [notes, setNotes] = useState(team.notes);
  const [guideOpen, setGuideOpen] = useState(false);

  const count = requiredCount(rubric);
  const result = scoreRubric(rubric, ratings);
  const complete = count > 0 && result.rated === count;

  const save = () => {
    if (!complete || saving) return;
    void onSave({ ratings, score: result.score, notes: notes.trim() });
  };

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="m-0 min-w-0 truncate text-base font-medium text-dashboard-text-light">
          {team.table ?? "–"} · {team.teamName}
        </h1>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-dashboard-text-light">
          Now {team.score}
        </span>
      </div>

      <JudgeTeamLinks links={links} />

      <section
        aria-label="Change score"
        className={`${card} flex flex-col gap-3 px-3.5 py-3`}
      >
        {hasGuide(rubric) && (
          <DashboardButton
            type="button"
            variant="tertiary"
            aria-expanded={guideOpen}
            aria-controls="rubric-guide"
            onClick={() => setGuideOpen((o) => !o)}
            className={`${touch} self-end`}
          >
            {guideOpen
              ? "Hide descriptions"
              : "Show descriptions"}
          </DashboardButton>
        )}
        <RubricScorer
          rubric={rubric}
          ratings={ratings}
          onRate={(id, value) => setRatings((r) => ({ ...r, [id]: value }))}
          guideOpen={guideOpen}
          showValues={false}
        />
      </section>

      <textarea
        aria-label="Notes"
        rows={3}
        maxLength={2000}
        placeholder="Notes…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className={`${field} py-3`}
      />

      <div className="flex flex-wrap gap-2">
        <DashboardButton
          type="button"
          variant="outline"
          disabled={saving}
          onClick={onCancel}
          className={`${touch} px-4`}
        >
          Cancel
        </DashboardButton>
        <DashboardButton
          type="button"
          disabled={!complete || saving}
          onClick={save}
          className="h-11 w-auto flex-1 disabled:opacity-dashboard-disabled md:w-auto"
        >
          {saving ? "Saving…" : "Save"}
        </DashboardButton>
      </div>
      {error && (
        <p role="alert" className={warningBanner}>
          {error}
        </p>
      )}
      {!complete && (
        <p className="m-0 px-1 text-sm text-dashboard-text-light">
          Score all {count} criteria to save.
        </p>
      )}
    </>
  );
}