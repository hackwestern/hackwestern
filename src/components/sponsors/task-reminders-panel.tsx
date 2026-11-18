import { useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { taskRemindersCopy } from "~/content/task-reminders";
import { api } from "~/utils/api";

const copy = taskRemindersCopy.panel;

/** "Fri 7:00 PM", in event time. */
const pingTime = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
});

// Task pings (T49): one line on what happens, plus a small status. Owners are
// matched on Slack automatically, so there's nothing to set up here.
function TaskRemindersPanel() {
  const status = api.taskReminders.status.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });
  const s = status.data;
  const parts = s
    ? [
        !s.slackConnected && { text: copy.noToken, warning: true },
        s.slackConnected &&
          !s.channelConfigured && { text: copy.noChannel, warning: true },
        s.slackConnected && {
          text: s.nextPingAt
            ? copy.nextPing(pingTime.format(s.nextPingAt))
            : copy.noNextPing,
          warning: false,
        },
        s.failed > 0 && { text: copy.failed(s.failed), warning: true },
      ].filter((p): p is { text: string; warning: boolean } => Boolean(p))
    : [];

  return (
    <DashboardPanel className="gap-2 p-4 sm:p-6">
      <p className="m-0 text-sm text-dashboard-text-medium">{copy.intro}</p>
      {status.isLoading ? (
        <div className="h-5 w-40 animate-pulse rounded-dashboard-md bg-dashboard-bg-nav" />
      ) : !s ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-dashboard-text-warning">{copy.loadError}</span>
          <DashboardButton
            variant="outline"
            onClick={() => void status.refetch()}
          >
            {copy.retry}
          </DashboardButton>
        </div>
      ) : (
        <p className="m-0 text-sm">
          {parts.map((p, i) => (
            <span
              key={p.text}
              className={
                p.warning
                  ? "text-dashboard-text-warning"
                  : "text-dashboard-text-heavy"
              }
            >
              {i > 0 && " · "}
              {p.text}
            </span>
          ))}
        </p>
      )}
    </DashboardPanel>
  );
}

const OPEN_KEY = "hw-sponsor-schedule-task-pings-open";

// "Task pings" under the Schedule grid: collapsed by default, and it
// remembers being opened. The panel (and its queries) only mounts when open.
export function TaskPingsSection() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(OPEN_KEY) === "1");
    } catch {
      // Storage blocked: stays collapsed.
    }
  }, []);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  };
  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-dashboard-lg bg-dashboard-bg-surface px-4 text-left text-base font-semibold text-dashboard-text-heavy shadow-dashboard-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
      >
        {copy.sectionTitle}
        <ChevronDown
          aria-hidden
          className={`size-5 shrink-0 text-dashboard-text-light motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div id={panelId} hidden={!open}>
        {open && <TaskRemindersPanel />}
      </div>
    </section>
  );
}
