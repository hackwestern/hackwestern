import { Check, ChevronRight } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import { COFFEE_SESSIONS } from "~/lib/coffee-chat-sessions";
import { cn } from "~/lib/utils";
import {
  Card,
  CardHead,
  ContactList,
  focusRing,
  hatch,
  Logo,
  sessionLabel,
  StatusChip,
  statusText,
  type BoardSponsor,
  type SessionBoardData,
} from "./parts";

const copy = coffeeSessionsCopy;
const sc = copy.sponsors;

/**
 * Sponsors band: logo + status chip ("Needs scheduling · 1 of 3") and a
 * Contact button in one fixed column. Opening a row shows its availability
 * grid, preferences and people inline (no drawer).
 */
export function SponsorsBand({
  board,
  open,
  onOpen,
  contact,
  onContact,
}: {
  board: SessionBoardData;
  open: string | null;
  onOpen: (id: string) => void;
  contact: string | null;
  onContact: (key: string) => void;
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
            const contactOpen = contact === `sp:${sp.id}`;
            const status = statusText(sp.status);
            return (
              <li key={sp.id} className="border-t border-dashboard-border-subtle first:border-t-0">
                <div className="grid min-h-16 grid-cols-[minmax(0,1fr)_92px] items-center gap-2 py-1.5">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={sc.openLabel(sp.name, status)}
                    onClick={() => onOpen(sp.id)}
                    className={cn(
                      "flex min-h-11 min-w-0 cursor-pixel-hover items-center gap-2 rounded-dashboard-md text-left",
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
                      <StatusChip status={sp.status} />
                    </span>
                  </button>
                  <DashboardButton
                    variant="small"
                    className="w-[92px]"
                    aria-expanded={contactOpen}
                    aria-label={copy.contact.buttonLabel(sp.name)}
                    onClick={() => onContact(`sp:${sp.id}`)}
                  >
                    {copy.contact.button}
                  </DashboardButton>
                </div>
                {contactOpen && !isOpen && (
                  <div className="pb-4 pt-1">
                    <ContactList sponsor={sp} draft={sponsorDraft(sp)} />
                  </div>
                )}
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

export function sponsorDraft(sp: BoardSponsor) {
  return (first: string) =>
    sp.submitted
      ? copy.contact.draft.any(first, sp.name)
      : copy.contact.draft.notSubmitted(first, sp.name);
}

function SponsorDetail({ sponsor: sp, board }: { sponsor: BoardSponsor; board: SessionBoardData }) {
  if (!sp.submitted) {
    return (
      <>
        <p className="m-0 text-sm text-dashboard-text-medium">{sc.notSubmittedYet}</p>
        <ContactList sponsor={sp} draft={sponsorDraft(sp)} />
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
                <span className="block text-[11px] font-medium text-dashboard-text-light">
                  {sc.repWants(r.chatsWanted, sp.chatMinutes)}
                </span>
              </th>
              {COFFEE_SESSIONS.map((s) => {
                const label = sessionLabel(s.id);
                const room = roomAt(r.id, s.id);
                const base = "h-[34px] rounded-dashboard-sm border text-center align-middle leading-tight";
                if (room) {
                  return (
                    <td
                      key={s.id}
                      aria-label={sc.repAt(r.name, label, room)}
                      className={cn(base, "border-dashboard-action-primary bg-dashboard-action-primary px-px text-[11px] font-semibold text-dashboard-text-inverse")}
                    >
                      {copy.rooms.rm(room)}
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
                      aria-label={sc.repFree(r.name, label)}
                      className={cn(base, "border-dashboard-bg-inset bg-dashboard-bg-inset text-dashboard-text-active")}
                    >
                      <Check aria-hidden className="inline size-3.5" />
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
      <ContactList sponsor={sp} draft={sponsorDraft(sp)} />
    </>
  );
}
