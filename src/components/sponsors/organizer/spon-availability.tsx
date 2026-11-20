import { scheduleCopy } from "~/content/sponsor-schedule";
import type { RunOfShowDay, RunOfShowItem } from "~/lib/run-of-show";
import {
  availabilityWindow,
  clipRanges,
  notesForDay,
  subtractRanges,
  type MinuteRange,
  type SponAvailability,
} from "~/lib/spon-availability";
import { formatMinutes } from "~/lib/sponsor-timeline";
import { cn } from "~/lib/utils";

const copy = scheduleCopy.organizer.availability;
const NAME_WIDTH = 104;

function clockMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/** Hour marks across the window: hourly when short, every 2-3 h when long. */
function hourMarks({
  start,
  end,
}: MinuteRange): { minute: number; label: boolean }[] {
  const hours = (end - start) / 60;
  const every = hours > 12 ? 3 : hours > 6 ? 2 : 1;
  const marks: { minute: number; label: boolean }[] = [];
  for (let m = start; m <= end; m += 60) {
    marks.push({ minute: m, label: ((m - start) / 60) % every === 0 });
  }
  return marks;
}

type Bar = MinuteRange & { kind: "free" | "shift" | "onCall" | "required" };

const BAR_STYLE: Record<Bar["kind"], string> = {
  // Same tints as the day grid's lanes.
  free: "bg-dashboard-schedule-green",
  shift: "bg-dashboard-schedule-blue",
  required: "bg-dashboard-schedule-blue",
  onCall:
    "border border-dashed border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-medium",
};

const SR_TEXT: Record<Bar["kind"], (start: string, end: string) => string> = {
  free: copy.srFree,
  shift: copy.srShift,
  required: copy.srRequired,
  onCall: copy.srOnCall,
};

// The sponsor team's free hours for the picked day, one row per organizer,
// under the run of show. On-call (remote) windows are dashed boxes; time
// away is a hole in the bar plus a note. Organizer-only data.
export function SponAvailabilityTable({
  availability,
  day,
  items,
}: {
  availability: SponAvailability;
  day: RunOfShowDay;
  items: readonly RunOfShowItem[];
}) {
  const { organizers, required } = availability;
  const generalNotes = notesForDay(availability.notes, day);
  if (organizers.length === 0 && generalNotes.length === 0) return null;

  const window = availabilityWindow(
    availability,
    day,
    items
      .filter((i) => i.day === day)
      .map((i) => ({ start: clockMinutes(i.start), end: clockMinutes(i.end) })),
  );
  const span = window.end - window.start;
  const pct = (minute: number) => `${((minute - window.start) / span) * 100}%`;
  const marks = hourMarks(window);

  const rows = [
    ...(required[day].length > 0
      ? [
          {
            key: "everyone",
            name: copy.everyone,
            bars: required[day].map((r) => ({
              ...r,
              kind: "required" as const,
            })),
            notes: [] as string[],
          },
        ]
      : []),
    ...organizers.map((o) => {
      const onCall = o.onCall[day];
      const blocked = [...o.away[day], ...onCall];
      const bars: Bar[] = [
        ...subtractRanges(o.available[day], blocked).map((r) => ({
          ...r,
          kind: "free" as const,
        })),
        ...subtractRanges(o.shifts[day], blocked).map((r) => ({
          ...r,
          kind: "shift" as const,
        })),
        ...onCall.map((r) => ({ ...r, kind: "onCall" as const })),
      ];
      return {
        key: o.name,
        name: o.name,
        bars,
        notes: [
          ...o.away[day].map((r) =>
            copy.away(formatMinutes(r.start), formatMinutes(r.end)),
          ),
          ...notesForDay(o.notes, day),
        ],
      };
    }),
  ];

  return (
    <section
      aria-labelledby="spon-availability"
      className="flex flex-col gap-3"
    >
      <h2
        id="spon-availability"
        className="m-0 text-lg font-bold text-dashboard-text-heavy"
      >
        {copy.heading}
      </h2>
      <div className="overflow-x-auto rounded-dashboard-lg bg-dashboard-bg-surface p-3 shadow-dashboard-card sm:p-4">
        <div className="min-w-[560px]">
          {/* Hour labels. */}
          <div
            aria-hidden
            className="grid"
            style={{ gridTemplateColumns: `${NAME_WIDTH}px minmax(0, 1fr)` }}
          >
            <span />
            <div className="relative h-5">
              {marks
                .filter((m) => m.label)
                .map((m) => (
                  <span
                    key={m.minute}
                    className={cn(
                      "absolute top-0 whitespace-nowrap text-xs leading-4 text-dashboard-text-light",
                      m.minute === window.start
                        ? ""
                        : m.minute === window.end
                          ? "-translate-x-full"
                          : "-translate-x-1/2",
                    )}
                    style={{ left: pct(m.minute) }}
                  >
                    {formatMinutes(m.minute).replace(":00", "")}
                  </span>
                ))}
            </div>
          </div>

          <ul className="m-0 flex list-none flex-col p-0">
            {rows.map((row) => {
              const bars = row.bars.flatMap((b) =>
                clipRanges([b], window.start, window.end).map((r) => ({
                  ...b,
                  ...r,
                })),
              );
              return (
                <li
                  key={row.key}
                  className="grid items-start gap-y-1 border-t border-dashboard-border-subtle py-2"
                  style={{
                    gridTemplateColumns: `${NAME_WIDTH}px minmax(0, 1fr)`,
                  }}
                >
                  <span className="truncate pr-2 text-sm font-semibold leading-6 text-dashboard-text-heavy">
                    {row.name}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="relative h-6 rounded-dashboard-xs bg-dashboard-bg-inset">
                      {/* Hour rules (visual only). */}
                      {marks.slice(1, -1).map((m) => (
                        <span
                          key={m.minute}
                          aria-hidden
                          className="absolute inset-y-0 border-l border-dashboard-border-subtle"
                          style={{ left: pct(m.minute) }}
                        />
                      ))}
                      {bars.map((b) => (
                        <span
                          key={`${b.kind}-${b.start}`}
                          className={cn(
                            "absolute inset-y-0 flex items-center overflow-hidden rounded-dashboard-xs px-1 text-[11px] font-medium leading-4",
                            BAR_STYLE[b.kind],
                          )}
                          style={{
                            left: pct(b.start),
                            width: pct(window.start + b.end - b.start),
                          }}
                          title={SR_TEXT[b.kind](
                            formatMinutes(b.start),
                            formatMinutes(b.end),
                          )}
                        >
                          <span className="sr-only">
                            {SR_TEXT[b.kind](
                              formatMinutes(b.start),
                              formatMinutes(b.end),
                            )}
                          </span>
                          {b.kind === "onCall" && (
                            <span aria-hidden className="truncate">
                              {copy.onCall}
                            </span>
                          )}
                        </span>
                      ))}
                      {bars.length === 0 && (
                        <span className="absolute inset-0 flex items-center px-2 text-xs text-dashboard-text-light">
                          {copy.notAround}
                        </span>
                      )}
                    </div>
                    {row.notes.length > 0 && (
                      <p className="m-0 text-xs leading-4 text-dashboard-text-medium">
                        {row.notes.join(" · ")}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {generalNotes.length > 0 && (
            <p className="m-0 border-t border-dashboard-border-subtle pt-2 text-xs leading-4 text-dashboard-text-medium">
              {copy.generalNotes(generalNotes.join(" · "))}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
