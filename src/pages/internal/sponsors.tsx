import { useMemo } from "react";
import SEO from "~/components/seo";
import { InternalNavbar } from "~/components/internals/navbar";
import { CoffeeSessionsTab } from "~/components/sponsors/organizer/coffee-sessions/coffee-sessions-tab";
import { JudgingTab } from "~/components/sponsors/organizer/judging-tab";
import {
  OrganizerTabList,
  panelId,
  SponsorFocusBar,
  tabId,
  useOrganizerLocation,
} from "~/components/sponsors/organizer/organizer-tabs";
import { RunOfShowTab } from "~/components/sponsors/organizer/run-of-show-tab";
import { SponsorsTab } from "~/components/sponsors/organizer/sponsors-tab";
import { TaskPingsTab } from "~/components/sponsors/organizer/task-pings-tab";
import { OrganizerTour } from "~/components/sponsors/tour/organizer-tour";
import { HappeningNowBanner } from "~/components/sponsors/happening-now";
import {
  LoadError,
  PageIntro,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { useNow } from "~/components/sponsors/use-now";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import {
  organizerHomeHref,
  type SponsorSummary,
} from "~/lib/sponsor-organizer";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

const copy = sponsorOrganizerCopy;
/** Chats and help on the sponsor rows: as fresh as the help queue. */
const SUMMARY_REFRESH_MS = 15_000;

// The organizer sponsor home: Lucas's sponsor board plus the run of show,
// coffee chats, sponsor judging and task pings (with the help queue), as tabs in the URL (?tab=, ?sponsor=). Each
// sponsor row links into the other tabs focused on that sponsor, and they
// link back to the row (docs/flows/sponsor-organizer.md).
export default function SponsorOrganizerHome() {
  const now = useNow();
  const loc = useOrganizerLocation();
  const schedule = api.sponsorSchedule.organizer.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });
  const summary = api.sponsorOrganizer.summary.useQuery(undefined, {
    refetchInterval: SUMMARY_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const summaries = useMemo(
    () =>
      new Map<string, SponsorSummary>(
        (summary.data?.sponsors ?? []).map((s) => [
          s.sponsorId.toLowerCase(),
          s,
        ]),
      ),
    [summary.data],
  );
  const focusName = loc.sponsor
    ? (summaries.get(loc.sponsor.toLowerCase())?.name ??
      summary.data?.sponsors.find((s) => s.name === loc.sponsor)?.name ??
      null)
    : null;
  const focusId = loc.sponsor
    ? (summary.data?.sponsors.find(
        (s) => s.name === loc.sponsor || s.sponsorId === loc.sponsor,
      )?.sponsorId ?? loc.sponsor)
    : null;
  const tab = loc.tab;

  return (
    <>
      <SEO title={copy.seoTitle} noindex />
      <InternalNavbar />
      <div className="min-h-screen bg-dashboard-bg-page px-4 pb-12 pt-6 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5">
        <div
          className={cn(
            "mx-auto flex w-full flex-col gap-5",
            // The day grid and the coffee chat tables get room for their
            // columns; the help list and ping log stay readable.
            tab === "pings" ? "max-w-[880px]" : "max-w-[1440px]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <PageIntro
                eyebrow={copy.eyebrow}
                title={copy.title}
                intro={copy.intro}
              />
            </div>
            {/* Tours the open tab; offers it once per tab. */}
            <OrganizerTour tab={tab} />
          </div>
          {/* On every tab. If the sheet is down the banner just isn't there;
              the Run of show tab says why. */}
          {schedule.data && (
            <HappeningNowBanner
              items={schedule.data.items}
              tasks={schedule.data.tasks}
              now={now}
            />
          )}
          <OrganizerTabList
            tab={tab}
            onSelect={loc.selectTab}
            openHelp={summary.data?.openHelp ?? 0}
          />
          <div
            role="tabpanel"
            id={panelId(tab)}
            aria-labelledby={tabId(tab)}
            className="flex min-w-0 flex-col gap-5"
          >
            {tab !== "sponsors" && focusId && (
              <SponsorFocusBar tab={tab} sponsorId={focusId} name={focusName} />
            )}
            {tab === "sponsors" ? (
              <SponsorsTab
                summaries={summaries}
                summaryLoading={summary.isLoading}
                summaryFailed={!summary.data && summary.isError}
                round2Open={summary.data?.round2Open ?? false}
                items={schedule.data?.items ?? null}
                now={now}
              />
            ) : tab === "pings" ? (
              <TaskPingsTab
                focusSponsorId={focusId}
                focusName={focusName}
                sponsorHref={(id) =>
                  organizerHomeHref({ tab: "sponsors", sponsor: id })
                }
                jumpToHelp={loc.jumpToHelp}
              />
            ) : tab === "coffee" ? (
              <CoffeeSessionsTab sponsor={loc.sponsor} />
            ) : tab === "judging" ? (
              <JudgingTab sponsor={focusId} />
            ) : schedule.isLoading ? (
              <ScheduleSkeleton />
            ) : !schedule.data ? (
              <LoadError onRetry={() => void schedule.refetch()} />
            ) : (
              <RunOfShowTab
                data={schedule.data}
                now={now}
                jumpToRooms={loc.jumpToRooms}
                onJumped={loc.onJumped}
                sponsor={loc.sponsor}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;
