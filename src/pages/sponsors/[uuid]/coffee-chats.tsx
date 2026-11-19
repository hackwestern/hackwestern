import { useRouter } from "next/router";
import { ChatsHome } from "~/components/sponsors/coffee-setup/chats-home";
import { PrefsStep } from "~/components/sponsors/coffee-setup/prefs-step";
import { ReviewStep } from "~/components/sponsors/coffee-setup/review-step";
import {
  BackToChats,
  FlowHeader,
  SetupStatus,
} from "~/components/sponsors/coffee-setup/shared";
import { ShortlistFlow } from "~/components/sponsors/coffee-setup/shortlist-flow";
import { TeamStep } from "~/components/sponsors/coffee-setup/team-step";
import {
  InvalidLink,
  LoadError,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorSetupCopy as copy } from "~/content/sponsor-coffee-setup";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

type Screen =
  | { flow: "home" }
  | { flow: "prefs"; step: 1 | 2 | 3 }
  | { flow: "shortlist"; step: 1 | 2 };

function screenOf(query: Record<string, string | string[] | undefined>): Screen {
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
// sessions.md; design mocks/sponsor-portal-flow-hacker-v6): the Chats home,
// then two separate flows picked by ?flow=: chatting preferences (Your
// team → preferences → Review & submit) and the shortlist (pick → Review
// & submit). Every screen opens with the status card, because sponsors
// come back hours after organizers act. Once organizers send, "Your chats"
// leads the home and setup folds into links (ChatsHome).
export default function SponsorCoffeeChatsPage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const q = api.coffeeChatSetup.get.useQuery(
    { sponsor: id },
    { enabled: validUuid, retry: 1, refetchInterval: 60_000, refetchOnWindowFocus: false },
  );

  const shell = (children: React.ReactNode) => (
    <SponsorShell title={copy.seoTitle}>{children}</SponsorShell>
  );
  if (!router.isReady || (validUuid && q.isLoading)) return shell(<ScheduleSkeleton />);
  if (!validUuid || q.error?.data?.code === "NOT_FOUND") return shell(<InvalidLink />);
  if (!q.data) return shell(<LoadError onRetry={() => void q.refetch()} />);

  const data = q.data;
  const base = `/sponsors/${id}/coffee-chats`;
  const prefsHref = (step: number) => `${base}?flow=prefs&step=${step}`;
  const shortlistHref = (step: number) => `${base}?flow=shortlist&step=${step}`;
  const screen = screenOf(router.query);
  const status = <SetupStatus sponsor={id} data={data} />;

  if (screen.flow === "prefs") {
    const f = copy.prefsFlow;
    return shell(
      <>
        <BackToChats href={base} />
        <SetupStatus sponsor={id} data={data} flowStep={screen.step} />
        <FlowHeader
          tag={f.tag}
          title={f.title}
          body={f.body}
          steps={f.steps}
          current={screen.step}
          // Steps 2 and 3 need a team.
          hrefFor={(n) => (n === 1 || data.reps.length > 0 ? prefsHref(n) : null)}
        />
        {screen.step === 1 && (
          <TeamStep sponsor={id} data={data} backHref={base} nextHref={prefsHref(2)} />
        )}
        {screen.step === 2 && (
          <PrefsStep sponsor={id} data={data} teamHref={prefsHref(1)} nextHref={prefsHref(3)} />
        )}
        {screen.step === 3 && (
          <ReviewStep
            sponsor={id}
            data={data}
            teamHref={prefsHref(1)}
            prefsHref={prefsHref(2)}
            shortlistHref={shortlistHref(1)}
          />
        )}
      </>,
    );
  }

  if (screen.flow === "shortlist") {
    const f = copy.shortlist;
    return shell(
      <>
        <BackToChats href={base} />
        {status}
        <FlowHeader
          tag={f.tag}
          title={f.title}
          body={f.body}
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
    <>
      <ChatsHome
        status={status}
        sponsor={id}
        data={data}
        prefsHref={data.submittedAt ? prefsHref(3) : prefsHref(1)}
        teamHref={prefsHref(1)}
        shortlistHref={shortlistHref(data.shortlistSubmittedAt ? 2 : 1)}
        scanHref={`/sponsors/${id}/scan`}
      />
    </>,
  );
}
