import { useState } from "react";

import {
  card,
  focusRing,
  secondaryButton,
} from "~/components/judging/shared/judge-ui";

const useButton = `min-h-[48px] rounded-xl bg-[#5b3fa0] px-5 text-[17px] font-bold text-white hover:bg-[#4d3488] disabled:cursor-not-allowed disabled:bg-[#9a8cc0] ${focusRing}`;

interface PublicJudgeWrongTableProps {
  /** The table the judge was sent to. */
  expected: number | undefined;
  onBack: () => void;
  /** The table the judge says they are actually at. */
  onUse: (table: number) => void;
}

/** Body of the "Wrong table?" screen. */
export function PublicJudgeWrongTable({
  expected,
  onBack,
  onUse,
}: PublicJudgeWrongTableProps) {
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
        <span id="expected-table-label" className="text-[17px] text-[#4a5d73]">
          Expected
        </span>
        <span className="text-[34px] font-bold leading-none tabular-nums">
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
        className={`min-h-[52px] rounded-xl border-[1.5px] border-[#c3cad8] bg-white px-4 text-[17px] ${focusRing}`}
      />

      <div className="flex gap-2">
        <button type="button" onClick={onBack} className={`${secondaryButton} px-5`}>
          Back
        </button>
        <button type="submit" disabled={!valid} className={useButton}>
          {valid ? `Use ${table}` : "Use table"}
        </button>
      </div>
    </form>
  );
}