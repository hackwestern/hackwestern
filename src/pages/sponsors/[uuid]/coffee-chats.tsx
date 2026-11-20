import Link from "next/link";
import { useRouter } from "next/router";
import { ScanLine } from "lucide-react";
import { btn } from "~/components/sponsors/portal-ui";
import { ChatsHome } from "~/components/sponsors/coffee-setup/chats-home";
import { PrefsStep } from "~/components/sponsors/coffee-setup/prefs-step";
import { ReviewStep } from "~/components/sponsors/coffee-setup/review-step";
import {
  BackToChats,
  FlowHeader,
} from "~/components/sponsors/coffee-setup/shared";
import { ShortlistFlow } from "~/components/sponsors/coffee-setup/shortlist-flow";
import { AvailabilitySummary } from "~/components/sponsors/coffee-setup/submitted-summary";
import { TeamStep } from "~/components/sponsors/coffee-setup/team-step";
import {
  InvalidLink,
  LoadError,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorSetupCopy as copy } from "~/content/sponsor-coffee-setup";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

type Screen =
  | { flow: "home" }
  | { flow: "prefs"; step: 1 | 2 | 3 }
  | { flow: "shortlist"; step: 1 | 2 };

function screenOf(
  query: Record<string, string | string[] | undefined>,
): Screen {
  const step = Number(query.step);
  if (query.flow === "prefs") {
    return { flow: "prefs", step: step === 2 || step === 3 ? step : 1 };
  }
  if (query.flow === "shortlist") {
    return { flow: "shortlist", step: step === 2 ? 2 : 1 };
  }
  return { flow: "home" };
}

// The sponsor's coffee chats (session model, docs/specs/coffee-chat-
// sessions.md; design mocks/sponsor-chats-v3): the Chats page, one stage at
// a time, then two flows picked by ?flow=: Send availability (Your team →
// Availability → Review & submit) and the shortlist (Shortlist hackers →
// Review & submit).
export default function SponsorCoffeeChatsPage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const q = api.coffeeChatSetup.get.useQuery(
    { sponsor: id },
    {
      enabled: validUuid,
      retry: 1,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    },
  );

  // Chats: "Coffee chats" is the page heading, with "Scan a hacker" on its
  // right from tablets up. The flows have their own h1 (FlowHeader) under
  // "Back to Coffee chats".
  const base = `/sponsors/${id}/coffee-chats`;
  const inFlow =
    router.query.flow === "prefs" || router.query.flow === "shortlist";
  const shell = (children: React.ReactNode) =>
    inFlow ? (
      <SponsorShell title={copy.seoTitle}>
        <BackToChats href={base} />
        {children}
      </SponsorShell>
    ) : (
      <SponsorShell
        title={copy.seoTitle}
        heading={copy.home.title}
        headerEnd={
          // Only once the URL is read: no "/sponsors//scan" link.
          validUuid && (
            <Link
              href={`/sponsors/${id}/scan`}
              className={cn(
                btn.primary,
                "min-h-14 rounded-dashboard-2xl px-6 text-[17px] font-bold [&_svg]:size-6",
              )}
            >
              <ScanLine aria-hidden />
              {copy.page.scan}
            </Link>
          )
        }
      >
        {children}
      </SponsorShell>
    );
  if (!router.isReady || (validUuid && q.isLoading))
    return shell(<ScheduleSkeleton />);
  if (!validUuid || q.error?.data?.code === "NOT_FOUND")
    return shell(<InvalidLink />);
  if (!q.data) return shell(<LoadError onRetry={() => void q.refetch()} />);

  const data = q.data;
  const prefsHref = (step: number) => `${base}?flow=prefs&step=${step}`;
  const shortlistHref = (step: number) => `${base}?flow=shortlist&step=${step}`;
  const screen = screenOf(router.query);

  // Submitted once (decisions 2026-11-20): after Send availability a
  // sponsor sees a read-only summary, not the forms. Organizers on the
  // portal link still get the forms.
  if (screen.flow === "prefs" && data.submittedAt && !data.canEditSubmitted) {
    return shell(<AvailabilitySummary data={data} homeHref={base} />);
  }

  if (screen.flow === "prefs") {
    const f = copy.prefsFlow;
    return shell(
      <>
        <FlowHeader
          kind="prefs"
          railLabel={f.railLabel}
          tag={f.tag}
          title={f.title}
          steps={f.steps}
          current={screen.step}
          // Steps 2 and 3 need a team.
          hrefFor={(n) =>
            n === 1 || data.reps.length > 0 ? prefsHref(n) : null
          }
        />
        {screen.step === 1 && (
          <TeamStep
            sponsor={id}
            data={data}
            backHref={base}
            nextHref={prefsHref(2)}
          />
        )}
        {screen.step === 2 && (
          <PrefsStep
            sponsor={id}
            data={data}
            teamHref={prefsHref(1)}
            nextHref={prefsHref(3)}
          />
        )}
        {screen.step === 3 && (
          <ReviewStep
            sponsor={id}
            data={data}
            teamHref={prefsHref(1)}
            prefsHref={prefsHref(2)}
            homeHref={base}
          />
        )}
      </>,
    );
  }

  if (screen.flow === "shortlist") {
    const f = copy.shortlist;
    return shell(
      <>
        <FlowHeader
          kind="shortlist"
          railLabel={f.railLabel}
          tag={f.tag}
          title={f.title}
          steps={f.steps}
          current={screen.step}
          hrefFor={(n) => (data.submittedAt ? shortlistHref(n) : null)}
        />
        <ShortlistFlow
          sponsor={id}
          step={screen.step}
          prefsHref={prefsHref(1)}
          pickHref={shortlistHref(1)}
          reviewHref={shortlistHref(2)}
          homeHref={base}
        />
      </>,
    );
  }

  return shell(
    <ChatsHome
      sponsor={id}
      data={data}
      startHref={
        data.reps.some((r) => r.isPrimary) ? prefsHref(2) : prefsHref(1)
      }
      changeHref={prefsHref(2)}
      teamHref={prefsHref(1)}
      shortlistHref={shortlistHref(1)}
    />,
  );
}
