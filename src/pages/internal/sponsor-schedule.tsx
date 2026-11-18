import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useQuery } from "@tanstack/react-query";
import SEO from "~/components/seo";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { InternalNavbar } from "~/components/internals/navbar";
import { AddCoffeeChat } from "~/components/sponsors/add-coffee-chat";
import { CoffeeChatBoard } from "~/components/sponsors/coffee-chat-board";
import {
  CoffeeChatRoomTable,
  useLiveChatBoard,
} from "~/components/sponsors/coffee-chat-room-table";
import { CoffeeChatRooms } from "~/components/sponsors/coffee-chat-rooms";
import { CoffeeChatLiveMap } from "~/components/sponsors/coffee-chat-side-panel";
import { CeremonyOrder } from "~/components/sponsors/ceremony-order";
import {
  DayGrid,
  TimelineKey,
  useShowHackathon,
} from "~/components/sponsors/day-grid";
import { DayPicker } from "~/components/sponsors/day-picker";
import { HappeningNowBanner } from "~/components/sponsors/happening-now";
import { HelpQueue } from "~/components/sponsors/help-queue";
import {
  LoadError,
  PageIntro,
  ReadAt,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SheetEditButton } from "~/components/sponsors/sheet-edit-button";
import {
  SponsorFilter,
  useSponsorSelection,
} from "~/components/sponsors/sponsor-filter";
import { TaskPingsSection } from "~/components/sponsors/task-reminders-panel";
import { useNow } from "~/components/sponsors/use-now";
import { WorkshopsTable } from "~/components/sponsors/workshop-details";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import { formatClock, type RunOfShowDay } from "~/lib/run-of-show";
import { ROOM_CAPACITY } from "~/lib/coffee-chat-room-table";
import { COFFEE_CHAT_DAY_LABEL } from "~/lib/coffee-chats";
import { defaultRunOfShowDay } from "~/lib/run-of-show-time";
import { fetchScheduleData } from "~/lib/schedule";
import { coffeeChatEntries } from "~/lib/schedule-bookings";
import { buildOrganizerTimeline, taskEntries } from "~/lib/sponsor-timeline";
import type { OrganizerCoffeeChat } from "~/server/api/routers/coffee-chat-requests";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

const copy = scheduleCopy.organizer;
/** How often booked coffee chats refresh on the schedule. */
const LIVE_REFRESH_MS = 15_000;
// Sheet tabs plus the sponsor help queue, which doesn't need the sheet.
const TAB_LABELS = { ...copy.tabs, help: sponsorHelpCopy.organizer.tab };
type Tab = keyof typeof TAB_LABELS;

// Organizer run of show: the whole sheet, read-only, with team tasks and the
// coffee chat setup. Edits happen in the sheet (SheetEditButton).
export default function OrganizerRunOfShowPage() {
  const now = useNow();
  const [day, setDay] = useState<RunOfShowDay | null>(null);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("schedule");
  // "Where is everyone" is now the rooms table under the schedule: its tab
  // (and ?tab=where, #rooms links) land there.
  const [jumpToRooms, setJumpToRooms] = useState(false);
  useEffect(() => {
    if (!router.isReady) return;
    const asked = router.query.tab ?? router.query.view;
    if (asked === "where" || window.location.hash === "#rooms") {
      setJumpToRooms(true);
    }
  }, [router.isReady, router.query.tab, router.query.view]);
  const pickTab = (t: Tab) => {
    if (t === "where") {
      setTab("schedule");
      setJumpToRooms(true);
    } else {
      setTab(t);
    }
  };
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
  // Booked coffee chats from the DB, live: new, moved and cancelled chats
  // show up without a reload.
  const chats = api.coffeeChatRequests.organizerChats.useQuery(undefined, {
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  return (
    <>
      <SEO title={copy.seoTitle} noindex />
      <InternalNavbar />
      <div className="min-h-screen bg-dashboard-bg-page px-4 pb-12 pt-6 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5">
        <div
          className={cn(
            "mx-auto flex w-full flex-col gap-5",
            // The day grid and the coffee chat table + side panel get room
            // for their columns; lists stay readable.
            tab === "schedule" || tab === "coffee"
              ? "max-w-[1440px]"
              : "max-w-[880px]",
          )}
        >
          <PageIntro
            eyebrow={copy.title}
            title={copy.title}
            intro={copy.intro}
          />
          {q.data && (
            <HappeningNowBanner
              items={q.data.items}
              tasks={q.data.tasks}
              now={now}
            />
          )}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <DashboardChip
                key={t}
                selected={t === tab}
                onClick={() => pickTab(t)}
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <DayPicker value={shownDay} onChange={setDay} />
                  {tab === "schedule" && (
                    <a
                      href="#rooms"
                      className="inline-flex min-h-11 items-center text-sm font-semibold text-dashboard-text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
                    >
                      {roomCopy.jump}
                    </a>
                  )}
                </div>
              )}
              {tab === "schedule" && (
                <>
                  <TimelineKey
                    mode="organizer"
                    showHackathon={showHackathon}
                    onShowHackathonChange={setShowHackathon}
                  />
                  {/* The run of show with the live coffee chat room map
                      beside it (below it, folded, on phones). */}
                  <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                    <div className="min-w-0">
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
                          ...coffeeChatEntries(
                            shownDay,
                            (chats.data?.chats ?? []).map((c) => ({
                              ...c,
                              hacker: booked.hacker(c.firstName, c.lastName),
                            })),
                          ),
                        ]}
                        workshops={q.data.workshops}
                        tasks={q.data.tasks}
                        emptyText={copy.emptyDay}
                      />
                    </div>
                    <div className="min-w-0 lg:sticky lg:top-4">
                      <CoffeeChatLiveMap now={now} />
                    </div>
                  </div>
                  <RoomsSection
                    day={shownDay}
                    jump={jumpToRooms}
                    onJumped={() => setJumpToRooms(false)}
                  />
                  <CeremonyOrder
                    segments={q.data.ceremonies}
                    items={q.data.items}
                  />
                  <WorkshopsTable workshops={q.data.workshops} />
                  <TaskPingsSection />
                </>
              )}
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

const roomCopy = coffeeChatCopy.organizer.roomTable;

// The coffee chat rooms as a booking table, right under the run of show
// (it replaced the "Where is everyone" tab, which now lands here).
function RoomsSection({
  day,
  jump,
  onJumped,
}: {
  day: RunOfShowDay;
  jump: boolean;
  onJumped: () => void;
}) {
  const board = useLiveChatBoard();
  const names = board.data?.sponsors.map((s) => s.sponsor) ?? NO_NAMES;
  const selection = useSponsorSelection(names);
  useEffect(() => {
    if (!jump) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    document
      .getElementById("rooms")
      ?.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth" });
    onJumped();
  }, [jump, onJumped]);
  return (
    <section
      id="rooms"
      aria-labelledby="rooms-heading"
      className="flex scroll-mt-4 flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2 id="rooms-heading" className="m-0 text-lg font-semibold">
          {roomCopy.heading}
        </h2>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {roomCopy.intro(ROOM_CAPACITY)}
        </p>
      </div>
      {day !== COFFEE_CHAT_DAY_LABEL ? (
        <DashboardPanel>
          <p className="m-0 text-dashboard-text-medium">{roomCopy.notToday}</p>
        </DashboardPanel>
      ) : (
        <>
          <SponsorFilter names={names} selection={selection} />
          <CoffeeChatRoomTable selection={selection} />
        </>
      )}
    </section>
  );
}

const NO_NAMES: string[] = [];

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
