import { useState } from "react";

import {
  card,
  focusRing,
  secondaryButton,
} from "~/components/judging/shared/judge-ui";
import { type JudgedTeam } from "~/components/judging/judge-app/judge-teams";
import {
  type Ratings,
  type Rubric,
  RubricScorer,
  hasGuide,
  scoreRubric,
} from "~/components/judging/shared/rubric-scorer";

const saveButton = `min-h-[48px] rounded-xl bg-[#5b3fa0] px-5 text-[17px] font-bold text-white hover:bg-[#4d3488] disabled:cursor-not-allowed disabled:bg-[#9a8cc0] ${focusRing}`;

interface PublicJudgeEditProps {
  team: JudgedTeam;
  rubric: Rubric;
  onSave: (updated: JudgedTeam) => void;
  onCancel: () => void;
}

/**
 * Change the score and notes for a team already judged. Nothing is final until
 * "Submit scores" on the My teams list. Key it by table.
 */
export function PublicJudgeEdit({
  team,
  rubric,
  onSave,
  onCancel,
}: PublicJudgeEditProps) {
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

  const markAbsent = () => {
    if (!window.confirm(`Mark table ${team.table} as not here?`)) return;
    onSave({ ...team, absent: true, ratings: {}, score: null, notes: "" });
  };

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="m-0 min-w-0 truncate text-[15px] font-normal text-[#4a5d73]">
          {team.table} · {team.teamName}
        </h1>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[#4a5d73]">
          {team.absent ? "Marked absent" : `Now ${team.score}`}
        </span>
      </div>

      <section
        aria-label="Change score"
        className={`${card} flex flex-col gap-3 px-3.5 py-3`}
      >
        {hasGuide(rubric) && (
          <button
            type="button"
            aria-expanded={guideOpen}
            aria-controls="rubric-guide"
            onClick={() => setGuideOpen((o) => !o)}
            className={`min-h-[44px] self-end text-sm font-bold text-[#5b3fa0] hover:text-[#3f2a75] ${focusRing}`}
          >
            {guideOpen
              ? "Hide what the points mean"
              : "What do the points mean?"}
          </button>
        )}
        <RubricScorer
          rubric={rubric}
          ratings={ratings}
          onRate={(id, value) => setRatings((r) => ({ ...r, [id]: value }))}
          guideOpen={guideOpen}
        />
      </section>

      <textarea
        aria-label="Notes"
        rows={3}
        maxLength={2000}
        placeholder="Notes…"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className={`rounded-xl border-[1.5px] border-[#c3cad8] bg-white px-4 py-3 text-[17px] ${focusRing}`}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`${secondaryButton} px-4`}
        >
          Cancel
        </button>
        {!team.absent && (
          <button
            type="button"
            onClick={markAbsent}
            className={`${secondaryButton} px-4`}
          >
            Not here
          </button>
        )}
        <button
          type="button"
          disabled={!complete}
          onClick={save}
          className={saveButton}
        >
          Save
        </button>
      </div>
      {!complete && (
        <p className="m-0 px-1 text-[13px] text-[#4a5d73]">
          Score all {count} criteria to save.
        </p>
      )}
    </>
  );
}