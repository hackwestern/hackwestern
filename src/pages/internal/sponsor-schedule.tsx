import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SEO from "~/components/seo";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { InternalNavbar } from "~/components/internals/navbar";
import { AddCoffeeChat } from "~/components/sponsors/add-coffee-chat";
import { CoffeeChatBoard } from "~/components/sponsors/coffee-chat-board";
import { CoffeeChatRooms } from "~/components/sponsors/coffee-chat-rooms";
import { CeremonyOrder } from "~/components/sponsors/ceremony-order";
import { CompanyLocationsView } from "~/components/sponsors/company-locations";
import {
  DayGrid,
  TimelineKey,
  useShowHackathon,
} from "~/components/sponsors/day-grid";
import { DayPicker } from "~/components/sponsors/day-picker";
import { HelpQueue } from "~/components/sponsors/help-queue";
import {
  LoadError,
  PageIntro,
  ReadAt,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SheetEditButton } from "~/components/sponsors/sheet-edit-button";
import { SponsorMap } from "~/components/sponsors/sponsor-map";
import { useNow } from "~/components/sponsors/use-now";
import { WorkshopsTable } from "~/components/sponsors/workshop-details";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import {
  compareRunOfShow,
  formatClock,
  type OrganizerRunOfShow,
  type RunOfShowDay,
} from "~/lib/run-of-show";
import { defaultRunOfShowDay } from "~/lib/run-of-show-time";
import { fetchScheduleData } from "~/lib/schedule";
import { buildOrganizerTimeline, taskEntries } from "~/lib/sponsor-timeline";
import type { OrganizerCoffeeChat } from "~/server/api/routers/coffee-chat-requests";
import { cn } from "~/lib/utils";
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
  // The public /live schedule, muted behind the run of show (same toggle
  // as the sponsor view). If it fails the run of show still shows.
  const live = useQuery({
    queryKey: ["live-schedule"],
    queryFn: fetchScheduleData,
    refetchInterval: 60_000,
  });
  const [showHackathon, setShowHackathon] = useShowHackathon();
  const shownDay = day ?? defaultRunOfShowDay(now);

  return (
    <>
      <SEO title={copy.seoTitle} noindex />
      <InternalNavbar />
      <div className="min-h-screen bg-dashboard-bg-page px-4 pb-12 pt-6 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5">
        <div
          className={cn(
            "mx-auto flex w-full flex-col gap-5",
            // The day grid gets room for its columns; lists stay readable.
            tab === "schedule" ? "max-w-[1280px]" : "max-w-[880px]",
          )}
        >
          <PageIntro
            eyebrow={copy.title}
            title={copy.title}
            intro={copy.intro}
          />
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
          ) : tab === "where" ? (
            <WhereIsEveryone day={shownDay} onDay={setDay} now={now} />
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
                <>
                  <TimelineKey
                    mode="organizer"
                    showHackathon={showHackathon}
                    onShowHackathonChange={setShowHackathon}
                  />
                  <DayGrid
                    mode="organizer"
                    day={shownDay}
                    now={now}
                    entries={[
                      ...buildOrganizerTimeline({
                        day: shownDay,
                        items: q.data.items,
                        live: live.data,
                        showHackathon,
                      }),
                      ...taskEntries(shownDay, q.data.tasks),
                    ]}
                    workshops={q.data.workshops}
                    tasks={q.data.tasks}
                    emptyText={copy.emptyDay}
                  />
                  <CeremonyOrder
                    segments={q.data.ceremonies}
                    items={q.data.items}
                  />
                  <WorkshopsTable workshops={q.data.workshops} />
                </>
              )}
              {tab === "tasks" && <Tasks data={q.data} day={shownDay} />}
              {tab === "coffee" && (
                <CoffeeChatBoard
                  list={
                    <>
                      <CoffeeChatRooms />
                      <AddCoffeeChat />
                      <BookedChats />
                    </>
                  }
                />
              )}
              <ReadAt iso={q.data.readAt} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Every company's rooms and times. Organizer-only: sponsors never see this.
function WhereIsEveryone({
  day,
  onDay,
  now,
}: {
  day: RunOfShowDay;
  onDay: (day: RunOfShowDay) => void;
  now: Date;
}) {
  const q = api.sponsorSchedule.organizerCompanies.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });
  // Watcher names for the map; the map still works without them.
  const rooms = api.coffeeChatRequests.organizerRooms.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });
  if (q.isLoading) return <ScheduleSkeleton />;
  if (!q.data) return <LoadError onRetry={() => void q.refetch()} />;
  const watchers = Object.fromEntries(
    (rooms.data?.sponsors ?? []).map((s) => [s.sponsor, s.watcher]),
  );
  return (
    <>
      <DayPicker value={day} onChange={onDay} />
      <SponsorMap data={q.data} watchers={watchers} day={day} now={now} />
      <CompanyLocationsView data={q.data} day={day} now={now} />
      <ReadAt iso={q.data.readAt} />
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

const booked = coffeeChatCopy.organizer;

// Every booked coffee chat with Cancel and Move room. Organizers change
// bookings here, not in the sheet (no two-way sync, docs/decisions.md).
function BookedChats() {
  const q = api.coffeeChatRequests.organizerChats.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  return (
    <section aria-labelledby="booked-chats" className="flex flex-col gap-3">
      <h2 id="booked-chats" className="m-0 text-lg font-semibold">
        {booked.heading}
      </h2>
      {q.isLoading ? (
        <div className="h-24 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card" />
      ) : !q.data ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : q.data.chats.length === 0 ? (
        <DashboardPanel>
          <p className="m-0 text-dashboard-text-medium">{booked.empty}</p>
        </DashboardPanel>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {q.data.chats.map((chat) => (
            <BookedChat key={chat.chatId} chat={chat} rooms={q.data.rooms} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BookedChat({
  chat,
  rooms,
}: {
  chat: OrganizerCoffeeChat;
  rooms: string[];
}) {
  const utils = api.useUtils();
  const [mode, setMode] = useState<"idle" | "cancel" | "move">("idle");
  const otherRooms = rooms.filter((room) => room !== chat.room);
  const [room, setRoom] = useState(otherRooms[0] ?? "");
  const done = {
    onSuccess: async () => {
      setMode("idle");
      await utils.coffeeChatRequests.organizerChats.invalidate();
    },
  };
  const cancel = api.coffeeChatRequests.cancel.useMutation(done);
  const move = api.coffeeChatRequests.moveRoom.useMutation(done);
  const error = cancel.error ?? move.error;
  const active = chat.status === "pending" || chat.status === "accepted";
  const hacker = booked.hacker(chat.firstName, chat.lastName);
  const time = formatClock(chat.slotTime);
  const selectId = `move-${chat.chatId}`;

  return (
    <li className="flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-semibold text-dashboard-text-light">
            {booked.when(time, chat.durationMinutes)}
          </span>
          <span className="break-words font-semibold">{chat.sponsorName}</span>
          <span className="break-words text-sm text-dashboard-text-medium">
            {hacker} · {chat.room ?? booked.roomTbd}
          </span>
        </div>
        <DashboardTag
          className={
            active
              ? "bg-dashboard-bg-highlight text-dashboard-text-active"
              : "bg-dashboard-bg-inset"
          }
        >
          {booked.status[chat.status]}
        </DashboardTag>
      </div>

      {active && mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <DashboardButton variant="outline" onClick={() => setMode("move")}>
            {booked.moveRoom}
          </DashboardButton>
          <DashboardButton variant="outline" onClick={() => setMode("cancel")}>
            {booked.cancel}
          </DashboardButton>
        </div>
      )}

      {active && mode === "cancel" && (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm">
            {booked.cancelConfirm(hacker, chat.sponsorName, time)}
          </p>
          <div className="flex flex-wrap gap-2">
            <DashboardButton
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ chatId: chat.chatId })}
            >
              {booked.confirmCancel}
            </DashboardButton>
            <DashboardButton variant="tertiary" onClick={() => setMode("idle")}>
              {booked.close}
            </DashboardButton>
          </div>
        </div>
      )}

      {active && mode === "move" && (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm">
            {booked.moveHint(chat.sponsorName, time)}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor={selectId} className="flex flex-col gap-1 text-sm">
              <span className="text-dashboard-text-light">{booked.moveTo}</span>
              <select
                id={selectId}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="h-10 rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-sm text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
              >
                {otherRooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <DashboardButton
              variant="outline"
              disabled={!room || move.isPending}
              onClick={() => move.mutate({ chatId: chat.chatId, room })}
            >
              {booked.move}
            </DashboardButton>
            <DashboardButton
              variant="tertiary"
              className="h-10"
              onClick={() => setMode("idle")}
            >
              {booked.close}
            </DashboardButton>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
          {error.message || booked.actionError}
        </p>
      )}
    </li>
  );
}

export const getServerSideProps = authRedirectOrganizer;
