import { useEffect, useRef, useState } from "react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import { card, field, touch } from "~/components/judging/shared/judge-ui";
import {
  type Ratings,
  type Rubric,
  RubricScorer,
  hasGuide,
  scoreRubric,
} from "~/components/judging/shared/rubric-scorer";

// ---- Draft autosave ---------------------------------------------------------
// Until the backend exists, drafts are kept in this browser so a refresh or a
// dropped connection doesn't lose a judge's scores. Storage can throw (private
// mode, blocked site data), so every call is guarded.
interface Draft {
  ratings: Ratings;
  notes: string;
}

const draftKey = (table: number) => `hw13-judge-draft-${table}`;

function readDraft(table: number): Draft {
  try {
    const raw = localStorage.getItem(draftKey(table));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Draft>;
      return {
        ratings:
          parsed.ratings && typeof parsed.ratings === "object"
            ? parsed.ratings
            : {},
        notes: typeof parsed.notes === "string" ? parsed.notes : "",
      };
    }
  } catch {
    // Unreadable draft: start fresh.
  }
  return { ratings: {}, notes: "" };
}

function writeDraft(table: number, draft: Draft): boolean {
  try {
    localStorage.setItem(draftKey(table), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function clearDraft(table: number) {
  try {
    localStorage.removeItem(draftKey(table));
  } catch {
    // Nothing to clear.
  }
}

type SaveState = "saved" | "saving" | "error";

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  error: "Not saved",
};

export interface ScoreSubmission {
  table: number;
  ratings: Ratings;
  /** 0–100, the same number the backend stores for a mark. */
  score: number;
  notes: string;
}

interface JudgeRubricProps {
  table: number;
  /** True when the judge typed in this table, on top of the assigned ones. */
  adHoc: boolean;
  rubric: Rubric;
  onSubmit: (submission: ScoreSubmission) => void;
  onAbsent: (table: number) => void;
}

/** The Score page: rubric, notes and the two ways to finish a table. Key it by table. */
export function JudgeRubric({
  table,
  adHoc,
  rubric,
  onSubmit,
  onAbsent,
}: JudgeRubricProps) {
  const [initial] = useState(() => readDraft(table));
  const [ratings, setRatings] = useState<Ratings>(initial.ratings);
  const [notes, setNotes] = useState(initial.notes);
  const [guideOpen, setGuideOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const mounted = useRef(false);

  // Autosave shortly after the judge stops changing things.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(
      () => setSaveState(writeDraft(table, { ratings, notes }) ? "saved" : "error"),
      500,
    );
    return () => clearTimeout(timer);
  }, [ratings, notes, table]);

  const count = rubric.criteria.length;
  const result = scoreRubric(rubric, ratings);
  const complete = count > 0 && result.rated === count;

  const submit = () => {
    if (!complete) return;
    clearDraft(table);
    onSubmit({ table, ratings, score: result.score, notes: notes.trim() });
  };

  const absent = () => {
    if (!window.confirm(`Mark table ${table} as not here?`)) return;
    clearDraft(table);
    onAbsent(table);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="m-0 text-base font-medium text-dashboard-text-light">
          Table {table}
          {adHoc ? " · ad hoc" : ""}
        </h1>
        <span
          aria-live="polite"
          className={`rounded-full border px-3 py-1 text-sm font-semibold ${
            saveState === "error"
              ? "border-destructive text-destructive"
              : "border-dashboard-border-default text-dashboard-text-heavy"
          }`}
        >
          {SAVE_LABEL[saveState]}
        </span>
      </div>

      <section
        aria-label="Score this team"
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

      <div className="flex gap-2">
        <DashboardButton
          type="button"
          variant="outline"
          onClick={absent}
          className={`${touch} px-4`}
        >
          Team not here
        </DashboardButton>
        <DashboardButton
          type="button"
          disabled={!complete}
          onClick={submit}
          className="h-11 w-auto flex-1 disabled:opacity-dashboard-disabled md:w-auto"
        >
          Next team
        </DashboardButton>
      </div>
      {!complete && (
        <p className="m-0 px-1 text-sm text-dashboard-text-light">
          Score all {count} criteria to continue.
        </p>
      )}
    </>
  );
}