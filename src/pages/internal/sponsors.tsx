import { useMemo } from "react";
import { useRouter } from "next/router";
import SEO from "~/components/seo";
import { InternalNavbar } from "~/components/internals/navbar";
import { CoffeeSessionsTab } from "~/components/sponsors/organizer/coffee-sessions/coffee-sessions-tab";
import { JudgingTab } from "~/components/sponsors/organizer/judging-tab";
import { OrganizerHome } from "~/components/sponsors/organizer/organizer-home";
import { OrganizerNav } from "~/components/sponsors/organizer/organizer-nav";
import {
  SponsorFocusBar,
  useOrganizerLocation,
} from "~/components/sponsors/organizer/organizer-tabs";
import { RunOfShowTab } from "~/components/sponsors/organizer/run-of-show-tab";
import { useSheetSponsors } from "~/components/sponsors/organizer/use-sponsor-writes";
import { OrganizerTour } from "~/components/sponsors/tour/organizer-tour";
import {
  LoadError,
  PageIntro,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { useNow } from "~/components/sponsors/use-now";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import { organizerTourIdFor } from "~/lib/organizer-tours";
import { leadsSponsor, type SponsorSummary } from "~/lib/sponsor-organizer";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

const copy = sponsorOrganizerCopy;
/** Chats on the sponsor rows. */
const SUMMARY_REFRESH_MS = 15_000;

// The organizer sponsor dashboard. Home (no ?tab=) is the day view (mock
// organizer-sponsors-home-v3, decisions 2026-11-19): Fri · Sat · Sun, Up
// next, your day and that day's sponsor table, Your sponsors or All sponsors
// (?list=all). The Tools menu opens the coffee chat board (?tab=coffee),
// the judging board (?tab=judging) and the full run of show
// (?tab=schedule), each with ?sponsor= focus and a way back to Home. The
// old Sponsors board, Needs attention and Task pings code stays in the repo
// unrendered.
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
  // The Home's sheet rows (status pills, HW leads), with its own recent
  // writes kept over an older server copy.
  const sheetSponsors = useSheetSponsors();
  const me = mine.data?.me ?? null;
  const contactNames = useMemo(
    () => mine.data?.contactNames ?? [],
    [mine.data?.contactNames],
  );
  // My sponsors unless ?list=all, or no HW Contacts match, or they lead no
  // sponsor (then All sponsors, with My sponsors one tap away).
  const leadsAny =
    !!me &&
    (sheetSponsors.data ?? []).some((s) =>
      leadsSponsor(s.hwContact, me, contactNames),
    );
  const view: "mine" | "all" =
    me &&
    router.query.list !== "all" &&
    (leadsAny || router.query.list === "mine")
      ? "mine"
      : "all";
  const setView = (v: "mine" | "all") => {
    const query = { ...router.query };
    if (v === "all") query.list = "all";
    else if (leadsAny) delete query.list;
    else query.list = "mine";
    void router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
      scroll: false,
    });
  };
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
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <OrganizerNav tab={tab} sponsor={focusId} />
            {/* Tours the open tool; Home's day view has no tour yet. */}
            {tab !== "sponsors" && (
              <OrganizerTour tab={organizerTourIdFor(tab, false)} />
            )}
          </div>
          {tab === "sponsors" ? (
            <OrganizerHome
              now={now}
              me={me}
              contactNames={contactNames}
              contactsError={mine.data?.contactsError ?? false}
              sheet={sheetSponsors.data}
              sheetFailed={!sheetSponsors.data && sheetSponsors.isError}
              summaries={summaries}
              mine={mine.data?.sponsors}
              schedule={schedule.data}
              scheduleFailed={!schedule.data && schedule.isError}
              round2Open={summary.data?.round2Open ?? false}
              prizeTracks={summary.data?.prizeTracks ?? undefined}
              view={view}
              onView={setView}
            />
          ) : (
            <main className="flex min-w-0 flex-col gap-5">
              <PageIntro
                eyebrow={copy.eyebrow}
                title={copy.home.nav[tab]}
                intro={copy.home.toolIntro}
              />
              {focusId && (
                <SponsorFocusBar
                  tab={tab}
                  sponsorId={focusId}
                  name={focusName}
                />
              )}
              {tab === "coffee" ? (
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
            </main>
          )}
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;
