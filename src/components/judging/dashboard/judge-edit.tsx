import { useState } from "react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import { JudgeConfirm } from "~/components/judging/shared/judge-confirm";
import { card, field, touch } from "~/components/judging/shared/judge-ui";
import { type JudgedTeam } from "~/components/judging/judge-app/judge-teams";
import {
  type Ratings,
  type Rubric,
  RubricScorer,
  hasGuide,
  scoreRubric,
} from "~/components/judging/shared/rubric-scorer";

interface JudgeEditProps {
  team: JudgedTeam;
  rubric: Rubric;
  onSave: (updated: JudgedTeam) => void;
  onCancel: () => void;
}

/**
 * Change the score and notes for a team already judged. Nothing is final until
 * "Submit scores" on the My teams list. Key it by table.
 */
export function JudgeEdit({ team, rubric, onSave, onCancel }: JudgeEditProps) {
  const [ratings, setRatings] = useState<Ratings>(team.ratings);
  const [notes, setNotes] = useState(team.notes);
  const [guideOpen, setGuideOpen] = useState(false);

  const count = rubric.criteria.length;
  const result = scoreRubric(rubric, ratings);
  const complete = count > 0 && result.rated === count;

  const save = () => {
    if (!complete) return;
    onSave({
      ...team,
      absent: false,
      ratings,
      score: result.score,
      notes: notes.trim(),
    });
  };

  const [confirmAbsent, setConfirmAbsent] = useState(false);
  const markAbsent = () => {
    setConfirmAbsent(false);
    onSave({ ...team, absent: true, ratings: {}, score: null, notes: "" });
  };

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="m-0 min-w-0 truncate text-base font-medium text-dashboard-text-light">
          {team.table} · {team.teamName}
        </h1>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-dashboard-text-light">
          {team.absent ? "Marked absent" : `Now ${team.score}`}
        </span>
      </div>

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
              ? "Hide what the points mean"
              : "What do the points mean?"}
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
          onClick={onCancel}
          className={`${touch} px-4`}
        >
          Cancel
        </DashboardButton>
        {!team.absent && (
          <DashboardButton
            type="button"
            variant="outline"
            onClick={() => setConfirmAbsent(true)}
            className={`${touch} px-4`}
          >
            Not here
          </DashboardButton>
        )}
        <DashboardButton
          type="button"
          disabled={!complete}
          onClick={save}
          className="h-11 w-auto flex-1 disabled:opacity-dashboard-disabled md:w-auto"
        >
          Save
        </DashboardButton>
      </div>
      {!complete && (
        <p className="m-0 px-1 text-sm text-dashboard-text-light">
          Score all {count} criteria to save.
        </p>
      )}
      <JudgeConfirm
        open={confirmAbsent}
        title={`Mark table ${team.table} as not here?`}
        description="The score and notes you gave this team will be removed."
        confirmLabel="Team not here"
        cancelLabel="Keep score"
        onConfirm={markAbsent}
        onCancel={() => setConfirmAbsent(false)}
      />
    </>
  );
}
