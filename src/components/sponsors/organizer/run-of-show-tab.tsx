import { SPONSOR_MAP_FLOORS } from "~/lib/sponsor-map-rooms";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { CeremonyOrder } from "~/components/sponsors/ceremony-order";
import {
  CoffeeChatRoomTable,
  useLiveChatBoard,
} from "~/components/sponsors/coffee-chat-room-table";
import {
  DayGrid,
  TimelineKey,
  useShowHackathon,
} from "~/components/sponsors/day-grid";
import { DayPicker } from "~/components/sponsors/day-picker";
import { ReadAt } from "~/components/sponsors/schedule-states";
import { SheetEditButton } from "~/components/sponsors/sheet-edit-button";
import {
  SponsorFilter,
  type SponsorSelection,
  useSponsorSelection,
} from "~/components/sponsors/sponsor-filter";
import { WorkshopsTable } from "~/components/sponsors/workshop-details";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { ROOM_CAPACITY } from "~/lib/coffee-chat-room-table";
import { COFFEE_CHAT_DAY_LABEL } from "~/lib/coffee-chats";
import type { RunOfShowDay } from "~/lib/run-of-show";
import { defaultRunOfShowDay } from "~/lib/run-of-show-time";
import { fetchScheduleData } from "~/lib/schedule";
import { coffeeChatEntries } from "~/lib/schedule-bookings";
import { sponsorNameForParam } from "~/lib/sponsor-organizer";
import { buildOrganizerTimeline, taskEntries } from "~/lib/sponsor-timeline";
import {
  ceremonySegmentsForDay,
  workshopsForDay,
} from "~/lib/sponsor-next-event";
import { api, type RouterOutputs } from "~/utils/api";

const copy = scheduleCopy.organizer;
const roomCopy = coffeeChatCopy.organizer.roomTable;
// The coffee chat rooms (Rm 2241-2243) are on floor 2.
const FLOOR_2 = SPONSOR_MAP_FLOORS[1];
const booked = coffeeChatCopy.organizer;
/** How often booked coffee chats refresh on the schedule. */
const LIVE_REFRESH_MS = 15_000;
const NO_NAMES: string[] = [];

export type OrganizerSchedule = RouterOutputs["sponsorSchedule"]["organizer"];

// Organizer run of show: the whole sheet, read-only, with team tasks, at
// full width; the room booking table and live coffee chat map under it. Edits
// happen in the sheet (SheetEditButton). `sponsor` (an id or name, from
// ?sponsor=) sets the sponsor filter, which narrows the coffee chats on the
// grid and in the rooms table.
export function RunOfShowTab({
  data,
  now,
  jumpToRooms,
  onJumped,
  sponsor,
}: {
  data: OrganizerSchedule;
  now: Date;
  jumpToRooms: boolean;
  onJumped: () => void;
  sponsor: string | null;
}) {
  const [day, setDay] = useState<RunOfShowDay | null>(null);
  const shownDay = day ?? defaultRunOfShowDay(now);
  // The public /live schedule, muted behind the run of show (same toggle
  // as the sponsor view). If it fails the run of show still shows.
  const live = useQuery({
    queryKey: ["live-schedule"],
    queryFn: fetchScheduleData,
    refetchInterval: 60_000,
  });
  const [showHackathon, setShowHackathon] = useShowHackathon();
  // Booked coffee chats from the DB, live: new, moved and cancelled chats
  // show up without a reload.
  const chats = api.coffeeChatRequests.organizerChats.useQuery(undefined, {
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const board = useLiveChatBoard();
  const names = board.data?.sponsors.map((s) => s.sponsor) ?? NO_NAMES;
  const selection = useSponsorSelection(
    names,
    sponsorNameForParam(sponsor, board.data?.sponsors ?? []),
  );

  return (
    <>
      <SheetEditButton href={data.sheetUrl} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DayPicker value={shownDay} onChange={setDay} />
        <DashboardButton variant="link" asChild className="-mr-2">
          <a href="#rooms">{roomCopy.jump}</a>
        </DashboardButton>
      </div>
      <TimelineKey
        mode="organizer"
        showHackathon={showHackathon}
        onShowHackathonChange={setShowHackathon}
      />
      {/* The run of show gets the full width so its columns fit without
          sideways scrolling; the live room map sits with the rooms below. */}
      <div className="min-w-0">
        <DayGrid
          mode="organizer"
          day={shownDay}
          now={now}
          entries={[
            ...buildOrganizerTimeline({
              day: shownDay,
              items: data.items,
              live: live.data,
              showHackathon,
            }),
            ...taskEntries(shownDay, data.tasks),
            ...coffeeChatEntries(
              shownDay,
              (chats.data?.chats ?? [])
                .filter((c) => selection.isShown(c.sponsorName))
                .map((c) => ({
                  ...c,
                  hacker: booked.hacker(c.firstName, c.lastName),
                })),
            ),
          ]}
          workshops={data.workshops}
          tasks={data.tasks}
          emptyText={copy.emptyDay}
        />
      </div>
      <RoomsSection
        day={shownDay}
        names={names}
        selection={selection}
        jump={jumpToRooms}
        onJumped={onJumped}
      />
      {/* Only the picked day's ceremony and workshops (Jazz, 2026-11-18). */}
      <CeremonyOrder
        segments={ceremonySegmentsForDay(data.ceremonies, data.items, shownDay)}
        items={data.items}
      />
      <WorkshopsTable workshops={workshopsForDay(data.workshops, shownDay)} />
      <ReadAt iso={data.readAt} />
    </>
  );
}

// The coffee chat rooms as a booking table, right under the run of show,
// with the floor 2 plan beside it (it replaced the "Where is everyone"
// tab, which now lands here: #rooms).
function RoomsSection({
  day,
  names,
  selection,
  jump,
  onJumped,
}: {
  day: RunOfShowDay;
  names: readonly string[];
  selection: SponsorSelection;
  jump: boolean;
  onJumped: () => void;
}) {
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
      {/* The room table with the live floor map beside it (below it on
          phones and tablets). */}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          {day !== COFFEE_CHAT_DAY_LABEL ? (
            <DashboardPanel>
              <p className="m-0 text-dashboard-text-medium">
                {roomCopy.notToday}
              </p>
            </DashboardPanel>
          ) : (
            <>
              <SponsorFilter names={names} selection={selection} />
              <CoffeeChatRoomTable selection={selection} />
            </>
          )}
        </div>
        {/* Just the floor plan for reference (Jazz, 2026-11-18): no pins,
            toggles or live state. */}
        <div className="min-w-0 xl:sticky xl:top-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- static
              plan image at its natural size; no optimisation needed */}
          <img
            src={FLOOR_2.image}
            width={FLOOR_2.width}
            height={FLOOR_2.height}
            alt={roomCopy.floorPlanAlt}
            loading="lazy"
            className="h-auto w-full rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card"
          />
        </div>
      </div>
    </section>
  );
}
