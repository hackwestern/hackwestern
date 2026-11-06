import { useState } from "react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  card,
  field,
  fullWidth,
  touch,
} from "~/components/judging/shared/judge-ui";

interface JudgeImpromptuProps {
  /** Placeholder until the backend knows how many judges a team has had. */
  judgesSoFar: number;
  judgesNeeded: number;
  onScore: (table: number) => void;
}

/**
 * Body of the "Another table" screen: the judge types the number of a table
 * that isn't on their list, sees how many judges it has had, then scores it.
 */
export function JudgeImpromptu({
  judgesSoFar,
  judgesNeeded,
  onScore,
}: JudgeImpromptuProps) {
  const [value, setValue] = useState("");
  const [found, setFound] = useState<number | null>(null);

  const table = Number(value);
  const valid = value !== "" && Number.isInteger(table) && table > 0;

  if (found !== null) {
    return (
      <>
        <section
          aria-label="Table found"
          className={`${card} flex flex-col gap-2 px-4 py-3.5`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-medium text-dashboard-text-heavy">
              Table
            </span>
            <span className="text-xl font-semibold tabular-nums text-dashboard-text-heavy">
              {found}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-base font-medium text-dashboard-text-heavy">
              Judges so far
            </span>
            <span className="text-xl font-semibold tabular-nums text-dashboard-text-heavy">
              {judgesSoFar} of {judgesNeeded}
            </span>
          </div>
        </section>

        <DashboardButton
          type="button"
          onClick={() => onScore(found)}
          className={fullWidth}
        >
          Score this team
        </DashboardButton>
        <DashboardButton
          type="button"
          variant="outline"
          onClick={() => setFound(null)}
          className={touch}
        >
          Change table
        </DashboardButton>
      </>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setFound(table);
      }}
    >
      <p className="m-0 px-1 text-base font-medium text-dashboard-text-light">
        Enter the number on the team&apos;s table.
      </p>
      <label htmlFor="impromptu-table" className="sr-only">
        Table number
      </label>
      <input
        id="impromptu-table"
        inputMode="numeric"
        autoComplete="off"
        maxLength={3}
        placeholder="Table number"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        className={`${field} min-h-12`}
      />
      <DashboardButton
        type="submit"
        disabled={!valid}
        className={`${fullWidth} disabled:opacity-dashboard-disabled`}
      >
        {valid ? `Find table ${table}` : "Find table"}
      </DashboardButton>
    </form>
  );
}