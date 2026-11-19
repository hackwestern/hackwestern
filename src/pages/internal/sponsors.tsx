import { useMemo } from "react";
import { useRouter } from "next/router";
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
import { NowAndNextPanel } from "~/components/sponsors/organizer/now-and-next";
import { OrganizerTour } from "~/components/sponsors/tour/organizer-tour";
import {
  LoadError,
  PageIntro,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { useNow } from "~/components/sponsors/use-now";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import { TASK_MINUTES } from "~/lib/happening-now";
import { organizerTourIdFor } from "~/lib/organizer-tours";
import { runOfShowInstant } from "~/lib/run-of-show-time";
import {
  leadsSponsor,
  needsAttention,
  type SponsorSummary,
} from "~/lib/sponsor-organizer";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

const copy = sponsorOrganizerCopy;
/** Chats on the sponsor rows. */
const SUMMARY_REFRESH_MS = 15_000;

// The organizer sponsor home: "Needs attention now" and "Now and next" on
// top, then the tabs in the URL (?tab=, ?sponsor=): Sponsors (My sponsors,
// or Lucas's All sponsors board with ?list=all), the run of show, coffee
// chats and sponsor judging. Task pings is switched off (decisions
// 2026-11-19); its tab code stays in the repo. Each sponsor row links into
// the other tabs focused on that sponsor (docs/flows/sponsor-organizer.md).
export default function SponsorOrganizerHome() {
  const now = useNow();
  const router = useRouter();
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
  const mine = api.sponsorOrganizer.mySponsors.useQuery(undefined, {
    refetchInterval: SUMMARY_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  // Same query (and cache) as the Sponsors tab's board, for the HW leads.
  const sheetSponsors = api.sponsorDashboard.getSponsors.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const me = mine.data?.me ?? null;
  // My sponsors unless ?list=all (or no HW Contacts match).
  const view: "mine" | "all" =
    me && router.query.list !== "all" ? "mine" : "all";
  const setView = (v: "mine" | "all") => {
    const query = { ...router.query };
    if (v === "all") query.list = "all";
    else delete query.list;
    void router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
      scroll: false,
    });
  };
  const attention = useMemo(() => {
    if (!mine.data || !summary.data) return null;
    const myIds = me
      ? new Set(
          (sheetSponsors.data ?? [])
            .filter((s) => s.sponsorId && leadsSponsor(s.hwContact, me))
            .map((s) => s.sponsorId!),
        )
      : null;
    const scoped =
      myIds && myIds.size > 0
        ? summary.data.sponsors.filter((s) => myIds.has(s.sponsorId))
        : summary.data.sponsors;
    return needsAttention({
      sponsors: scoped.flatMap((s) => {
        const d = mine.data.sponsors[s.sponsorId];
        return d
          ? [{ sponsorId: s.sponsorId, name: s.name, chats: d.chats }]
          : [];
      }),
      tasks: schedule.data?.tasks ?? [],
      now,
      taskStart: (t) => runOfShowInstant(t.day, t.start),
      taskMinutes: TASK_MINUTES,
    });
  }, [mine.data, summary.data, sheetSponsors.data, me, schedule.data, now]);
  const attentionScope: "yours" | "everyone" =
    me &&
    (sheetSponsors.data ?? []).some(
      (s) => s.sponsorId && leadsSponsor(s.hwContact, me),
    )
      ? "yours"
      : "everyone";
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
            // columns; My sponsors' two-column tables stay readable.
            tab === "sponsors" && view === "mine"
              ? "max-w-[960px]"
              : "max-w-[1440px]",
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
            <OrganizerTour tab={organizerTourIdFor(tab, view === "mine")} />
          </div>
          {/* On every tab: Needs attention now, then Now and next. */}
          <NowAndNextPanel
            items={schedule.data?.items ?? null}
            tasks={schedule.data?.tasks ?? null}
            now={now}
            attention={attention}
            attentionScope={attentionScope}
            scheduleFailed={!schedule.data && schedule.isError}
          />
          <OrganizerTabList tab={tab} onSelect={loc.selectTab} />
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
                workshops={schedule.data?.workshops ?? null}
                now={now}
                me={me}
                mine={mine.data?.sponsors}
                view={view}
                onView={setView}
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
