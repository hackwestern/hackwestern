import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { api } from "~/utils/api";
import { seatName } from "~/server/judging/layout";
import { errorCode } from "~/components/judging/shared/judge-ui";
import {
  BTN_DARK,
  BTN_OUTLINE,
  CARD,
  CARD_TITLE,
  FIELD,
  MUTED,
  type Progress,
  type QueueState,
  type Status,
  StatusLine,
  TD,
  TH,
  errorText,
  formatHold,
  splitTables,
} from "./control-shared";

const STOP_STYLE: Record<string, string> = {
  done: "bg-[#e3f4e8] text-[#14532d]",
  in_progress: "bg-[#e4effd] text-[#123d75]",
  assigned: "bg-[#f1f3f8] text-[#2c3e55]",
  team_absent: "bg-[#fdeceb] text-[#7a1a0f]",
};
const STOP_LABEL: Record<string, string> = {
  done: "done",
  in_progress: "now",
  assigned: "upcoming",
  team_absent: "absent",
};

/** Mean score of a judge's marks, or null when they have none. */
const average = (sum: number, count: number) =>
  count > 0 ? Math.round(sum / count) : null;

export function JudgeRoster({
  progress,
  queue,
  now,
  myId,
}: {
  progress: Progress | undefined;
  queue: QueueState | undefined;
  now: number;
  myId: string | undefined;
}) {
  const utils = api.useUtils();
  const judgesQuery = api.judging.admin.getAllJudges.useQuery(undefined, {
    // Keeps "judging a team" roughly live without a manual refresh.
    refetchInterval: 15_000,
  });
  const addJudge = api.judging.admin.addJudgeByEmail.useMutation();
  const send = api.judging.admin.addSeatToJudge.useMutation();
  const noShow = api.judging.admin.setJudgeNoShow.useMutation();
  const [picked, setPicked] = useState<Record<string, string>>({});

  const waiting = (queue?.teams ?? []).filter((t) => !t.currentJudgeId);
  const holdByJudge = new Map(
    (queue?.teams ?? []).flatMap((t) =>
      t.currentJudgeId ? [[t.currentJudgeId, t] as const] : [],
    ),
  );
  const split = progress ? splitTables(progress) : new Set<number>();
  const teamAtSeat = new Map(
    (progress?.seats ?? []).map((t) => [t.id, t.team?.name ?? null]),
  );
  const stopsByJudge = new Map(
    (progress?.judges ?? []).map((j) => [j.id, j.stops]),
  );

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Add-judge dialog.
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const judges = judgesQuery.data ?? [];
  const selected = judges.find((j) => j.id === selectedId) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return judges.filter(
      (j) =>
        !q ||
        (j.name ?? "").toLowerCase().includes(q) ||
        j.email.toLowerCase().includes(q),
    );
  }, [judges, query]);

  const openAdd = () => {
    setEmail("");
    setFormError(null);
    setAddOpen(true);
  };

  const submitAdd = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setFormError("Enter the email they sign in with.");
      return;
    }
    setFormError(null);
    try {
      const judge = await addJudge.mutateAsync({
        email: trimmed,
        type: "organizer",
      });
      await utils.judging.admin.getAllJudges.invalidate();
      setAddOpen(false);
      setStatus({
        tone: "ok",
        text: `${judge.name ?? trimmed} is now a judge.`,
      });
    } catch (error) {
      setFormError(
        errorCode(error) === "NOT_FOUND"
          ? "No Hack Western account with that email. Ask them to sign up first."
          : "Couldn't add them. Check your connection and try again.",
      );
    }
  };

  return (
    <section className={CARD} aria-labelledby="judges-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="judges-title" className={CARD_TITLE}>
            Judges
          </h2>
          <p className={`m-0 text-sm ${MUTED}`}>
            Judges sign in with their Hack Western account. Add one by email.
          </p>
        </div>
        <button type="button" className={BTN_DARK} onClick={openAdd}>
          Add judge
        </button>
      </div>

      <StatusLine status={status} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Search judges"
          placeholder="Search judges…"
          className={`${FIELD} min-w-[200px] flex-1 px-3 sm:max-w-xs`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {judgesQuery.isError && (
        <p role="alert" className="m-0 text-sm text-[#7a1a0f]">
          Couldn&apos;t load judges. Refresh to try again.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className={`text-left ${MUTED}`}>
              <th className={TH}>Name</th>
              <th className={TH}>No-show</th>
              <th className={TH}>Marks</th>
              <th className={TH}>Avg score</th>
              <th className={TH}>Assigned teams</th>
              <th className={TH}>Judging now</th>
              <th className={TH}>Send a team</th>
            </tr>
          </thead>
          <tbody>
            {judgesQuery.isLoading && (
              <tr className="border-t border-[#e3e7ef]">
                <td colSpan={8} className={`${TD} ${MUTED}`}>
                  Loading…
                </td>
              </tr>
            )}
            {!judgesQuery.isLoading && visible.length === 0 && (
              <tr className="border-t border-[#e3e7ef]">
                <td colSpan={8} className={`${TD} ${MUTED}`}>
                  {judges.length === 0
                    ? "No judges yet. Add one by email to get started."
                    : "No judges match."}
                </td>
              </tr>
            )}
            {visible.map((j) => {
              const avg = average(j.marksSum, j.marksCount);
              return (
                <tr key={j.id} className="border-t border-[#e3e7ef]">
                  <td className={TD}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(j.id)}
                      aria-label={`Details for ${j.name ?? j.email}`}
                      className="flex flex-col text-left hover:underline"
                    >
                      <span className="font-semibold">
                        {j.name ?? j.email}
                        {j.id === myId ? " (you)" : ""}
                      </span>
                      {j.name && (
                        <span className={`text-xs ${MUTED}`}>{j.email}</span>
                      )}
                    </button>
                  </td>
                  <td className={TD}>
                    <button
                      type="button"
                      className={`${BTN_OUTLINE} text-sm`}
                      disabled={noShow.isPending}
                      onClick={() => {
                        const name = j.name ?? j.email;
                        setStatus(null);
                        noShow.mutate(
                          { judgeId: j.id, noShow: !j.noShow },
                          {
                            onSuccess: (r) => {
                              setStatus({
                                tone: "ok",
                                text: `${name} is ${r.noShow ? "marked as a no-show" : "back on the roster"}.${
                                  r.planCleared > 0
                                    ? " The judge plan was cleared: run auto-assign again."
                                    : ""
                                }`,
                              });
                              void utils.judging.admin.invalidate();
                            },
                            onError: (e) =>
                              setStatus({
                                tone: "error",
                                text: `Couldn't update ${name}. ${errorText(e)}`,
                              }),
                          },
                        );
                      }}
                    >
                      {j.noShow ? "Undo no-show" : "Mark no-show"}
                    </button>
                  </td>
                  <td className={`${TD} tabular-nums`}>{j.marksCount}</td>
                  <td
                    className={`${TD} tabular-nums ${
                      avg === null ? MUTED : ""
                    }`}
                  >
                    {avg ?? "–"}
                  </td>
                  <td className={TD}>
                    {(() => {
                      const stops = [...(stopsByJudge.get(j.id) ?? [])].sort(
                        (a, b) => a.position - b.position,
                      );
                      if (stops.length === 0)
                        return <span className={MUTED}>None</span>;
                      return (
                        <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
                          {stops.map((st) => (
                            <li
                              key={st.assignmentId}
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${STOP_STYLE[st.status] ?? ""}`}
                            >
                              {teamAtSeat.get(st.seatId) ?? "Empty"} · Table{" "}
                              {seatName(st, split.has(st.tableNumber))} ·{" "}
                              {STOP_LABEL[st.status] ?? st.status}
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </td>
                  <td className={TD}>
                    {(() => {
                      const hold = holdByJudge.get(j.id);
                      return hold ? (
                        <>
                          <span className="font-semibold">{hold.teamName}</span>
                          <span
                            className={`whitespace-nowrap tabular-nums ${MUTED}`}
                          >
                            {" · "}
                            {hold.assignedAt
                              ? formatHold(
                                  now - new Date(hold.assignedAt).getTime(),
                                )
                              : "just now"}
                          </span>
                        </>
                      ) : (
                        <span className="rounded-full bg-[#e4effd] px-2 py-1 text-xs font-bold text-[#123d75]">
                          Free
                        </span>
                      );
                    })()}
                  </td>
                  <td className={TD}>
                    {(() => {
                      const name = j.name ?? j.email;
                      const choice = waiting.find(
                        (t) => t.teamId === picked[j.id],
                      )
                        ? picked[j.id]!
                        : (waiting[0]?.teamId ?? "");
                      const sending =
                        send.isPending && send.variables?.judgeId === j.id;
                      return (
                        <div className="flex gap-1.5">
                          <select
                            aria-label={`Team to send to ${name}`}
                            className={`${FIELD} max-w-[180px] text-sm`}
                            value={choice}
                            disabled={waiting.length === 0}
                            onChange={(e) =>
                              setPicked((p) => ({
                                ...p,
                                [j.id]: e.target.value,
                              }))
                            }
                          >
                            {waiting.length === 0 ? (
                              <option value="">No teams waiting</option>
                            ) : (
                              waiting.map((t) => (
                                <option key={t.teamId} value={t.teamId}>
                                  {t.teamName}
                                </option>
                              ))
                            )}
                          </select>
                          <button
                            type="button"
                            className={`${BTN_OUTLINE} text-sm`}
                            disabled={!choice || send.isPending}
                            onClick={() => {
                              const team = waiting.find(
                                (t) => t.teamId === choice,
                              );
                              if (!team) return;
                              setStatus(null);
                              send.mutate(
                                { judgeId: j.id, seatId: team.seatId },
                                {
                                  onSuccess: () => {
                                    setStatus({
                                      tone: "ok",
                                      text: `Added Table ${seatName(team, team.split)} (${team.teamName}) to ${name}'s list.`,
                                    });
                                    void utils.judging.admin.invalidate();
                                  },
                                  onError: (e) =>
                                    setStatus({
                                      tone: "error",
                                      text: `Couldn't add Table ${seatName(team, team.split)} to ${name}'s list. ${errorText(e)}`,
                                    }),
                                },
                              );
                            }}
                          >
                            {sending ? "Sending…" : "Send"}
                          </button>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---------------------------- Details dialog --------------------------- */}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.name ?? selected.email}</DialogTitle>
                <DialogDescription>Judge</DialogDescription>
              </DialogHeader>

              <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className={MUTED}>Account</dt>
                <dd className="m-0 truncate">{selected.email}</dd>
                <dt className={MUTED}>Marks</dt>
                <dd className="m-0 tabular-nums">{selected.marksCount}</dd>
                <dt className={MUTED}>Average score</dt>
                <dd className="m-0 tabular-nums">
                  {average(selected.marksSum, selected.marksCount) ?? "–"}
                </dd>
                <dt className={MUTED}>Status</dt>
                <dd className="m-0">
                  {selected.currentTeamId ? "Judging a team" : "Idle"}
                </dd>
              </dl>

              <DialogFooter className="gap-2">
                <button
                  type="button"
                  className={BTN_OUTLINE}
                  onClick={() => setSelectedId(null)}
                >
                  Close
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ------------------------------ Add judge ------------------------------ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add judge</DialogTitle>
            <DialogDescription>
              They need a Hack Western account first. Enter the email they sign
              in with.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitAdd();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="judge-email" className={`text-sm ${MUTED}`}>
                Email
              </label>
              <input
                id="judge-email"
                type="email"
                autoFocus
                className={`${FIELD} w-full px-3`}
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormError(null);
                }}
              />
            </div>
            {formError && (
              <p role="alert" className="m-0 text-sm text-[#7a1a0f]">
                {formError}
              </p>
            )}
            <DialogFooter className="gap-2">
              <button
                type="button"
                className={BTN_OUTLINE}
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={BTN_DARK}
                disabled={addJudge.isPending}
              >
                {addJudge.isPending ? "Adding…" : "Add judge"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
