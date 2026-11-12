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
import { errorCode } from "~/components/judging/shared/judge-ui";
import {
  BTN_DARK,
  BTN_OUTLINE,
  FIELD,
  MUTED,
  type Status,
  StatusLine,
} from "./control-shared";

type JudgeKind = "organizer" | "sponsored";

/** Must match the `track` enum in the database. */
const TRACKS = [
  "Best Use of Cohere",
  "Best Use of AntiGravity",
  "Best Domain",
  "General",
] as const;
type Track = (typeof TRACKS)[number];

// "organizer" is what the database calls a judge who can score any team.
const KIND_LABEL: Record<JudgeKind, string> = {
  organizer: "General",
  sponsored: "Sponsored",
};

const TH_CELL =
  "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide";
const TD_CELL = "px-4 py-3 align-middle";

type Filter = "all" | JudgeKind;

/** Mean score of a judge's marks, or null when they have none. */
const average = (sum: number, count: number) =>
  count > 0 ? Math.round(sum / count) : null;

export function JudgeRoster() {
  const utils = api.useUtils();
  const judgesQuery = api.judging.admin.getAllJudges.useQuery(undefined, {
    // Keeps "judging a team" roughly live without a manual refresh.
    refetchInterval: 15_000,
  });
  const addJudge = api.judging.admin.addJudgeByEmail.useMutation();

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Add-judge dialog.
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<JudgeKind>("organizer");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const judges = judgesQuery.data ?? [];
  const selected = judges.find((j) => j.id === selectedId) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return judges.filter(
      (j) =>
        (filter === "all" || j.type === filter) &&
        (!q ||
          (j.name ?? "").toLowerCase().includes(q) ||
          j.email.toLowerCase().includes(q)),
    );
  }, [judges, filter, query]);

  const openAdd = () => {
    setEmail("");
    setKind("organizer");
    setTracks([]);
    setFormError(null);
    setAddOpen(true);
  };

  const toggleTrack = (track: Track) =>
    setTracks((t) =>
      t.includes(track) ? t.filter((x) => x !== track) : [...t, track],
    );

  const submitAdd = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setFormError("Enter the email they sign in with.");
      return;
    }
    if (kind === "sponsored" && tracks.length === 0) {
      setFormError("Pick at least one track for a sponsored judge.");
      return;
    }
    setFormError(null);
    try {
      const judge = await addJudge.mutateAsync({
        email: trimmed,
        type: kind,
        track: kind === "sponsored" ? tracks : undefined,
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
    <div className="flex flex-col gap-4 font-figtree">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-bold">Judges</h1>
          <p className={`m-0 text-[15px] ${MUTED}`}>
            Judges sign in with their Hack Western account. Add one by email.
          </p>
        </div>
        <button type="button" className={BTN_DARK} onClick={openAdd}>
          Add judge
        </button>
      </div>

      <StatusLine status={status} />

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by type" className="flex gap-2">
          {(
            [
              ["all", "All"],
              ["organizer", "General"],
              ["sponsored", "Sponsored"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              className={filter === value ? BTN_DARK : BTN_OUTLINE}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          aria-label="Search judges"
          placeholder="Search judges…"
          className={`${FIELD} min-w-[200px] flex-1 px-3 sm:max-w-xs`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {judgesQuery.isError && (
        <p role="alert" className="m-0 text-sm text-destructive">
          Couldn&apos;t load judges. Refresh to try again.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-1 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-[15px]">
          <thead>
            <tr className="bg-highlight text-medium">
              <th className={TH_CELL}>Name</th>
              <th className={TH_CELL}>Type</th>
              <th className={TH_CELL}>Tracks</th>
              <th className={TH_CELL}>Marks</th>
              <th className={TH_CELL}>Avg score</th>
              <th className={TH_CELL}>Status</th>
            </tr>
          </thead>
          <tbody>
            {judgesQuery.isLoading && (
              <tr className="border-t border-gray-1">
                <td colSpan={6} className={`${TD_CELL} ${MUTED}`}>
                  Loading…
                </td>
              </tr>
            )}
            {!judgesQuery.isLoading && visible.length === 0 && (
              <tr className="border-t border-gray-1">
                <td colSpan={6} className={`${TD_CELL} ${MUTED}`}>
                  {judges.length === 0
                    ? "No judges yet. Add one by email to get started."
                    : "No judges match."}
                </td>
              </tr>
            )}
            {visible.map((j) => {
              const avg = average(j.marksSum, j.marksCount);
              return (
                <tr key={j.id} className="border-t border-gray-1">
                  <td className={TD_CELL}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(j.id)}
                      aria-label={`Details for ${j.name ?? j.email}`}
                      className="flex flex-col text-left hover:underline"
                    >
                      <span className="font-semibold">{j.name ?? j.email}</span>
                      {j.name && (
                        <span className={`text-xs ${MUTED}`}>{j.email}</span>
                      )}
                    </button>
                  </td>
                  <td className={TD_CELL}>{KIND_LABEL[j.type]}</td>
                  <td className={`${TD_CELL} ${j.track?.length ? "" : MUTED}`}>
                    {j.track?.length ? j.track.join(", ") : "All teams"}
                  </td>
                  <td className={`${TD_CELL} tabular-nums`}>{j.marksCount}</td>
                  <td
                    className={`${TD_CELL} tabular-nums ${
                      avg === null ? MUTED : ""
                    }`}
                  >
                    {avg ?? "–"}
                  </td>
                  <td className={`${TD_CELL} ${j.currentTeamId ? "" : MUTED}`}>
                    {j.currentTeamId ? "Judging a team" : "Idle"}
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
                <DialogDescription>
                  {KIND_LABEL[selected.type]} judge
                </DialogDescription>
              </DialogHeader>

              <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className={MUTED}>Account</dt>
                <dd className="m-0 truncate">{selected.email}</dd>
                <dt className={MUTED}>Tracks</dt>
                <dd className="m-0">
                  {selected.track?.length
                    ? selected.track.join(", ")
                    : "All teams"}
                </dd>
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
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className={`p-0 text-sm ${MUTED}`}>Type</legend>
              <div className="flex gap-2">
                {(["organizer", "sponsored"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={kind === value}
                    className={kind === value ? BTN_DARK : BTN_OUTLINE}
                    onClick={() => {
                      setKind(value);
                      setFormError(null);
                    }}
                  >
                    {KIND_LABEL[value]}
                  </button>
                ))}
              </div>
            </fieldset>
            {kind === "sponsored" && (
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className={`p-0 text-sm ${MUTED}`}>
                  Tracks they judge
                </legend>
                <div className="flex flex-wrap gap-2">
                  {TRACKS.map((track) => (
                    <button
                      key={track}
                      type="button"
                      aria-pressed={tracks.includes(track)}
                      className={
                        tracks.includes(track) ? BTN_DARK : BTN_OUTLINE
                      }
                      onClick={() => {
                        toggleTrack(track);
                        setFormError(null);
                      }}
                    >
                      {track}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {formError && (
              <p role="alert" className="m-0 text-sm text-destructive">
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
    </div>
  );
}
