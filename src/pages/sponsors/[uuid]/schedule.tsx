import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import Link from "next/link";
import { ScanLine } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { CeremonyOrder } from "~/components/sponsors/ceremony-order";
import { CoffeeChatSummary } from "~/components/sponsors/coffee-chat-summary";
import { DayPicker } from "~/components/sponsors/day-picker";
import { SponsorHelp } from "~/components/sponsors/help-button";
import { HappeningNowBanner } from "~/components/sponsors/happening-now";
import { NextEventCard } from "~/components/sponsors/next-event-card";
import { RepCount } from "~/components/sponsors/rep-count";
import {
  DayGrid,
  TimelineKey,
  useShowHackathon,
} from "~/components/sponsors/day-grid";
import {
  InvalidLink,
  LoadError,
  PageIntro,
  ReadAt,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { useNow } from "~/components/sponsors/use-now";
import { WorkshopDetails } from "~/components/sponsors/workshop-details";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { RUN_OF_SHOW_DAYS, type RunOfShowDay } from "~/lib/run-of-show";
import { defaultRunOfShowDay } from "~/lib/run-of-show-time";
import { fetchScheduleData } from "~/lib/schedule";
import { nextOwnEvent } from "~/lib/sponsor-next-event";
import { buildSponsorTimeline } from "~/lib/sponsor-timeline";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

const copy = scheduleCopy.schedule;

// A sponsor's own schedule from the run-of-show sheet (read-only; the sheet
// is the source of truth), laid over the hackathon's public schedule (the
// one /live shows, from /api/schedule). Refreshes every minute.
export default function SponsorSchedulePage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const now = useNow();
  const [day, setDay] = useState<RunOfShowDay | null>(null);

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

  const shell = (children: React.ReactNode) => (
    <SponsorShell
      wide
      title={copy.seoTitle}
      backHref={validUuid ? `/sponsors/${id}` : undefined}
    >
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
  // ?day=saturday opens a given day (shareable); otherwise today.
  const linkedDay = RUN_OF_SHOW_DAYS.find(
    (d) => d.toLowerCase() === String(router.query.day ?? "").toLowerCase(),
  );
  const shownDay = day ?? linkedDay ?? defaultRunOfShowDay(now);
  const entries = buildSponsorTimeline({
    day: shownDay,
    items: data.items,
    live: live.data,
    sponsorName: data.sponsorName,
    showHackathon,
  });
  const nextEvent = nextOwnEvent({
    sponsorName: data.sponsorName,
    items: data.items,
    ceremonies: data.ceremonies,
    coffeeChat: data.coffeeChat,
    now,
  });

  return shell(
    <>
      <PageIntro
        eyebrow={copy.eyebrow}
        title={copy.title(data.sponsorName)}
        intro={copy.intro}
      />
      <HappeningNowBanner
        items={data.items}
        now={now}
        sponsorName={data.sponsorName}
      />
      <NextEventCard event={nextEvent} />
      <SponsorHelp sponsor={id} />
      {shownDay === "Saturday" && (
        <>
          <CoffeeChatSummary setup={data.coffeeChat} />
          <RepCount sponsor={id} groupSize={data.coffeeChat?.groupSize ?? 1} />
          <nav
            aria-label={coffeeChatCopy.hub.linksLabel}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <DashboardButton asChild className="md:h-11 md:w-full">
              <Link href={`/sponsors/${id}/scan`}>
                <ScanLine aria-hidden />
                {coffeeChatCopy.hub.scan}
              </Link>
            </DashboardButton>
            <DashboardButton variant="outline" asChild className="h-11 w-full">
              <Link href={`/sponsors/${id}/coffee-chats`}>
                {coffeeChatCopy.hub.list}
              </Link>
            </DashboardButton>
          </nav>
        </>
      )}
      <DayPicker value={shownDay} onChange={setDay} />
      <TimelineKey
        showHackathon={showHackathon}
        onShowHackathonChange={setShowHackathon}
      />
      <DayGrid
        day={shownDay}
        entries={entries}
        now={now}
        sponsorName={data.sponsorName}
        workshops={data.workshops}
      />
      <WorkshopDetails workshops={data.workshops} />
      <CeremonyOrder segments={data.ceremonies} items={data.items} />
      <ReadAt iso={data.readAt} />
    </>,
  );
}
