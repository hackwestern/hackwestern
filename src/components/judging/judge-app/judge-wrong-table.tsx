import { useState } from "react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import { card, field, touch } from "../shared/judge-ui";

interface JudgeWrongTableProps {
  /** The table the judge was sent to. */
  expected: number | undefined;
  onBack: () => void;
  /** The table the judge says they are actually at. */
  onUse: (table: number) => void;
}

/** Body of the "Wrong table?" screen. */
export function JudgeWrongTable({
  expected,
  onBack,
  onUse,
}: JudgeWrongTableProps) {
  const [value, setValue] = useState("");
  const table = Number(value);
  const valid = value !== "" && Number.isInteger(table) && table > 0;

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onUse(table);
      }}
    >
      <section
        aria-labelledby="expected-table-label"
        className={`${card} flex flex-col gap-1.5 p-4`}
      >
        <span
          id="expected-table-label"
          className="text-base font-medium text-dashboard-text-light"
        >
          Expected
        </span>
        <span className="text-4xl font-bold tabular-nums leading-none text-dashboard-text-heavy">
          {expected ?? "–"}
        </span>
      </section>

      <input
        aria-label="Table you're at"
        inputMode="numeric"
        autoComplete="off"
        placeholder="Table you're at"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        className={`${field} min-h-12`}
      />

      <div className="flex gap-2">
        <DashboardButton
          type="button"
          variant="outline"
          onClick={onBack}
          className={`${touch} px-5`}
        >
          Back
        </DashboardButton>
        <DashboardButton
          type="submit"
          disabled={!valid}
          className="h-11 w-auto flex-1 disabled:opacity-dashboard-disabled md:w-auto"
        >
          {valid ? `Use ${table}` : "Use table"}
        </DashboardButton>
      </div>
    </form>
  );
}
