import { hover, press } from "~/components/internals/interaction";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { RUN_OF_SHOW_DAYS, type RunOfShowDay } from "~/lib/run-of-show";
import { cn } from "~/lib/utils";

// Friday / Saturday / Sunday as small segmented pills that sit in the
// schedule card's header next to the day title (Jazz, 2026-11-18): 44px
// tall for touch, 32px from sm up. Toggle buttons (aria-pressed) in a
// labelled group, as before; a slight press-in confirms the tap.
export function DayPicker({
  value,
  onChange,
  days = RUN_OF_SHOW_DAYS,
  label = scheduleCopy.dayPicker,
  dayLabel = (day) => day,
  tourId,
}: {
  value: RunOfShowDay;
  onChange: (day: RunOfShowDay) => void;
  days?: readonly RunOfShowDay[];
  /** The group's accessible name. */
  label?: string;
  /** Short pill text, e.g. "Fri"; the full day stays the accessible name. */
  dayLabel?: (day: RunOfShowDay) => string;
  /** A `data-tour` name, for a guided tour step on the pills. */
  tourId?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      data-tour={tourId}
      className="inline-flex w-fit items-center gap-0.5 rounded-full bg-dashboard-bg-inset p-0.5"
    >
      {days.map((day) => {
        const selected = day === value;
        return (
          <button
            key={day}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(day)}
            className={cn(
              "inline-flex h-11 cursor-pixel-hover items-center justify-center whitespace-nowrap rounded-full px-3 font-figtree text-sm font-semibold leading-none sm:h-8 sm:text-xs",
              press,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1",
              selected
                ? "bg-dashboard-action-primary text-dashboard-text-inverse"
                : cn("text-dashboard-text-medium", hover.surface),
            )}
          >
            {dayLabel(day) === day ? (
              day
            ) : (
              <>
                <span aria-hidden>{dayLabel(day)}</span>
                <span className="sr-only">{day}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
