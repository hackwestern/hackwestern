import { SPONSOR_MAP_FLOORS } from "~/lib/sponsor-map-rooms";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { CeremonyOrder } from "~/components/sponsors/ceremony-order";
import {
  CoffeeChatRoomTable,
  useLiveChatBoard,
} from "~/components/sponsors/coffee-chat-room-table";
import {
  DayGrid,
  HackathonToggle,
  OrganizersToggle,
  useShowHackathon,
  useShowOrganizers,
} from "~/components/sponsors/day-grid";
import { DayPicker } from "~/components/sponsors/day-picker";
import { JudgingPanel } from "~/components/sponsors/organizer/judging-panel";
import { ReadAt } from "~/components/sponsors/schedule-states";
import { SheetEditButton } from "~/components/sponsors/sheet-edit-button";
import { SponAvailabilityTable } from "~/components/sponsors/organizer/spon-availability";
import {
  SponsorFilter,
  useSponsorSelection,
} from "~/components/sponsors/sponsor-filter";
import { WorkshopsTable } from "~/components/sponsors/workshop-details";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { COFFEE_CHAT_DAY_LABEL } from "~/lib/coffee-chats";
import type { RunOfShowDay } from "~/lib/run-of-show";
import { defaultRunOfShowDay } from "~/lib/run-of-show-time";
import { fetchScheduleData } from "~/lib/schedule";
import { coffeeChatEntries } from "~/lib/schedule-bookings";
import { JUDGING_DEFAULT_DAY } from "~/lib/sponsor-judging-rooms";
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
  const [showOrganizers, setShowOrganizers] = useShowOrganizers();
  // Booked coffee chats from the DB, live: new, moved and cancelled chats
  // show up without a reload.
  const chats = api.coffeeChatRequests.organizerChats.useQuery(undefined, {
    refetchInterval: LIVE_REFRESH_MS,
    refetchOnWindowFocus: true,
  });
  const board = useLiveChatBoard();
  // Same query (and cache) as the page's sponsor summary: the Sunday
  // judging board rides along with it.
  const summary = api.sponsorOrganizer.summary.useQuery(undefined, {
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const judging = summary.data?.judging;
  // Shown on the day the judging block falls on (Sunday without one).
  const judgingDay = judging?.day ?? JUDGING_DEFAULT_DAY;
  const names = board.data?.sponsors.map((s) => s.sponsor) ?? NO_NAMES;
  const selection = useSponsorSelection(
    names,
    sponsorNameForParam(sponsor, board.data?.sponsors ?? []),
  );

  return (
    <>
      {/* Only wrap a real button: an empty wrapper still has width, so the
          tour would ring a blank strip instead of falling back to a
          centred callout. */}
      {data.sheetUrl && (
        <div data-tour="ros-sheet">
          <SheetEditButton href={data.sheetUrl} />
        </div>
      )}
      {SHOW_ROOM_BLOCKS && shownDay === COFFEE_CHAT_DAY_LABEL && (
        <div className="flex justify-end">
          <DashboardButton variant="link" asChild className="-mr-2">
            <a href="#rooms">{roomCopy.jump}</a>
          </DashboardButton>
        </div>
      )}
      {/* Saturday: which sponsors' coffee chats the run of show lists. */}
      {shownDay === COFFEE_CHAT_DAY_LABEL && (
        <SponsorFilter names={names} selection={selection} />
      )}
      {/* The run of show gets the full width so its columns fit without
          sideways scrolling; the live room map sits with the rooms below. */}
      <div data-tour="ros-grid" className="min-w-0">
        <DayGrid
          mode="organizer"
          day={shownDay}
          now={now}
          headerStart={
            <DayPicker value={shownDay} onChange={setDay} tourId="ros-days" />
          }
          headerEnd={
            <div
              data-tour="ros-toggles"
              className="flex flex-wrap items-center gap-x-4"
            >
              {data.availability.organizers.length > 0 && (
                <OrganizersToggle
                  showOrganizers={showOrganizers}
                  onShowOrganizersChange={setShowOrganizers}
                />
              )}
              <HackathonToggle
                showHackathon={showHackathon}
                onShowHackathonChange={setShowHackathon}
              />
            </div>
          }
          availability={showOrganizers ? data.availability : null}
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
      {/* The sponsor team's free hours for the same day (Jazz, 2026-11-18). */}
      <SponAvailabilityTable
        availability={data.availability}
        day={shownDay}
        items={data.items}
      />

      {/* Coffee chats are Saturday only: other days have no rooms section. */}
      {SHOW_ROOM_BLOCKS && shownDay === COFFEE_CHAT_DAY_LABEL && (
        <RoomsSection jump={jumpToRooms} onJumped={onJumped} />
      )}
      {/* Not while loading: the day isn't known yet (no Sunday flash). */}
      {!summary.isLoading && shownDay === judgingDay && (
        <JudgingPanel
          board={judging}
          failed={summary.isError}
          sheetUrl={data.sheetUrl}
        />
      )}
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

/**
 * The run of show's extra sections for one day, on the organizer Home
 * under the sponsor table (Jazz, 2026-11-19: the Full run of show tool is
 * gone; Home's "Your day" already has the grid): the spon team's free
 * hours, Sunday judging rooms, the ceremony running order, that day's
 * workshops, the sheet link and when it was read.
 */
export function RunOfShowExtras({
  data,
  day,
}: {
  data: OrganizerSchedule;
  day: RunOfShowDay;
}) {
  // Same query (and cache) as the page's sponsor summary.
  const summary = api.sponsorOrganizer.summary.useQuery(undefined, {
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const judging = summary.data?.judging;
  const judgingDay = judging?.day ?? JUDGING_DEFAULT_DAY;
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <SponAvailabilityTable
        availability={data.availability}
        day={day}
        items={data.items}
      />
      {!summary.isLoading && day === judgingDay && (
        <JudgingPanel
          board={judging}
          failed={summary.isError}
          sheetUrl={data.sheetUrl}
        />
      )}
      <CeremonyOrder
        segments={ceremonySegmentsForDay(data.ceremonies, data.items, day)}
        items={data.items}
      />
      <WorkshopsTable workshops={workshopsForDay(data.workshops, day)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReadAt iso={data.readAt} />
        {data.sheetUrl && <SheetEditButton href={data.sheetUrl} />}
      </div>
    </div>
  );
}

/**
 * The old coffee chat room-block editor (room-blocks.tsx, add-coffee-chat.tsx
 * via CoffeeChatRoomTable) is hidden: the Coffee chats tab's session board
 * replaces it (decisions 2026-11-19). The code stays; flip to show it again.
 */
const SHOW_ROOM_BLOCKS = false;

// The coffee chat rooms as a booking table, right under the run of show,
// with the floor 2 plan beside it (it replaced the "Where is everyone"
// tab, which now lands here: #rooms). No heading or intro. The sponsor
// strip highlights a sponsor's blocks, as on the Coffee chats tab.
function RoomsSection({
  jump,
  onJumped,
}: {
  jump: boolean;
  onJumped: () => void;
}) {
  const [highlight, setHighlight] = useState<string | null>(null);
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
      aria-label={roomCopy.heading}
      className="flex scroll-mt-4 flex-col gap-3"
    >
      {/* The room table with the live floor map beside it (below it on
          phones and tablets). */}
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <CoffeeChatRoomTable
            highlight={highlight}
            onHighlight={(name) =>
              setHighlight((h) => (h === name ? null : name))
            }
            onClearHighlight={() => setHighlight(null)}
          />
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
