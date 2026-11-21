import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import { api } from "~/utils/api";
import { errorCode } from "~/components/judging/shared/judge-ui";
import {
  BTN_DARK,
  BTN_OUTLINE,
  CARD,
  CARD_TITLE,
  FIELD,
  MUTED,
  type Progress,
  type Status,
  StatusLine,
  TD,
  TH,
  errorText,
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

/** Every mark one judge has given, newest table first, plus their stops. */
function JudgeHistory({
  judgeId,
  stops,
  teamAtTable,
}: {
  judgeId: string;
  stops: {
    assignmentId: number;
    tableNumber: number;
    status: string;
    position: number;
  }[];
  teamAtTable: Map<number, string | null>;
}) {
  const resultsQ = api.judging.admin.getTeamResults.useQuery(undefined, {
    refetchInterval: 3000,
  });
  const marks = (resultsQ.data ?? []).flatMap((r) =>
    (["regular", "sponsored"] as const).flatMap((round) =>
      r[round].marks
        .filter((m) => m.judgeId === judgeId)
        .map((m) => ({
          teamId: r.team.id,
          team: r.team.name,
          table: r.team.table,
          round,
          ...m,
        })),
    ),
  );
  const ordered = [...stops].sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-4 text-sm">
      <section aria-label="Assigned tables">
        <h3 className="m-0 mb-1.5 text-base font-bold">Assigned tables</h3>
        {ordered.length === 0 ? (
          <p className={`m-0 ${MUTED}`}>None.</p>
        ) : (
          <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
            {ordered.map((st) => (
              <li
                key={st.assignmentId}
                className={`rounded-full px-2 py-1 text-xs font-semibold ${STOP_STYLE[st.status] ?? ""}`}
              >
                {teamAtTable.get(st.tableNumber) ?? "Empty"} · T{st.tableNumber}{" "}
                · {STOP_LABEL[st.status] ?? st.status}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Scoring history">
        <h3 className="m-0 mb-1.5 text-base font-bold">Scoring history</h3>
        {resultsQ.isLoading ? (
          <p className={`m-0 ${MUTED}`}>Loading…</p>
        ) : marks.length === 0 ? (
          <p className={`m-0 ${MUTED}`}>No scores yet.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {marks.map((m) => {
              const rated = DEFAULT_RUBRIC.criteria.filter(
                (c) => m.ratings[c.id] !== undefined,
              );
              return (
                <li
                  key={`${m.teamId}-${m.round}`}
                  className="rounded-xl border border-[#e3e7ef] p-3"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">
                      {m.team}
                      {m.table !== null ? ` · T${m.table}` : ""}
                      {m.round === "sponsored" ? " · sponsored" : ""}
                    </span>
                    <span className="text-lg font-bold tabular-nums text-[#5b3fa0]">
                      {m.score.toFixed(1)}
                    </span>
                  </div>
                  {rated.length > 0 && (
                    <p className={`m-0 mt-1 text-xs tabular-nums ${MUTED}`}>
                      {rated
                        .map((c) => `${c.name} ${m.ratings[c.id]!.toFixed(1)}`)
                        .join(" · ")}
                    </p>
                  )}
                  {m.notes && (
                    <p className="m-0 mt-1.5 whitespace-pre-wrap">{m.notes}</p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

export function JudgeRoster({
  progress,
  myId,
}: {
  progress: Progress | undefined;
  myId: string | undefined;
}) {
  const utils = api.useUtils();
  const judgesQuery = api.judging.admin.getAllJudges.useQuery(undefined, {
    // Keeps "judging a team" roughly live without a manual refresh.
    refetchInterval: 3000,
  });
  const addJudge = api.judging.admin.addJudgeByEmail.useMutation();
  const noShow = api.judging.admin.setJudgeNoShow.useMutation();
  const handOff = api.judging.admin.handOffJudge.useMutation();
  const teamAtTable = new Map(
    (progress?.tables ?? []).map((t) => [t.number, t.team?.name ?? null]),
  );
  // A stop at an empty table isn't shown: the judge has nothing to do there.
  const stopsByJudge = new Map(
    (progress?.judges ?? []).map((j) => [
      j.id,
      j.stops.filter((st) => teamAtTable.get(st.tableNumber) != null),
    ]),
  );

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [handOffTo, setHandOffTo] = useState("");
  const [handOffStatus, setHandOffStatus] = useState<Status>(null);

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
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className={`text-left ${MUTED}`}>
              <th className={TH}>Name</th>
              <th className={TH}>No-show</th>
              <th className={TH}>Marks</th>
              <th className={TH}>Avg score</th>
              <th className={TH}>Assigned teams</th>
            </tr>
          </thead>
          <tbody>
            {judgesQuery.isLoading && (
              <tr className="border-t border-[#e3e7ef]">
                <td colSpan={5} className={`${TD} ${MUTED}`}>
                  Loading…
                </td>
              </tr>
            )}
            {!judgesQuery.isLoading && visible.length === 0 && (
              <tr className="border-t border-[#e3e7ef]">
                <td colSpan={5} className={`${TD} ${MUTED}`}>
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
                      onClick={() => {
                        setSelectedId(j.id);
                        setHandOffTo("");
                        setHandOffStatus(null);
                      }}
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
                        // Before judging starts, marking a judge who has
                        // tables clears every judge's plan.
                        if (
                          !j.noShow &&
                          !progress?.started &&
                          progress?.judges.find((p) => p.id === j.id)
                            ?.isFloater !== true &&
                          !window.confirm(
                            `Mark ${name} as a no-show? Judging hasn't started, so this clears every judge's tables. Run Auto-assign judges again afterwards.`,
                          )
                        )
                          return;
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
                              {teamAtTable.get(st.tableNumber) ?? "Empty"} · T
                              {st.tableNumber} ·{" "}
                              {STOP_LABEL[st.status] ?? st.status}
                            </li>
                          ))}
                        </ul>
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

              <JudgeHistory
                judgeId={selected.id}
                stops={stopsByJudge.get(selected.id) ?? []}
                teamAtTable={teamAtTable}
              />

              <section
                aria-label="Hand off"
                className="flex flex-col gap-1.5 text-sm"
              >
                <label htmlFor="hand-off-to" className="text-base font-bold">
                  Hand off unfinished tables to
                </label>
                <div className="flex flex-wrap gap-2">
                  <select
                    id="hand-off-to"
                    className={`${FIELD} min-w-0 flex-1`}
                    value={handOffTo}
                    onChange={(e) => setHandOffTo(e.target.value)}
                  >
                    <option value="">Choose a judge…</option>
                    {judges
                      .filter(
                        (j) =>
                          j.type === "organizer" &&
                          !j.noShow &&
                          j.id !== selected.id,
                      )
                      .map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.name ?? j.email}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className={BTN_DARK}
                    disabled={!handOffTo || handOff.isPending}
                    onClick={() => {
                      const from = selected.name ?? selected.email;
                      const to = judges.find((j) => j.id === handOffTo);
                      const toName = to?.name ?? to?.email ?? "that judge";
                      if (
                        !window.confirm(
                          `Hand ${from}'s unfinished tables to ${toName}? They go after ${toName}'s last table, and a table ${from} is judging now starts over.`,
                        )
                      )
                        return;
                      setHandOffStatus(null);
                      handOff.mutate(
                        { fromJudgeId: selected.id, toJudgeId: handOffTo },
                        {
                          onSuccess: (r) => {
                            setHandOffTo("");
                            setHandOffStatus({
                              tone: "ok",
                              text: `Handed ${r.moved} table${r.moved === 1 ? "" : "s"} (${r.tables.join(", ")}) to ${toName}.`,
                            });
                            void utils.judging.admin.invalidate();
                          },
                          onError: (e) =>
                            setHandOffStatus({
                              tone: "error",
                              text: errorText(e),
                            }),
                        },
                      );
                    }}
                  >
                    {handOff.isPending ? "Handing off…" : "Hand off"}
                  </button>
                </div>
                <StatusLine status={handOffStatus} />
              </section>

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
