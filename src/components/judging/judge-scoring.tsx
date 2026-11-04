import { useEffect, useRef, useState } from "react";

import {
  card,
  focusRing,
  secondaryButton,
} from "~/components/judging/judge-ui";
import {
  type Ratings,
  type Rubric,
  RubricScorer,
  hasGuide,
  scoreRubric,
} from "~/components/judging/rubric-scorer";

const nextButton = `min-h-[48px] rounded-xl bg-[#5b3fa0] px-5 text-[17px] font-bold text-white hover:bg-[#4d3488] disabled:cursor-not-allowed disabled:bg-[#9a8cc0] ${focusRing}`;

// ---- Draft autosave ---------------------------------------------------------
// Until the backend exists, drafts are kept in this browser so a refresh or a
// dropped connection doesn't lose a judge's scores. Storage can throw (private
// mode, blocked site data), so every call is guarded.
interface Draft {
  ratings: Ratings;
  notes: string;
}

const draftKey = (table: number) => `hw13-public-judge-draft-${table}`;

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

interface PublicJudgeScoreProps {
  table: number;
  /** True when the team was found by scanning, on top of the assigned ones. */
  adHoc: boolean;
  rubric: Rubric;
  onSubmit: (submission: ScoreSubmission) => void;
  onAbsent: (table: number) => void;
}

/** The Score page: rubric, notes and the two ways to finish a table. Key it by table. */
export function PublicJudgeScore({
  table,
  adHoc,
  rubric,
  onSubmit,
  onAbsent,
}: PublicJudgeScoreProps) {
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
        <h1 className="m-0 text-[15px] font-normal text-[#4a5d73]">
          Table {table}
          {adHoc ? " · ad hoc" : ""}
        </h1>
        <span
          aria-live="polite"
          className={`rounded-full border-[1.5px] px-3 py-1 text-sm font-semibold ${
            saveState === "error"
              ? "border-[#8f1d1d] text-[#8f1d1d]"
              : "border-[#c3cad8] text-[#0b2238]"
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
          onClick={absent}
          className={`${secondaryButton} px-4`}
        >
          Team not here
        </button>
        <button
          type="button"
          disabled={!complete}
          onClick={submit}
          className={nextButton}
        >
          Next team
        </button>
      </div>
      {!complete && (
        <p className="m-0 px-1 text-[13px] text-[#4a5d73]">
          Score all {count} criteria to continue.
        </p>
      )}
    </>
  );
}