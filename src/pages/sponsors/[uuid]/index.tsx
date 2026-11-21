import { useRouter } from "next/router";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { ContactsCard } from "~/components/sponsors/home/contacts-card";
import { iveyWalkCopy } from "~/content/ivey-walk";
import { KeyRooms } from "~/components/sponsors/home/key-rooms";
import { UpNext } from "~/components/sponsors/home/up-next";
import { TourEntry } from "~/components/sponsors/home/tour-entry";
import { WelcomeCard } from "~/components/sponsors/home/welcome-card";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { useNow } from "~/components/sponsors/use-now";
import { sponsorHomeCopy as home } from "~/content/sponsor-home";
import { sponsorPortalCopy as copy } from "~/content/sponsor-portal";
import type { HomeContext } from "~/lib/sponsor-home";
import { sponsorLogo } from "~/lib/sponsor-logos";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

/**
 * Sponsor portal Home (mock sponsor-chats-v3): "Hi [logo]", the welcome
 * card, Contacts, Up next, "Take the tour" and Key rooms.
 */
export default function SponsorHubPage() {
  const router = useRouter();
  const rawId = (router.query.uuid ?? router.query.id) as string | undefined;
  const id = typeof rawId === "string" ? rawId : "";
  const validUuid = uuidRegex.test(id);
  const now = useNow();

  const sponsorQ = api.sponsorPortal.getSponsorPortalInfo.useQuery(
    { sponsor: id },
    { enabled: validUuid, refetchOnWindowFocus: false },
  );
  const setupQ = api.coffeeChatSetup.get.useQuery(
    { sponsor: id },
    {
      enabled: validUuid,
      retry: false,
      refetchOnWindowFocus: false,
      refetchInterval: 60_000,
    },
  );

  if (!router.isReady) {
    return (
      <SponsorShell title={home.seoTitle}>
        <div className="flex flex-col gap-5" aria-busy="true">
          <div className="h-14 w-56 animate-pulse rounded-dashboard-lg bg-dashboard-bg-nav motion-reduce:animate-none" />
          <div className="h-56 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card motion-reduce:animate-none" />
        </div>
      </SponsorShell>
    );
  }

  if (
    !validUuid ||
    (sponsorQ.isError && sponsorQ.error.data?.code === "NOT_FOUND")
  ) {
    return (
      <SponsorShell title={copy.seoTitle}>
        <DashboardPanel className="text-center">
          <h1 className="dashboard-h1 m-0">{copy.invalid.title}</h1>
          <p className="mb-0 mt-2 text-base leading-relaxed text-dashboard-text-medium">
            {copy.invalid.body}
          </p>
        </DashboardPanel>
      </SponsorShell>
    );
  }

  const info = sponsorQ.data;
  const setup = setupQ.data;
  const sponsorName = info?.sponsorName ?? null;
  const logo = sponsorName ? sponsorLogo(sponsorName) : null;
  const repName = (repId: string) =>
    setup?.reps.find((r) => r.id === repId)?.name ?? "";
  const workshop = setup?.workshops[0] ?? null;
  const ctx: HomeContext = {
    hasPrizeTrack: info?.hasPrizeTrack === true,
    availabilitySent: !!setup?.submittedAt,
    shortlistSent: !!setup?.shortlistSubmittedAt,
    confirmed: !!setup?.confirmed,
    chats: (setup?.chats ?? []).map((c) => ({
      id: c.placementId,
      rep: repName(c.repId),
      start: c.start,
      end: c.end,
      room: c.room,
      building: c.building,
      chats: c.chats,
      confirmed: c.hackers.filter((h) => h.status === "accepted").length,
    })),
    workshop: workshop
      ? {
          start: workshop.start,
          title: workshop.title,
          location: workshop.location,
        }
      : null,
    judgingRoom:
      info?.roomNumber && info.roomNumber !== "TBD" ? info.roomNumber : null,
  };
  const base = `/sponsors/${id}`;

  return (
    <SponsorShell title={home.seoTitle}>
      <h1
        data-tour="home-greeting"
        className="m-0 flex min-w-0 flex-wrap items-center gap-x-[0.22em] whitespace-nowrap text-[32px] font-extrabold leading-[1.2] tracking-tight md:text-md-display"
      >
        <span>{home.hi}</span>
        {logo && sponsorName ? (
          // eslint-disable-next-line @next/next/no-img-element -- small static logo
          <img
            src={logo}
            alt={home.logoAlt(sponsorName)}
            className="inline-block h-[1.3em] w-auto max-w-[70vw] object-contain"
          />
        ) : (
          <span>{sponsorName ?? copy.welcome.fallbackName}</span>
        )}
      </h1>
      {info && <WelcomeCard sponsor={id} tier={info.tier ?? null} />}
      <ContactsCard sponsor={id} />
      <UpNext
        ctx={ctx}
        now={now}
        hrefs={{
          chats: `${base}/coffee-chats`,
          scan: `${base}/scan`,
          yourChats: `${base}/coffee-chats`,
          judging: `${base}/picks`,
        }}
        mapHref={iveyWalkCopy.sponsorMapPath(id)}
      />
      <TourEntry />
      <KeyRooms
        chats={
          setup?.confirmed
            ? setup.chats.map((c) => ({
                rep: repName(c.repId),
                room: c.room,
                building: c.building,
                start: c.start,
              }))
            : null
        }
        mapHref={iveyWalkCopy.sponsorMapPath(id)}
      />
    </SponsorShell>
  );
}
