import { CloudOff } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { formatClock } from "~/lib/run-of-show";

// Loading: the page's real shapes (intro, banner, day picker, grid) so
// nothing jumps when the schedule arrives. Pulse stops with reduced motion.
export function ScheduleSkeleton() {
  const block = "animate-pulse motion-reduce:animate-none";
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">{scheduleCopy.loading}</span>
      <div className="flex flex-col gap-2">
        <div
          className={`h-3 w-24 rounded-dashboard-xs bg-dashboard-bg-nav ${block}`}
        />
        <div
          className={`h-8 w-2/3 rounded-dashboard-sm bg-dashboard-bg-nav ${block}`}
        />
      </div>
      <div
        className={`h-28 w-full rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card ${block}`}
      />
      <div className="grid grid-cols-3 gap-2 sm:flex">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-11 rounded-dashboard-lg bg-dashboard-bg-nav sm:w-24 ${block}`}
          />
        ))}
      </div>
      <div
        className={`h-96 w-full rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card ${block}`}
      />
    </div>
  );
}

export function InvalidLink() {
  return (
    <DashboardPanel className="text-center">
      <h1 className="dashboard-h1 m-0">{scheduleCopy.invalidLink.title}</h1>
      <p className="m-0 text-base text-dashboard-text-medium">
        {scheduleCopy.invalidLink.body}
      </p>
    </DashboardPanel>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <DashboardPanel className="items-center text-center">
      <CloudOff
        aria-hidden
        className="size-6 text-dashboard-text-light"
        strokeWidth={1.67}
      />
      <p role="alert" className="m-0 text-base text-dashboard-text-medium">
        {scheduleCopy.loadError}
      </p>
      <DashboardButton
        variant="outline"
        className="mx-auto h-11 motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.97]"
        onClick={onRetry}
      >
        {scheduleCopy.retry}
      </DashboardButton>
    </DashboardPanel>
  );
}

/** "Updated from the run of show at 2:14 PM" */
export function ReadAt({ iso }: { iso: string }) {
  const d = new Date(iso);
  const time = formatClock(
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  );
  return (
    <p className="m-0 text-xs text-dashboard-text-light">
      {scheduleCopy.readAt(time)}
    </p>
  );
}

export function PageIntro({
  eyebrow,
  title,
  intro,
  tour,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  /** A `data-tour` target name for the guided tour. */
  tour?: string;
}) {
  return (
    <div data-tour={tour} className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
        {eyebrow}
      </span>
      <h1 className="dashboard-h1 m-0 break-words">{title}</h1>
      <p className="m-0 text-base text-dashboard-text-medium">{intro}</p>
    </div>
  );
}
