import { useState } from "react";

import { focusRing, friendlyError } from "~/components/judging/judge-ui";
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
      <label htmlFor={inputId} className="text-[13px] text-[#4a5d73]">
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
        className={`min-h-[44px] w-[76px] rounded-[10px] border-[1.5px] border-[#c3cad8] px-2.5 text-base ${focusRing}`}
      />
      <button
        type="submit"
        disabled={!valid || edit.isPending}
        className={`min-h-[44px] rounded-[10px] bg-[#5b3fa0] px-3.5 text-sm font-bold text-white hover:bg-[#4d3488] disabled:cursor-not-allowed disabled:bg-[#9a8cc0] ${focusRing}`}
      >
        {edit.isPending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={onDone}
        className={`min-h-[44px] rounded-[10px] px-3 text-sm font-semibold text-[#4a5d73] hover:text-[#0b2238] ${focusRing}`}
      >
        Cancel
      </button>
      {!valid && (
        <p className="w-full text-xs text-[#4a5d73]">
          Enter a score from 0 to 100.
        </p>
      )}
      {edit.error && (
        <p role="alert" className="w-full text-sm font-semibold text-[#8f1d1d]">
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
        className={`flex min-h-[44px] items-center justify-between rounded-lg px-1 text-[15px] font-bold ${focusRing}`}
      >
        <span>Your marks · {marks.length}</span>
        <span className="font-semibold text-[#4a5d73]">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <ul id="judge-marks-list" className="flex flex-col gap-2">
          {marks.length === 0 && (
            <li className="px-1 text-sm text-[#4a5d73]">
              No marks yet. They show up here after you submit.
            </li>
          )}
          {marks.map((mark) => (
            <li
              key={mark.id}
              className="flex flex-col gap-2 rounded-xl border border-[#d6dbe5] bg-white px-3.5 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] font-semibold">
                  {mark.team.name}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-lg font-bold tabular-nums">
                    {mark.score}
                  </span>
                  {editingId !== mark.id && (
                    <button
                      type="button"
                      onClick={() => setEditingId(mark.id)}
                      aria-label={`Edit score for ${mark.team.name}`}
                      className={`min-h-[44px] rounded-[10px] border-[1.5px] border-[#c3cad8] bg-white px-3.5 text-sm font-semibold hover:bg-[#f6f7fa] ${focusRing}`}
                    >
                      Edit
                    </button>
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
