import { useState } from "react";
import SEO from "~/components/seo";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { InternalNavbar } from "~/components/internals/navbar";
import { DayPicker } from "~/components/sponsors/day-picker";
import { HelpQueue } from "~/components/sponsors/help-queue";
import { ScheduleList } from "~/components/sponsors/schedule-list";
import {
  LoadError,
  PageIntro,
  ReadAt,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SheetEditButton } from "~/components/sponsors/sheet-edit-button";
import { useNow } from "~/components/sponsors/use-now";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import {
  compareRunOfShow,
  formatClock,
  type OrganizerRunOfShow,
  type RunOfShowDay,
} from "~/lib/run-of-show";
import { defaultRunOfShowDay } from "~/lib/run-of-show-time";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

const copy = scheduleCopy.organizer;
// Sheet tabs plus the sponsor help queue, which doesn't need the sheet.
const TAB_LABELS = { ...copy.tabs, help: sponsorHelpCopy.organizer.tab };
type Tab = keyof typeof TAB_LABELS;

// Organizer run of show: the whole sheet, read-only, with team tasks and the
// coffee chat setup. Edits happen in the sheet (SheetEditButton).
export default function OrganizerRunOfShowPage() {
  const now = useNow();
  const [day, setDay] = useState<RunOfShowDay | null>(null);
  const [tab, setTab] = useState<Tab>("schedule");
  const q = api.sponsorSchedule.organizer.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });
  const shownDay = day ?? defaultRunOfShowDay(now);

  return (
    <>
      <SEO title={copy.seoTitle} noindex />
      <InternalNavbar />
      <div className="min-h-screen bg-dashboard-bg-page px-4 pb-12 pt-6 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5">
          <PageIntro eyebrow={copy.title} title={copy.title} intro={copy.intro} />
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <DashboardChip
                key={t}
                selected={t === tab}
                onClick={() => setTab(t)}
                className="min-h-11"
              >
                {TAB_LABELS[t]}
              </DashboardChip>
            ))}
          </div>
          {tab === "help" ? (
            <HelpQueue />
          ) : q.isLoading ? (
            <ScheduleSkeleton />
          ) : !q.data ? (
            <LoadError onRetry={() => void q.refetch()} />
          ) : (
            <>
              <SheetEditButton href={q.data.sheetUrl} />
              {tab !== "coffee" && (
                <DayPicker value={shownDay} onChange={setDay} />
              )}
              {tab === "schedule" && (
                <ScheduleList
                  items={q.data.items.filter((i) => i.day === shownDay)}
                  now={now}
                />
              )}
              {tab === "tasks" && <Tasks data={q.data} day={shownDay} />}
              {tab === "coffee" && <CoffeeSetups data={q.data} />}
              <ReadAt iso={q.data.readAt} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Tasks({ data, day }: { data: OrganizerRunOfShow; day: RunOfShowDay }) {
  const tasks = data.tasks.filter((t) => t.day === day).sort(compareRunOfShow);
  if (tasks.length === 0) {
    return (
      <DashboardPanel>
        <p className="m-0 text-dashboard-text-medium">{copy.noTasks}</p>
      </DashboardPanel>
    );
  }
  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {tasks.map((t, i) => (
        <li
          key={`${t.start}-${i}`}
          className="grid grid-cols-[4.75rem_1fr] gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card"
        >
          <span className="text-sm font-semibold">{formatClock(t.start)}</span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="whitespace-pre-line break-words">{t.task}</span>
            <span className="text-sm text-dashboard-text-light">
              {t.owner ? copy.owner(t.owner) : copy.unowned}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CoffeeSetups({ data }: { data: OrganizerRunOfShow }) {
  const t = copy.coffeeTable;
  const cc = scheduleCopy.coffeeChat;
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
      {data.coffeeChats.map((s) => (
        <li
          key={s.sponsor}
          className="flex flex-col gap-2 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card"
        >
          <h2 className="m-0 text-lg font-semibold">{s.sponsor}</h2>
          {!s.windowStart || !s.windowEnd ? (
            <p className="m-0 text-sm text-dashboard-text-light">{t.notSetUp}</p>
          ) : (
            <dl className="m-0 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-dashboard-text-light">{t.window}</dt>
              <dd className="m-0">
                {formatClock(s.windowStart)} – {formatClock(s.windowEnd)}
              </dd>
              <dt className="text-dashboard-text-light">{t.format}</dt>
              <dd className="m-0">{cc.format(s.durationMinutes, s.groupSize)}</dd>
              <dt className="text-dashboard-text-light">{t.hackers}</dt>
              <dd className="m-0">{s.hackers ?? "–"}</dd>
              <dt className="text-dashboard-text-light">{t.room}</dt>
              <dd className="m-0">{s.room ?? cc.roomTbd}</dd>
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}

export const getServerSideProps = authRedirectOrganizer;
