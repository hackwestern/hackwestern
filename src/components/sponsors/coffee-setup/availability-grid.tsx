import { Check } from "lucide-react";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import type { SetupWindows } from "~/lib/coffee-chat-setup";
import { COFFEE_SESSIONS } from "~/lib/coffee-chat-sessions";
import { cn } from "~/lib/utils";
import { clockOf, ScrollHint, sessionLabel, shortClock, type SetupData } from "./shared";

const copy = sponsorSetupCopy.prefs;

/** Diagonal stripes for "your workshop" cells (no colour-only meaning). */
export const hatch =
  "bg-[repeating-linear-gradient(135deg,rgba(81,100,118,0.08)_0,rgba(81,100,118,0.08)_6px,transparent_6px,transparent_12px)]";

export function workshopWhen(data: Pick<SetupData, "workshops">): string | null {
  if (data.workshops.length === 0) return null;
  const start = data.workshops.map((w) => w.start).sort()[0]!;
  const end = data.workshops.map((w) => w.end).sort().at(-1)!;
  return `${shortClock(start)}–${shortClock(end)}`;
}

/** "1:00–1:30 only" for a session the workshop buffer cuts, else null. */
function partialText(windows: SetupWindows, sessionId: string): string | null {
  const w = windows.partial[sessionId];
  return w ? copy.partialOnly(shortClock(clockOf(w.start)), shortClock(clockOf(w.end))) : null;
}

/**
 * Reps x fixed 1-hour sessions. Editable: every cell is a 44px toggle;
 * sessions their workshop blocks show it and can't be ticked. A session the
 * travel buffer only cuts can be ticked and says which part is left
 * ("1:00–1:30 only"). Read-only (review): ticks only. Scrolls inside its
 * card on phones, rep column stays put.
 */
export function AvailabilityGrid({
  data,
  windows,
  free,
  chatsWanted,
  onToggle,
}: {
  data: SetupData;
  /** Blocked and cut sessions for the chat length shown (setupWindows). */
  windows: SetupWindows;
  /** repId -> ticked session ids. */
  free: Record<string, string[]>;
  /** repId -> chats wanted; a rep at 0 has their row greyed. */
  chatsWanted?: Record<string, number>;
  onToggle?: (repId: string, sessionId: string) => void;
}) {
  const when = workshopWhen(data);
  return (
    <div className="flex flex-col gap-2">
      <ScrollHint label={copy.q2}>
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="bg-dashboard-bg-inset">
              <th scope="col" className="sticky left-0 z-10 w-28 bg-dashboard-bg-inset p-2 text-left font-medium text-dashboard-text-light">
                {sponsorSetupCopy.day}
              </th>
              {COFFEE_SESSIONS.map((s) => (
                <th key={s.id} scope="col" className="p-2 text-center font-semibold text-dashboard-text-heavy">
                  {sessionLabel(s.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {when && (
              <tr className="border-t border-dashboard-border-subtle">
                <th scope="row" className="sticky left-0 z-10 bg-dashboard-bg-surface p-2 text-left font-semibold text-dashboard-text-heavy">
                  {copy.yourDay}
                </th>
                {COFFEE_SESSIONS.map((s) => (
                  <td
                    key={s.id}
                    className={cn(
                      "p-1 text-center text-xs text-dashboard-text-medium",
                      windows.blocked.includes(s.id) && cn(hatch, "font-semibold"),
                    )}
                  >
                    {windows.blocked.includes(s.id) ? copy.workshopAt(when) : partialText(windows, s.id)}
                  </td>
                ))}
              </tr>
            )}
            {data.reps.map((rep) => {
              const ticked = free[rep.id] ?? [];
              const open = COFFEE_SESSIONS.filter((s) => !windows.blocked.includes(s.id));
              const count = open.filter((s) => ticked.includes(s.id)).length;
              const off = (chatsWanted?.[rep.id] ?? rep.chatsWanted) === 0;
              return (
                <tr key={rep.id} className={cn("border-t border-dashboard-border-subtle", off && "opacity-50")}>
                  <th scope="row" className="sticky left-0 z-10 bg-dashboard-bg-surface p-2 text-left align-middle">
                    <span className="block break-words font-semibold text-dashboard-text-heavy">{rep.name}</span>
                    <span className="block text-xs font-normal text-dashboard-text-light">
                      {off ? copy.doesntChat : copy.sessionsOf(count, open.length)}
                    </span>
                  </th>
                  {COFFEE_SESSIONS.map((s) => {
                    const only = partialText(windows, s.id);
                    const label = only ? copy.partialLabel(sessionLabel(s.id), only) : sessionLabel(s.id);
                    if (windows.blocked.includes(s.id)) {
                      return (
                        <td key={s.id} className={cn("p-1 text-center text-xs text-dashboard-text-medium", hatch)}>
                          <span aria-hidden>{copy.yourWorkshop}</span>
                          <span className="sr-only">{copy.blockedLabel(rep.name, label)}</span>
                        </td>
                      );
                    }
                    const on = ticked.includes(s.id);
                    return (
                      <td key={s.id} className={cn("p-1 text-center", on && "bg-dashboard-bg-highlight")}>
                        {onToggle ? (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            aria-label={copy.cellLabel(rep.name, label, on)}
                            onClick={() => onToggle(rep.id, s.id)}
                            className="inline-flex size-11 items-center justify-center rounded-dashboard-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
                          >
                            <Box on={on} />
                          </button>
                        ) : (
                          <span className="inline-flex size-11 items-center justify-center">
                            {/* Read-only: a plain tick, not a box that looks clickable. */}
                            {on ? <Check aria-hidden className="size-5 text-dashboard-action-primary" strokeWidth={3} /> : null}
                            <span className="sr-only">{copy.cellLabel(rep.name, label, on)}</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollHint>
      {windows.blocked.length > 0 && (
        <p className="m-0 flex items-center gap-2 self-end text-sm text-dashboard-text-medium">
          <span aria-hidden className={cn("inline-block size-4 rounded-sm border border-dashboard-border-control", hatch)} />
          {copy.legend}
        </p>
      )}
      {!data.workshopsKnown && (
        <p className="m-0 text-sm text-dashboard-text-light">{copy.workshopsUnknown}</p>
      )}
    </div>
  );
}

function Box({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 items-center justify-center rounded-dashboard-xs border-2",
        on
          ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
          : "border-dashboard-border-control bg-dashboard-bg-surface",
      )}
    >
      {on && <Check className="size-4" strokeWidth={3} />}
    </span>
  );
}
