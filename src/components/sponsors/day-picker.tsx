import { DashboardChip } from "~/components/internals/dashboard-chip";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { RUN_OF_SHOW_DAYS, type RunOfShowDay } from "~/lib/run-of-show";

// Friday / Saturday / Sunday switcher. Full-width thirds on phones so each
// chip is a comfortable tap target; a slight press-in confirms the tap.
export function DayPicker({
  value,
  onChange,
  days = RUN_OF_SHOW_DAYS,
}: {
  value: RunOfShowDay;
  onChange: (day: RunOfShowDay) => void;
  days?: readonly RunOfShowDay[];
}) {
  return (
    <div
      role="group"
      aria-label={scheduleCopy.dayPicker}
      className="grid grid-cols-3 gap-2 sm:flex"
    >
      {days.map((day) => (
        <DashboardChip
          key={day}
          selected={day === value}
          onClick={() => onChange(day)}
          className="min-h-11 justify-center motion-safe:transition-[color,background-color,transform] motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.97] sm:min-w-24"
        >
          {day}
        </DashboardChip>
      ))}
    </div>
  );
}
