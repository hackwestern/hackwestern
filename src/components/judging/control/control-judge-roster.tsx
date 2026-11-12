import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  BTN_DARK,
  BTN_OUTLINE,
  FIELD,
  MUTED,
  SPONSOR_TRACKS,
  type Status,
  StatusLine,
} from "./control-shared";

export type JudgeKind = "organizer" | "public";
export type JudgeStatus = "on-track" | "behind" | "not-opened";

export interface JudgeLink {
  token: string;
  createdAt: Date;
  revoked: boolean;
}

export interface RosterJudge {
  id: string;
  name: string;
  kind: JudgeKind;
  /** Organizers sign in with this account. */
  email?: string;
  organization?: string;
  tracks: string[];
  marks: number;
  /** How far this judge's scores sit from the group's. null = too few marks. */
  harshness: number | null;
  status: JudgeStatus;
  lastActive: Date | null;
  /** Public judges only: the private link they open instead of signing in. */
  link?: JudgeLink;
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

/** Mock data until the backend exists. Replace with a query. */
export const STARTER_ROSTER: RosterJudge[] = [
  {
    id: "j1",
    name: "Ava Chen",
    kind: "organizer",
    email: "ava@example.com",
    tracks: [],
    marks: 14,
    harshness: 0.4,
    status: "on-track",
    lastActive: minutesAgo(2),
  },
  {
    id: "j2",
    name: "Jordan Patel",
    kind: "public",
    organization: "Acme Cloud",
    tracks: SPONSOR_TRACKS.slice(0, 1),
    marks: 0,
    harshness: null,
    status: "not-opened",
    lastActive: null,
    link: {
      token: "a1b2c3d4e5f60718",
      createdAt: minutesAgo(90),
      revoked: false,
    },
  },
  {
    id: "j3",
    name: "Marcus Lee",
    kind: "organizer",
    email: "marcus@example.com",
    tracks: [],
    marks: 6,
    harshness: -0.7,
    status: "behind",
    lastActive: minutesAgo(21),
  },
];

const STATUS_LABEL: Record<JudgeStatus, string> = {
  "on-track": "On track",
  behind: "Behind",
  "not-opened": "Not opened",
};

const KIND_LABEL: Record<JudgeKind, string> = {
  organizer: "Organizer",
  public: "Public",
};

const statusLabel = (j: RosterJudge) =>
  j.link?.revoked ? "Link revoked" : STATUS_LABEL[j.status];

/** Signed to one decimal ("+0.4", "−0.7"); "fallback" when there's too little data. */
function formatHarshness(h: number | null): string {
  if (h === null || !Number.isFinite(h)) return "fallback";
  const rounded = Math.round(h * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)}`;
}

function makeToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Mock route. The real one needs a page that accepts the token. */
function linkUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/judge/link/${token}`;
}

const formatTime = (d: Date | null) =>
  d
    ? d.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Never";

const TH_CELL =
  "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide";
const TD_CELL = "px-4 py-3 align-middle";

type Filter = "all" | JudgeKind;

type Props = {
  initial?: RosterJudge[];
};

export function JudgeRoster({ initial = STARTER_ROSTER }: Props) {
  const [judges, setJudges] = useState<RosterJudge[]>(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Add-public-judge dialog.
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [tracks, setTracks] = useState<string[]>([]);
  const [nameError, setNameError] = useState(false);
  const [created, setCreated] = useState<RosterJudge | null>(null);

  const selected = judges.find((j) => j.id === selectedId) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return judges.filter(
      (j) =>
        (filter === "all" || j.kind === filter) &&
        (!q ||
          j.name.toLowerCase().includes(q) ||
          j.organization?.toLowerCase().includes(q) ||
          j.email?.toLowerCase().includes(q)),
    );
  }, [judges, filter, query]);

  const updateJudge = (id: string, patch: Partial<RosterJudge>) =>
    setJudges((list) =>
      list.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    );

  async function copyLink(j: RosterJudge) {
    if (!j.link || j.link.revoked) return;
    try {
      await navigator.clipboard.writeText(linkUrl(j.link.token));
      setCopiedId(j.id);
      setTimeout(() => setCopiedId((id) => (id === j.id ? null : id)), 2000);
    } catch {
      setStatus({
        tone: "error",
        text: "Couldn't copy automatically. Open their details and copy the link from the box.",
      });
    }
  }

  // ---- Add public judge ----------------------------------------------------
  const openAdd = () => {
    setName("");
    setOrganization("");
    setTracks([]);
    setNameError(false);
    setCreated(null);
    setAddOpen(true);
  };

  const toggleTrack = (track: string) =>
    setTracks((t) =>
      t.includes(track) ? t.filter((x) => x !== track) : [...t, track],
    );

  const submitAdd = () => {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    const judge: RosterJudge = {
      id: `j-${makeToken().slice(0, 8)}`,
      name: name.trim(),
      kind: "public",
      organization: organization.trim() || undefined,
      tracks,
      marks: 0,
      harshness: null,
      status: "not-opened",
      lastActive: null,
      link: { token: makeToken(), createdAt: new Date(), revoked: false },
    };
    setJudges((list) => [...list, judge]);
    setCreated(judge);
    setStatus(null);
  };

  // ---- Link management -----------------------------------------------------
  const regenerateLink = (j: RosterJudge) => {
    if (
      !window.confirm(
        `Make a new link for ${j.name}? The old link stops working straight away.`,
      )
    )
      return;
    updateJudge(j.id, {
      link: { token: makeToken(), createdAt: new Date(), revoked: false },
      status: "not-opened",
    });
    setStatus({ tone: "ok", text: `New link made for ${j.name}.` });
  };

  const revokeLink = (j: RosterJudge) => {
    if (!j.link) return;
    if (
      !window.confirm(
        `Turn off ${j.name}'s link? They won't be able to judge until you make a new one.`,
      )
    )
      return;
    updateJudge(j.id, { link: { ...j.link, revoked: true } });
    setStatus({ tone: "ok", text: `${j.name}'s link is turned off.` });
  };

  const removeJudge = (j: RosterJudge) => {
    if (!window.confirm(`Remove ${j.name} from the roster?`)) return;
    setJudges((list) => list.filter((x) => x.id !== j.id));
    setSelectedId(null);
    setStatus({ tone: "ok", text: `Removed ${j.name}.` });
  };

  return (
    <div className="flex flex-col gap-4 font-figtree">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-2xl font-bold">Judges</h1>
          <p className={`m-0 text-[15px] ${MUTED}`}>
            Organizers use their accounts. Public judges get a private link.
          </p>
        </div>
        <button type="button" className={BTN_DARK} onClick={openAdd}>
          Add public judge
        </button>
      </div>

      <StatusLine status={status} />

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter by type" className="flex gap-2">
          {(
            [
              ["all", "All"],
              ["organizer", "Organizers"],
              ["public", "Public"],
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

      <div className="overflow-x-auto rounded-xl border border-gray-1 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-[15px]">
          <thead>
            <tr className="bg-highlight text-medium">
              <th className={TH_CELL}>Name</th>
              <th className={TH_CELL}>Type</th>
              <th className={TH_CELL}>Access</th>
              <th className={TH_CELL}>Harshness</th>
              <th className={TH_CELL}>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr className="border-t border-gray-1">
                <td colSpan={5} className={`${TD_CELL} ${MUTED}`}>
                  {judges.length === 0
                    ? "No judges yet. Add a public judge to get started."
                    : "No judges match."}
                </td>
              </tr>
            )}
            {visible.map((j) => {
              const live = j.link && !j.link.revoked;
              return (
                <tr key={j.id} className="border-t border-gray-1">
                  <td className={TD_CELL}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(j.id)}
                      aria-label={`Details for ${j.name}`}
                      className="flex flex-col text-left hover:underline"
                    >
                      <span className="font-semibold">{j.name}</span>
                      {(j.organization || j.tracks.length > 0) && (
                        <span className={`text-xs ${MUTED}`}>
                          {[j.organization, j.tracks.join(", ")]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </button>
                  </td>
                  <td className={TD_CELL}>{KIND_LABEL[j.kind]}</td>
                  <td className={TD_CELL}>
                    {j.kind === "organizer" ? (
                      "Account"
                    ) : live ? (
                      <button
                        type="button"
                        className={`${BTN_OUTLINE} min-h-9 py-0`}
                        onClick={() => void copyLink(j)}
                      >
                        {copiedId === j.id ? "Copied" : "Copy link"}
                      </button>
                    ) : (
                      <span className={MUTED}>Link off</span>
                    )}
                  </td>
                  <td
                    className={`${TD_CELL} tabular-nums ${
                      j.harshness === null ? MUTED : ""
                    }`}
                  >
                    {formatHarshness(j.harshness)}
                  </td>
                  <td
                    className={`${TD_CELL} ${
                      j.status === "behind" && !j.link?.revoked
                        ? "font-semibold text-destructive"
                        : j.status === "not-opened" || j.link?.revoked
                          ? MUTED
                          : ""
                    }`}
                  >
                    {statusLabel(j)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className={`m-0 text-[13px] ${MUTED}`}>
        Harshness is how a judge&apos;s scores compare with the group&apos;s, in
        standard deviations. &ldquo;fallback&rdquo; means they haven&apos;t
        scored enough teams yet, so no adjustment is applied.
      </p>

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
                <DialogTitle>{selected.name}</DialogTitle>
                <DialogDescription>
                  {KIND_LABEL[selected.kind]} judge
                </DialogDescription>
              </DialogHeader>

              <dl className="m-0 grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                {selected.email && (
                  <>
                    <dt className={MUTED}>Account</dt>
                    <dd className="m-0 truncate">{selected.email}</dd>
                  </>
                )}
                {selected.organization && (
                  <>
                    <dt className={MUTED}>Organization</dt>
                    <dd className="m-0">{selected.organization}</dd>
                  </>
                )}
                <dt className={MUTED}>Tracks</dt>
                <dd className="m-0">
                  {selected.tracks.length > 0
                    ? selected.tracks.join(", ")
                    : "All teams"}
                </dd>
                <dt className={MUTED}>Marks</dt>
                <dd className="m-0 tabular-nums">{selected.marks}</dd>
                <dt className={MUTED}>Harshness</dt>
                <dd className="m-0 tabular-nums">
                  {formatHarshness(selected.harshness)}
                </dd>
                <dt className={MUTED}>Status</dt>
                <dd className="m-0">{statusLabel(selected)}</dd>
                <dt className={MUTED}>Last active</dt>
                <dd className="m-0">{formatTime(selected.lastActive)}</dd>
              </dl>

              {selected.kind === "public" && selected.link ? (
                <section
                  aria-label="Private link"
                  className="flex flex-col gap-2 rounded-xl bg-offwhite p-3.5"
                >
                  <p className="m-0 text-sm font-semibold">Private link</p>
                  {selected.link.revoked ? (
                    <p className={`m-0 text-sm ${MUTED}`}>
                      This link is turned off. Make a new one to let them judge
                      again.
                    </p>
                  ) : (
                    <>
                      <input
                        readOnly
                        aria-label="Private link"
                        className={`${FIELD} w-full px-3 text-sm`}
                        value={linkUrl(selected.link.token)}
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <p className={`m-0 text-xs ${MUTED}`}>
                        Made {formatTime(selected.link.createdAt)}. Anyone with
                        this link can judge as {selected.name}, so send it to
                        them only.
                      </p>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {!selected.link.revoked && (
                      <button
                        type="button"
                        className={BTN_DARK}
                        onClick={() => void copyLink(selected)}
                      >
                        {copiedId === selected.id ? "Copied" : "Copy link"}
                      </button>
                    )}
                    <button
                      type="button"
                      className={BTN_OUTLINE}
                      onClick={() => regenerateLink(selected)}
                    >
                      Make a new link
                    </button>
                    {!selected.link.revoked && (
                      <button
                        type="button"
                        className={BTN_OUTLINE}
                        onClick={() => revokeLink(selected)}
                      >
                        Turn off link
                      </button>
                    )}
                  </div>
                </section>
              ) : (
                <p className={`m-0 text-sm ${MUTED}`}>
                  Organizers sign in with their account, so they don&apos;t need
                  a link.
                </p>
              )}

              <DialogFooter className="gap-2 sm:justify-between">
                <span>
                  {selected.kind === "public" && (
                    <button
                      type="button"
                      className={`${BTN_OUTLINE} text-destructive`}
                      onClick={() => removeJudge(selected)}
                    >
                      Remove judge
                    </button>
                  )}
                </span>
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

      {/* --------------------------- Add public judge -------------------------- */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {created?.link ? (
            <>
              <DialogHeader>
                <DialogTitle>Link ready for {created.name}</DialogTitle>
                <DialogDescription>
                  Send them this link. They open it on their phone and start
                  judging, with no sign-in.
                </DialogDescription>
              </DialogHeader>
              <input
                readOnly
                aria-label="Private link"
                className={`${FIELD} w-full px-3 text-sm`}
                value={linkUrl(created.link.token)}
                onFocus={(e) => e.currentTarget.select()}
              />
              <DialogFooter className="gap-2">
                <button
                  type="button"
                  className={BTN_DARK}
                  onClick={() => void copyLink(created)}
                >
                  {copiedId === created.id ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  className={BTN_OUTLINE}
                  onClick={() => setAddOpen(false)}
                >
                  Done
                </button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Add public judge</DialogTitle>
                <DialogDescription>
                  For judges without an account, like sponsors. They get a
                  private link instead of signing in.
                </DialogDescription>
              </DialogHeader>
              <form
                noValidate
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAdd();
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pj-name" className={`text-sm ${MUTED}`}>
                    Name
                  </label>
                  <input
                    id="pj-name"
                    autoFocus
                    className={`${FIELD} w-full px-3`}
                    placeholder="e.g. Jordan Patel"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameError(false);
                    }}
                  />
                  {nameError && (
                    <p className="m-0 text-sm text-destructive">
                      Enter their name.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pj-org" className={`text-sm ${MUTED}`}>
                    Organization (optional)
                  </label>
                  <input
                    id="pj-org"
                    className={`${FIELD} w-full px-3`}
                    placeholder="e.g. Acme Cloud"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                  />
                </div>
                <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                  <legend className={`p-0 text-sm ${MUTED}`}>
                    Tracks they judge (none = all teams)
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {SPONSOR_TRACKS.map((track) => (
                      <button
                        key={track}
                        type="button"
                        aria-pressed={tracks.includes(track)}
                        className={
                          tracks.includes(track) ? BTN_DARK : BTN_OUTLINE
                        }
                        onClick={() => toggleTrack(track)}
                      >
                        {track}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <DialogFooter className="gap-2">
                  <button
                    type="button"
                    className={BTN_OUTLINE}
                    onClick={() => setAddOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={BTN_DARK}>
                    Create link
                  </button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
