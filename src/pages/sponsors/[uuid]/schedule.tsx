import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { DayPicker } from "~/components/sponsors/day-picker";
import {
  DayGrid,
  HackathonToggle,
  useShowHackathon,
} from "~/components/sponsors/day-grid";
import { chip } from "~/components/sponsors/portal-ui";
import {
  InvalidLink,
  LoadError,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { useNow } from "~/components/sponsors/use-now";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { RUN_OF_SHOW_DAYS, type RunOfShowDay } from "~/lib/run-of-show";
import { defaultRunOfShowDay } from "~/lib/run-of-show-time";
import { fetchScheduleData } from "~/lib/schedule";
import {
  buildSponsorTimeline,
  type TimelineEntry,
} from "~/lib/sponsor-timeline";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

const copy = scheduleCopy.schedule;

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

// The sponsor's Schedule (mock sponsor-chats-v3, from sponsor-today-v4): the
// run of show day grid with their own events full strength, the rest of the
// hackathon behind them, and on Saturday their confirmed coffee chats (one
// purple block per rep session, from the session setup), filterable by rep.
// Before chats are confirmed, Saturday shows one placeholder block.
export default function SponsorSchedulePage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const now = useNow();
  const [day, setDay] = useState<RunOfShowDay | null>(null);
  const [rep, setRep] = useState<string | null>(null);

  const q = api.sponsorSchedule.get.useQuery(
    { sponsor: id },
    { enabled: validUuid, refetchInterval: 60_000, retry: 1 },
  );
  // Public, cached at the edge. If it fails the run of show's own main
  // events and meals still show.
  const live = useQuery({
    queryKey: ["live-schedule"],
    queryFn: fetchScheduleData,
    refetchInterval: 60_000,
  });
  const [showHackathon, setShowHackathon] = useShowHackathon();
  // The sponsor's coffee chats (session model): sent chats with invites.
  const setupQ = api.coffeeChatSetup.get.useQuery(
    { sponsor: id },
    {
      enabled: validUuid,
      retry: 1,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    },
  );

  const shell = (children: React.ReactNode) => (
    <SponsorShell title={copy.seoTitle} heading={copy.heading} lead={copy.lead}>
      {children}
    </SponsorShell>
  );

  if (!router.isReady || (validUuid && q.isLoading)) {
    return shell(<ScheduleSkeleton />);
  }
  if (!validUuid || q.error?.data?.code === "NOT_FOUND") {
    return shell(<InvalidLink />);
  }
  if (!q.data) return shell(<LoadError onRetry={() => void q.refetch()} />);

  const data = q.data;
  const setup = setupQ.data;
  // ?day=saturday opens a given day (shareable); otherwise today.
  const linkedDay = RUN_OF_SHOW_DAYS.find(
    (d) => d.toLowerCase() === String(router.query.day ?? "").toLowerCase(),
  );
  const shownDay = day ?? linkedDay ?? defaultRunOfShowDay(now);
  const confirmed = !!setup?.confirmed && setup.chats.length > 0;
  const repName = (repId: string) =>
    setup?.reps.find((r) => r.id === repId)?.name ?? "";
  const chatReps =
    setup?.reps.filter((r) => setup.chats.some((c) => c.repId === r.id)) ?? [];
  const chatEntries: TimelineEntry[] =
    shownDay !== "Saturday" || !setup
      ? []
      : confirmed
        ? setup.chats
            .filter((c) => rep === null || c.repId === rep)
            .map((c) => {
              const room = copy.chatRoom(c.room, c.building === "ivey");
              return {
                id: `chat-${c.placementId}`,
                kind: "yours" as const,
                category: "coffee-chat" as const,
                title: copy.chatTitle(repName(c.repId)),
                location: room,
                ivey: c.building === "ivey",
                start: minutesOf(c.start),
                end: minutesOf(c.end),
                booking: {
                  sponsorName: data.sponsorName,
                  room,
                  slotTime: c.start,
                  chats: c.hackers.map((h, i) => ({
                    chatId: `${c.placementId}-${i}`,
                    hacker: h.firstName,
                    status: h.status,
                  })),
                },
              };
            })
        : [
            {
              id: "chat-placeholder",
              kind: "yours" as const,
              category: "coffee-chat" as const,
              title: copy.chatsPlaceholder,
              location: null,
              start: 600,
              end: 1020,
            },
          ];
  // The run of show's own coffee chat row is replaced by the sponsor's chats.
  const entries = [
    ...buildSponsorTimeline({
      day: shownDay,
      items: data.items,
      live: live.data,
      sponsorName: data.sponsorName,
      showHackathon,
    }).filter((e) => !(e.category === "coffee-chats" && e.kind === "yours")),
    ...chatEntries,
  ];

  return shell(
    <>
      {shownDay === "Saturday" && confirmed && (
        <div className="flex flex-col gap-3">
          <div
            role="group"
            aria-label={copy.repsLabel}
            className="flex flex-wrap gap-2"
          >
            {[{ id: null, name: copy.everyone }, ...chatReps].map((r) => (
              <button
                key={r.id ?? "all"}
                type="button"
                aria-pressed={rep === r.id}
                className={chip(rep === r.id)}
                onClick={() => setRep(r.id)}
              >
                {/* First names fit the chips, as in the mock. */}
                {r.id ? (r.name.split(/\s+/)[0] ?? r.name) : r.name}
              </button>
            ))}
          </div>
          <p className="m-0 flex flex-wrap gap-4 text-[13px] text-dashboard-text-medium">
            <span className="inline-flex items-center gap-1.5">
              <i
                aria-hidden
                className="inline-block h-3.5 w-2.5 rounded-sm border-l-4 border-dashboard-chat-line bg-dashboard-chat-tint"
              />
              {copy.legendChats}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i
                aria-hidden
                className="inline-block h-3.5 w-2.5 rounded-sm border-l-4 border-dashboard-action-primary bg-dashboard-bg-surface"
              />
              {copy.legendEvents}
            </span>
          </p>
        </div>
      )}
      <div data-tour="schedule-grid" className="min-w-0">
        <DayGrid
          day={shownDay}
          entries={entries}
          now={now}
          headerStart={
            <DayPicker
              value={shownDay}
              onChange={setDay}
              large
              tourId="schedule-days"
            />
          }
          headerEnd={
            <span data-tour="schedule-hackathon" className="inline-flex">
              <HackathonToggle
                showHackathon={showHackathon}
                onShowHackathonChange={setShowHackathon}
              />
            </span>
          }
          sponsorName={data.sponsorName}
          workshops={data.workshops}
        />
      </div>
    </>,
  );
}
