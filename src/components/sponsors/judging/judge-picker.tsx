import { useCallback, useEffect, useId, useState } from "react";
import { UserRound } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  JUDGE_NAME_MAX,
  cleanJudgeName,
  judgeKey,
} from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";

const copy = sponsorJudgingCopy.judge;
const storageKey = (sponsor: string) => `hw13-sponsor-judge:${sponsor}`;

/**
 * Who's judging on this phone, remembered per sponsor link. Storage can be
 * blocked (private mode), so reads and writes never throw; the name then
 * lasts until the page reloads. `ready` is false until storage was read,
 * so the picker doesn't flash for a returning rep.
 */
export function useJudgeName(sponsor: string) {
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!sponsor) return;
    try {
      const saved = window.localStorage.getItem(storageKey(sponsor));
      setName(saved?.trim() ? saved : null);
    } catch {
      setName(null);
    }
    setReady(true);
  }, [sponsor]);
  const choose = useCallback(
    (next: string | null) => {
      setName(next);
      try {
        if (next) window.localStorage.setItem(storageKey(sponsor), next);
        else window.localStorage.removeItem(storageKey(sponsor));
      } catch {
        // Not remembered; they pick again after a reload.
      }
    },
    [sponsor],
  );
  return { name, ready, choose };
}

/**
 * "Who's judging?": the sponsor's reps (from Your team) as big buttons,
 * plus "Someone else" with a name field. Picking sets the name for this
 * phone; every score saved after that is theirs.
 */
export function JudgePicker({
  reps,
  current,
  onPick,
}: {
  reps: readonly string[];
  current: string | null;
  onPick: (name: string) => void;
}) {
  const inputId = useId();
  const [other, setOther] = useState("");
  const typed = cleanJudgeName(other);
  return (
    <DashboardPanel className="items-stretch">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-xl font-semibold text-dashboard-text-heavy">
          {copy.pickTitle}
        </h2>
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.pickBody}
        </p>
      </div>
      {reps.length > 0 && (
        <div
          role="group"
          aria-label={copy.pickLabel}
          className="grid gap-2 sm:grid-cols-2"
        >
          {reps.map((rep) => {
            const on = current !== null && judgeKey(current) === judgeKey(rep);
            return (
              <button
                key={rep}
                type="button"
                aria-pressed={on}
                onClick={() => onPick(rep)}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-dashboard-lg border px-3 text-left text-base font-semibold",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                  on
                    ? "border-dashboard-action-primary bg-dashboard-bg-highlight text-dashboard-text-active"
                    : "border-dashboard-border-default bg-dashboard-bg-surface text-dashboard-text-heavy [@media(hover:hover)]:hover:border-dashboard-border-strong",
                  pressable,
                )}
              >
                <span
                  aria-hidden
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-nav text-sm font-bold text-dashboard-text-medium"
                >
                  {rep.trim()[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 break-words">{rep}</span>
              </button>
            );
          })}
        </div>
      )}
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed) onPick(typed);
        }}
      >
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-dashboard-text-medium"
        >
          {reps.length > 0 ? copy.someoneElse : copy.nameLabel}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={inputId}
            value={other}
            maxLength={JUDGE_NAME_MAX}
            autoComplete="name"
            placeholder={copy.namePlaceholder}
            onChange={(e) => setOther(e.target.value)}
            className="min-h-11 w-full min-w-0 rounded-dashboard-md border border-dashboard-border-default bg-dashboard-bg-surface px-3 text-base font-medium text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus:border-dashboard-action-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
          />
          <DashboardButton
            type="submit"
            disabled={!typed}
            className="shrink-0 disabled:cursor-not-allowed disabled:opacity-dashboard-disabled"
          >
            {copy.start}
          </DashboardButton>
        </div>
      </form>
    </DashboardPanel>
  );
}

/** "Judging as Dana W. · with Marcus, Priya · Switch". */
export function JudgingAs({
  name,
  others,
  onSwitch,
}: {
  name: string;
  others: readonly string[];
  onSwitch: () => void;
}) {
  const withText = copy.with(others);
  return (
    <div className="flex items-center gap-3 rounded-dashboard-lg bg-dashboard-bg-surface px-3 py-2 shadow-dashboard-card">
      <UserRound
        aria-hidden
        className="size-5 shrink-0 text-dashboard-text-light"
      />
      <p className="m-0 min-w-0 flex-1 break-words text-sm text-dashboard-text-medium">
        {copy.judgingAs}{" "}
        <b className="font-semibold text-dashboard-text-heavy">{name}</b>
        {withText && <span> · {withText}</span>}
      </p>
      <DashboardButton
        type="button"
        variant="small"
        onClick={onSwitch}
        aria-label={copy.switchLabel}
        className="min-h-11 shrink-0 md:min-h-9"
      >
        {copy.switch}
      </DashboardButton>
    </div>
  );
}
