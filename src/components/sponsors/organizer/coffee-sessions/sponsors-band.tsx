import { Check, ChevronRight } from "lucide-react";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import { COFFEE_SESSIONS, chatsInWindow } from "~/lib/coffee-chat-sessions";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import {
  Card,
  CardHead,
  clockOf,
  focusRing,
  hatch,
  Logo,
  PeopleList,
  sessionLabel,
  StatusChip,
  statusFlags,
  statusText,
  type BoardSponsor,
  type SessionBoardData,
} from "./parts";

const copy = coffeeSessionsCopy;
const sc = copy.sponsors;

/**
 * Sponsors band: logo + status chip ("Submitted, needs scheduling"), how
 * many reps are placed, and a "Changed after invites" flag. Opening a row
 * shows its availability grid, preferences and people (phones with a copy
 * icon) inline (no drawer).
 */
export function SponsorsBand({
  board,
  open,
  onOpen,
}: {
  board: SessionBoardData;
  open: string | null;
  onOpen: (id: string) => void;
}) {
  // Not submitted first: those need chasing.
  const list = [...board.sponsors].sort((a, b) => Number(a.submitted) - Number(b.submitted));
  const submitted = board.sponsors.filter((s) => s.submitted).length;
  return (
    <Card labelledBy="coffee-sponsors" tour="coffee-strip">
      <CardHead
        id="coffee-sponsors"
        title={sc.heading}
        aside={sc.submittedCount(submitted, board.sponsors.length)}
      />
      {list.length === 0 ? (
        <p className="m-0 text-[15px] text-dashboard-text-light">{sc.empty}</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {list.map((sp) => {
            const isOpen = open === sp.id;
            const status = statusText(sp.status);
            const flags = [
              ...(sp.changedAfterSend ? [sc.changedAfterSend] : []),
              ...statusFlags(sp.status),
            ];
            return (
              <li key={sp.id} className="border-t border-dashboard-border-subtle first:border-t-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={sc.openLabel(sp.name, status, flags)}
                  onClick={() => onOpen(sp.id)}
                  className={cn(
                    "flex min-h-16 w-full min-w-0 cursor-pixel-hover items-center gap-2 rounded-dashboard-md py-1.5 text-left",
                    focusRing,
                  )}
                >
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 text-dashboard-text-light motion-safe:transition-transform",
                      isOpen && "rotate-90",
                    )}
                  />
                  <span className="flex min-w-0 flex-col items-start gap-1.5">
                    <Logo name={sp.name} />
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StatusChip status={sp.status} />
                      {flags.map((f) => (
                        <span
                          key={f}
                          className="inline-flex min-h-6 items-center rounded-dashboard-md bg-dashboard-bg-task px-2 py-0.5 text-[13px] font-semibold leading-tight text-dashboard-text-warning"
                        >
                          {f}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
                {isOpen && (
                  <div className="flex flex-col gap-3 pb-4 pt-1">
                    <SponsorDetail sponsor={sp} board={board} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function SponsorDetail({ sponsor: sp, board }: { sponsor: BoardSponsor; board: SessionBoardData }) {
  if (!sp.submitted) {
    return (
      <>
        <p className="m-0 text-sm text-dashboard-text-medium">{sc.notSubmittedYet}</p>
        <PeopleList sponsor={sp} />
      </>
    );
  }
  const roomAt = (repId: string, s: string) =>
    board.placements.find((p) => p.repId === repId && p.sessionId === s)?.room ?? null;
  const event = sc.theirEvent(sp.name);
  return (
    <>
      <p className="m-0 text-[13px] text-dashboard-text-medium">
        <span aria-hidden className="text-dashboard-action-primary">■</span> {sc.legend.pick} ·{" "}
        <span aria-hidden className="font-bold text-dashboard-text-active">✓</span> {sc.legend.free} ·{" "}
        <span aria-hidden className="text-dashboard-text-light">▨</span> {sc.legend.event}
      </p>
      <table className="w-full table-fixed border-separate border-spacing-[3px] text-[13px]">
        <thead>
          <tr>
            <th scope="col" className="w-[88px] max-[520px]:w-[72px]">
              <span className="sr-only">{sc.rep}</span>
            </th>
            {COFFEE_SESSIONS.map((s) => (
              <th
                key={s.id}
                scope="col"
                className="pb-0.5 text-center text-xs font-semibold leading-tight text-dashboard-text-light"
              >
                {sessionLabel(s.id)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sp.reps.map((r) => (
            <tr key={r.id}>
              <th
                scope="row"
                className="text-left align-middle text-[13px] font-semibold leading-tight text-dashboard-text-heavy [overflow-wrap:anywhere]"
              >
                {r.name}
                {(() => {
                  // Placed chats short of what they asked (a partial session): say so.
                  const mine = board.placements.filter((p) => p.repId === r.id);
                  const got = mine.reduce((n, p) => n + chatsInWindow(p.window, sp.chatMinutes), 0);
                  return mine.length > 0 && got < r.chatsWanted ? (
                    <span className="block text-[11px] font-semibold text-dashboard-text-warning">
                      {sc.chatsOf(got, r.chatsWanted)}
                    </span>
                  ) : (
                    <span className="block text-[11px] font-medium text-dashboard-text-light">
                      {sc.repWants(r.chatsWanted, sp.chatMinutes)}
                    </span>
                  );
                })()}
              </th>
              {COFFEE_SESSIONS.map((s) => {
                const label = sessionLabel(s.id);
                const room = roomAt(r.id, s.id);
                // A session the workshop buffer cuts: show the part left, e.g. "1:00–1:30".
                const part = sp.partial[s.id];
                const partTime = part ? copy.rooms.partialTime(clockOf(part.start), clockOf(part.end)) : null;
                const base = "h-[34px] rounded-dashboard-sm border text-center align-middle leading-tight";
                if (room) {
                  return (
                    <td
                      key={s.id}
                      aria-label={sc.repAt(r.name, partTime ?? label, room)}
                      className={cn(base, "border-dashboard-action-primary bg-dashboard-action-primary px-px text-[11px] font-semibold text-dashboard-text-inverse")}
                    >
                      {copy.rooms.rm(room)}
                      {partTime && <span className="block text-[10px] font-medium">{partTime}</span>}
                    </td>
                  );
                }
                if (sp.blocked.includes(s.id)) {
                  return (
                    <td
                      key={s.id}
                      title={event}
                      aria-label={sc.repEvent(r.name, label, event)}
                      className={cn(base, hatch, "border-dashboard-border-default")}
                    />
                  );
                }
                if (r.free.includes(s.id)) {
                  return (
                    <td
                      key={s.id}
                      aria-label={partTime ? sc.repPartial(r.name, label, partTime) : sc.repFree(r.name, label)}
                      className={cn(base, "border-dashboard-bg-inset bg-dashboard-bg-inset text-dashboard-text-active")}
                    >
                      <Check aria-hidden className="inline size-3.5" />
                      {partTime && <span className="block text-[10px] font-medium leading-none">{partTime}</span>}
                    </td>
                  );
                }
                return (
                  <td key={s.id} aria-label={sc.repNotFree(r.name, label)} className={cn(base, "border-dashboard-border-subtle")} />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 text-sm text-dashboard-text-medium">{sc.facts(sp)}</p>
      {board.placements.some((p) => p.sponsorId === sp.id && p.status === "sent") && (
        <InviteSummary sponsorId={sp.id} />
      )}
      <PeopleList sponsor={sp} />
    </>
  );
}

/**
 * One line once a sponsor is sent: "Invites: 6 accepted · 3 waiting · 3
 * open" (coffeeChatInvites.status, every chat of theirs together).
 */
function InviteSummary({ sponsorId }: { sponsorId: string }) {
  const status = api.coffeeChatInvites.status.useQuery(
    { sponsorId },
    { refetchInterval: 15_000, refetchOnWindowFocus: false },
  );
  const sponsor = status.data?.sponsors.find((s) => s.sponsorId === sponsorId);
  if (!status.data || !sponsor) return null;
  const t = sponsor.totals;
  return (
    <p className="m-0 text-sm font-semibold text-dashboard-text-heavy">
      {sc.invites(t.accepted, t.pending, t.open)}
      {!status.data.enabled && (
        <span className="block font-normal text-dashboard-text-light">{sc.invitesOff}</span>
      )}
    </p>
  );
}
