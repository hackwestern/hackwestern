import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { formatClock } from "~/lib/run-of-show";

export function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <div className="h-28 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-nav" />
      <div className="h-11 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-nav" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-24 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card"
        />
      ))}
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
    <DashboardPanel className="text-center">
      <p className="m-0 text-base text-dashboard-text-medium">
        {scheduleCopy.loadError}
      </p>
      <DashboardButton
        variant="outline"
        className="mx-auto h-11"
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
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
        {eyebrow}
      </span>
      <h1 className="dashboard-h1 m-0 break-words">{title}</h1>
      <p className="m-0 text-base text-dashboard-text-medium">{intro}</p>
    </div>
  );
}
