import { useState } from "react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import { field, focusRing, friendlyError, touch } from "../shared/judge-ui";
import { SCORE_MAX, SCORE_MIN } from "~/schemas/judging";
import { api } from "~/utils/api";

interface Mark {
  id: number;
  score: number;
  team: { name: string };
}

function MarkEditor({ mark, onDone }: { mark: Mark; onDone: () => void }) {
  const utils = api.useUtils();
  const [value, setValue] = useState(String(mark.score));
  const edit = api.judging.me.editTeamMark.useMutation({
    onSuccess: async () => {
      await utils.judging.me.getSubmittedTeamMarks.invalidate();
      onDone();
    },
  });

  const parsed = Number(value);
  const valid =
    value.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed >= SCORE_MIN &&
    parsed <= SCORE_MAX;
  const inputId = `edit-mark-${mark.id}`;

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) {
          edit.mutate({ teamMarkId: mark.id, score: Math.round(parsed) });
        }
      }}
    >
      <label htmlFor={inputId} className="text-xs text-dashboard-text-light">
        New score
      </label>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={SCORE_MIN}
        max={SCORE_MAX}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={!valid}
        className={`${field} w-20 px-2.5`}
      />
      <DashboardButton
        type="submit"
        disabled={!valid || edit.isPending}
        className="h-11 w-auto px-3.5 disabled:opacity-dashboard-disabled md:w-auto"
      >
        {edit.isPending ? "Saving…" : "Save"}
      </DashboardButton>
      <DashboardButton
        type="button"
        variant="tertiary"
        onClick={onDone}
        className={touch}
      >
        Cancel
      </DashboardButton>
      {!valid && (
        <p className="w-full text-xs text-dashboard-text-light">
          Enter a score from 0 to 100.
        </p>
      )}
      {edit.error && (
        <p
          role="alert"
          className="w-full text-sm font-semibold text-destructive"
        >
          {friendlyError(edit.error)}
        </p>
      )}
    </form>
  );
}

/** "Your marks · N", collapsed by default; each mark can be re-scored. */
export function JudgeMarks({ marks }: { marks: Mark[] }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="judge-marks-list"
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-11 cursor-pixel-hover items-center justify-between rounded-dashboard-lg px-1 text-base font-semibold text-dashboard-text-heavy ${focusRing}`}
      >
        <span>Your marks · {marks.length}</span>
        <span className="font-semibold text-dashboard-text-light">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <ul id="judge-marks-list" className="flex flex-col gap-2">
          {marks.length === 0 && (
            <li className="px-1 text-sm text-dashboard-text-light">
              No marks yet. They show up here after you submit.
            </li>
          )}
          {marks.map((mark) => (
            <li
              key={mark.id}
              className="rounded-dashboard-xl flex flex-col gap-2 border border-dashboard-border-subtle bg-dashboard-bg-surface px-3.5 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-base font-semibold text-dashboard-text-heavy">
                  {mark.team.name}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-lg font-semibold tabular-nums text-dashboard-text-heavy">
                    {mark.score}
                  </span>
                  {editingId !== mark.id && (
                    <DashboardButton
                      type="button"
                      variant="outline"
                      onClick={() => setEditingId(mark.id)}
                      aria-label={`Edit score for ${mark.team.name}`}
                      className={touch}
                    >
                      Edit
                    </DashboardButton>
                  )}
                </div>
              </div>
              {editingId === mark.id && (
                <MarkEditor mark={mark} onDone={() => setEditingId(null)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
