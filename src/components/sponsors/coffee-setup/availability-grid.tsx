import { Check } from "lucide-react";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { COFFEE_SESSIONS } from "~/lib/coffee-chat-sessions";
import { cn } from "~/lib/utils";
import { sessionLabel, shortClock, type SetupData } from "./shared";

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

/**
 * Reps x fixed 1-hour sessions. Editable: every cell is a 44px toggle;
 * sessions their workshop blocks show it and can't be ticked. Read-only
 * (review): ticks only. Scrolls inside its card on phones, rep column
 * stays put.
 */
export function AvailabilityGrid({
  data,
  free,
  onToggle,
}: {
  data: SetupData;
  /** repId -> ticked session ids. */
  free: Record<string, string[]>;
  onToggle?: (repId: string, sessionId: string) => void;
}) {
  const when = workshopWhen(data);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-x-auto rounded-dashboard-md border border-dashboard-border-default">
        <table className="w-full min-w-[560px] border-collapse text-sm">
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
                      data.blocked.includes(s.id) && cn(hatch, "font-semibold"),
                    )}
                  >
                    {data.blocked.includes(s.id) ? copy.workshopAt(when) : null}
                  </td>
                ))}
              </tr>
            )}
            {data.reps.map((rep) => {
              const ticked = free[rep.id] ?? [];
              const open = COFFEE_SESSIONS.filter((s) => !data.blocked.includes(s.id));
              const count = open.filter((s) => ticked.includes(s.id)).length;
              return (
                <tr key={rep.id} className="border-t border-dashboard-border-subtle">
                  <th scope="row" className="sticky left-0 z-10 bg-dashboard-bg-surface p-2 text-left align-middle">
                    <span className="block break-words font-semibold text-dashboard-text-heavy">{rep.name}</span>
                    <span className="block text-xs font-normal text-dashboard-text-light">
                      {copy.sessionsOf(count, open.length)}
                    </span>
                  </th>
                  {COFFEE_SESSIONS.map((s) => {
                    const label = sessionLabel(s.id);
                    if (data.blocked.includes(s.id)) {
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
                            {on ? <Box on /> : null}
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
      </div>
      {when && (
        <p className="m-0 flex items-center gap-2 self-end text-xs text-dashboard-text-medium">
          <span aria-hidden className={cn("inline-block size-3 rounded-sm border border-dashboard-border-control", hatch)} />
          {copy.yourWorkshop} · {copy.buffer}
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
