import { useEffect, useRef, useState } from "react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import { JudgeConfirm } from "~/components/judging/shared/judge-confirm";
import {
  card,
  field,
  touch,
  warningBanner,
} from "~/components/judging/shared/judge-ui";
import {
  type Ratings,
  type Rubric,
  RubricScorer,
  hasGuide,
  scoreRubric,
} from "~/components/judging/shared/rubric-scorer";

// ---- Draft autosave ---------------------------------------------------------
// Drafts are kept in this browser until the score reaches the server, so a
// refresh or a dropped connection doesn't lose a judge's answers. Storage can
// throw (private mode, blocked site data), so every call is guarded.
interface Draft {
  ratings: Ratings;
  notes: string;
}

const draftKey = (key: string) => `hw13-judge-draft-${key}`;

function readDraft(key: string): Draft {
  try {
    const raw = localStorage.getItem(draftKey(key));
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

function writeDraft(key: string, draft: Draft): boolean {
  try {
    localStorage.setItem(draftKey(key), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(draftKey(key));
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
  ratings: Ratings;
  /** 0–100, the same number the backend stores for a mark. */
  score: number;
  notes: string;
}

interface JudgeRubricProps {
  /** Keeps drafts apart per judge on a shared phone. */
  judgeKey: string;
  teamId: string;
  teamName: string;
  /** null when the team isn't seated at a table. */
  table: number | null;
  rubric: Rubric;
  /** Sending to the server. */
  busy: boolean;
  /** Why the last send failed, if it did. */
  error: string | null;
  /** Resolves true once the server has the score. */
  onSubmit: (submission: ScoreSubmission) => Promise<boolean>;
  /** Resolves true once the team is skipped. */
  onAbsent: () => Promise<boolean>;
}

/** The Score page: rubric, notes and the two ways to finish a team. Key it by team. */
export function JudgeRubric({
  judgeKey,
  teamId,
  teamName,
  table,
  rubric,
  busy,
  error,
  onSubmit,
  onAbsent,
}: JudgeRubricProps) {
  const key = `${judgeKey}-${teamId}`;
  const [initial] = useState(() => readDraft(key));
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
      () =>
        setSaveState(writeDraft(key, { ratings, notes }) ? "saved" : "error"),
      500,
    );
    return () => clearTimeout(timer);
  }, [ratings, notes, key]);

  const count = rubric.criteria.length;
  const result = scoreRubric(rubric, ratings);
  const complete = count > 0 && result.rated === count;

  // The draft stays on the phone until the server has the score.
  const submit = async () => {
    if (!complete || busy) return;
    const ok = await onSubmit({
      ratings,
      score: result.score,
      notes: notes.trim(),
    });
    if (ok) clearDraft(key);
  };

  const [confirmAbsent, setConfirmAbsent] = useState(false);
  const absent = async () => {
    setConfirmAbsent(false);
    const ok = await onAbsent();
    if (ok) clearDraft(key);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="m-0 min-w-0 truncate text-base font-medium text-dashboard-text-light">
          {table !== null ? `Table ${table} · ` : ""}
          {teamName}
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
            {guideOpen ? "Hide descriptions" : "Show descriptions"}
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
          disabled={busy}
          onClick={() => setConfirmAbsent(true)}
          className={`${touch} px-4`}
        >
          Team not here
        </DashboardButton>
        <DashboardButton
          type="button"
          disabled={!complete || busy}
          onClick={() => void submit()}
          className="h-11 w-auto flex-1 disabled:opacity-dashboard-disabled md:w-auto"
        >
          {busy ? "Sending…" : "Next team"}
        </DashboardButton>
      </div>
      {error && (
        <p role="alert" className={warningBanner}>
          {error}
        </p>
      )}
      {!complete && (
        <p className="m-0 px-1 text-sm text-dashboard-text-light">
          Score all {count} criteria to continue.
        </p>
      )}
      <JudgeConfirm
        open={confirmAbsent}
        title={
          table !== null
            ? `Mark table ${table} as not here?`
            : "Mark this team as not here?"
        }
        description="No score will be saved. You won't be given this team again."
        confirmLabel="Team not here"
        cancelLabel="Keep scoring"
        onConfirm={() => void absent()}
        onCancel={() => setConfirmAbsent(false)}
      />
    </>
  );
}
