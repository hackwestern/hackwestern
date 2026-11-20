import { useEffect, useState } from "react";
import { api } from "~/utils/api";
import {
  BTN_DARK,
  CARD,
  CARD_TITLE,
  FIELD,
  MUTED,
  type QueueState,
  type Status,
  StatusLine,
  errorText,
} from "./control-shared";

/** Room setup: tables, seating teams at them, and assigning judges. */
export function ControlQueue({ queue }: { queue: QueueState | undefined }) {
  const utils = api.useUtils();
  const [tableCount, setTableCount] = useState(70);
  const [rows, setRows] = useState(5);
  const [judgesPerSeat, setJudgesPerSeat] = useState(3);
  const [status, setStatus] = useState<Status>(null);

  // Start the form from what is saved on the server.
  const settings = queue?.settings;
  useEffect(() => {
    if (!settings) return;
    setTableCount(settings.tableCount);
    setRows(settings.rows);
    setJudgesPerSeat(settings.judgesPerSeat);
  }, [settings]);

  const done = (text: string) => {
    setStatus({ tone: "ok", text });
    void utils.judging.admin.invalidate();
  };
  const failed = (what: string) => (e: { message: string }) =>
    setStatus({ tone: "error", text: `Couldn't ${what}. ${errorText(e)}` });

  const setup = api.judging.admin.setupTables.useMutation({
    onSuccess: () => done("Tables set up."),
    onError: failed("set up the tables"),
  });
  const seat = api.judging.admin.seatTeams.useMutation({
    onSuccess: () => done("Teams seated."),
    onError: failed("seat the teams"),
  });
  const assign = api.judging.admin.autoAssign.useMutation({
    onSuccess: () => done("Judges assigned to seats."),
    onError: failed("assign judges"),
  });
  const busy = setup.isPending || seat.isPending || assign.isPending;
  const locked = queue?.started === true;

  const pill = !queue
    ? "Loading…"
    : locked
      ? "Judging has started"
      : `${queue.teams.length} team${queue.teams.length === 1 ? "" : "s"} to judge`;

  const num = (label: string, value: number, set: (n: number) => void) => (
    <label className={`flex flex-col gap-1 text-sm ${MUTED}`}>
      {label}
      <input
        type="number"
        min={1}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className={`${FIELD} w-24`}
        disabled={locked}
      />
    </label>
  );

  return (
    <section className={CARD} aria-labelledby="queue-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="queue-title" className={CARD_TITLE}>
          Tables &amp; assignment
        </h2>
        <span className={`text-sm font-semibold ${MUTED}`}>{pill}</span>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {num("Judges per seat", judgesPerSeat, setJudgesPerSeat)}
        <button
          type="button"
          className={BTN_DARK}
          disabled={busy || locked}
          onClick={() => {
            setStatus(null);
            setup.mutate({ tableCount, rows, judgesPerSeat });
          }}
        >
          {setup.isPending ? "Saving…" : "Set up tables"}
        </button>
        <button
          type="button"
          className={BTN_DARK}
          disabled={busy || locked}
          onClick={() => {
            setStatus(null);
            seat.mutate({ random: true });
          }}
        >
          {seat.isPending ? "Seating…" : "Seat teams"}
        </button>
        <button
          type="button"
          className={BTN_DARK}
          disabled={busy || locked}
          onClick={() => {
            setStatus(null);
            assign.mutate();
          }}
        >
          {assign.isPending ? "Assigning…" : "Auto-assign judges"}
        </button>
      </div>
      <p className={`m-0 text-sm ${MUTED}`}>
        Do these in order before judging starts: set up the tables, seat every
        submitted team, then assign organizer judges. After judging starts the
        plan is locked.
      </p>
      <StatusLine status={status} />
    </section>
  );
}
