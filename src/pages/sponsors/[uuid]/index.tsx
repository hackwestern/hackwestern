import { useRouter } from "next/router";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Coffee,
  MapPin,
  Phone,
  Presentation,
} from "lucide-react";
import SEO from "~/components/seo";
import { api } from "~/utils/api";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SponsorHubPage() {
  const router = useRouter();
  const rawId = (router.query.uuid ?? router.query.id) as string | undefined;
  const id = typeof rawId === "string" ? rawId : "";
  const validUuid = uuidRegex.test(id);

  const sponsorQ = api.sponsorJudging.getSponsorPortalInfo.useQuery(
    { sponsor: id },
    {
      enabled: validUuid,
      refetchOnWindowFocus: false,
    },
  );

  const data = sponsorQ.data;

  if (!router.isReady) {
    return (
      <Shell>
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-32 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-nav" />
          <div className="h-40 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="h-28 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card" />
            <div className="h-28 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card" />
          </div>
        </div>
      </Shell>
    );
  }

  if (
    !validUuid ||
    (sponsorQ.isError && sponsorQ.error.data?.code === "NOT_FOUND")
  ) {
    return (
      <Shell>
        <DashboardPanel className="text-center">
          <h1 className="dashboard-h1 m-0">Link not recognised</h1>
          <p className="mb-0 mt-2 text-base leading-relaxed text-dashboard-text-medium">
            This private link isn&apos;t valid. If you believe this is an error,
            please reach out to your Hack Western organizer contact for
            assistance.
          </p>
        </DashboardPanel>
      </Shell>
    );
  }

  const sponsorName = data?.sponsorName ?? "Sponsor";
  const roomNumber = data?.roomNumber ?? "TBD";
  const boothLocation = data?.boothLocation ?? "TBD";
  const hwContact =
    data?.hwContact && data.hwContact !== "—" ? data.hwContact : null;
  const hwContactPhone = data?.hwContactPhone ?? null;
  const picksCount = data?.picksCount ?? 0;
  const workshopLocation = data?.workshopLocation ?? null;
  const workshopTime = data?.workshopTime ?? null;
  // Not every sponsor runs a workshop — omit the card entirely when blank.
  const hasWorkshop = Boolean(workshopLocation) || Boolean(workshopTime);

  // Unassigned booth/room ("TBD" from the sheet) hides the card entirely.
  const hasBoothLocation = boothLocation !== "TBD";
  const hasJudgingRoom = roomNumber !== "TBD";

  // Coffee chats: the sheet's "Coffee Chat Max Minutes" is the allowance in
  // minutes (empty/invalid = 0, so no link at all); blocks are 15 minutes.
  const maxCoffeeChatBlocks = data?.maxCoffeeChatBlocks ?? 0;
  const coffeeChatBookedCount = data?.coffeeChatBookedCount ?? 0;
  const hasCoffeeChats = maxCoffeeChatBlocks > 0;

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        {/* Welcome */}
        <section className="relative overflow-hidden rounded-dashboard-2xl bg-dashboard-action-primary p-6 text-dashboard-text-inverse shadow-dashboard-card sm:p-7">
          <div className="relative z-10 flex flex-col gap-2">
            <span className="inline-flex items-center whitespace-nowrap rounded-dashboard-sm bg-white/20 px-2 py-1 font-figtree text-xs font-medium leading-5 text-white backdrop-blur-sm">
              Hack Western 13
            </span>

            <h1 className="m-0 text-[28px] font-bold leading-[1.2] tracking-tight md:text-[32px]">
              Welcome, {sponsorName}!
            </h1>

            <p className="m-0 max-w-[540px] text-base font-medium leading-relaxed text-white/90">
              We&apos;re thrilled to have you with us this weekend. Use this
              portal to check your booth and judging details and pick your top
              projects.
            </p>
          </div>
        </section>

        {/* Judging CTA — hidden entirely when no judging room is assigned */}
        {hasJudgingRoom && (
          <DashboardPanel>
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="dashboard-section-label text-dashboard-text-light">
                    Judging
                  </span>
                  <h2 className="m-0 text-xl font-semibold text-dashboard-text-heavy">
                    Pick your top teams
                  </h2>
                </div>

                {picksCount > 0 ? (
                  <span className="inline-flex items-center whitespace-nowrap rounded-dashboard-sm bg-dashboard-bg-highlight px-2 py-1 font-figtree text-xs font-medium leading-5 text-dashboard-text-heavy">
                    {picksCount} picked
                  </span>
                ) : (
                  <DashboardTag>Pending</DashboardTag>
                )}
              </div>

              <p className="m-0 text-base font-medium leading-relaxed text-dashboard-text-medium">
                Select between 5 and 10 teams for your sponsored awards. You can
                update and save your selections anytime before judging closes.
              </p>

              <DashboardButton asChild className="mt-1 md:w-full">
                <Link href={`/sponsors/${id}/picks`}>
                  {picksCount > 0
                    ? "Review & edit your picks"
                    : "Select top teams"}
                  <ArrowRight />
                </Link>
              </DashboardButton>
            </div>
          </DashboardPanel>
        )}

        {/* Coffee chats CTA — hidden entirely when the sponsor has no allowance */}
        {hasCoffeeChats && (
          <DashboardPanel>
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
                    <Coffee
                      aria-hidden="true"
                      className="size-4"
                      strokeWidth={1.67}
                    />
                    Coffee chats
                  </span>
                  <h2 className="m-0 text-xl font-semibold text-dashboard-text-heavy">
                    Book time with hackers
                  </h2>
                </div>

                {coffeeChatBookedCount > 0 ? (
                  <span className="inline-flex items-center whitespace-nowrap rounded-dashboard-sm bg-dashboard-bg-highlight px-2 py-1 font-figtree text-xs font-medium leading-5 text-dashboard-text-heavy">
                    {coffeeChatBookedCount} booked
                  </span>
                ) : (
                  <DashboardTag>Pending</DashboardTag>
                )}
              </div>

              <p className="m-0 text-base font-medium leading-relaxed text-dashboard-text-medium">
                Reserve up to {maxCoffeeChatBlocks} × 15-minute slots across our
                three coffee chat rooms, Saturday 10:00 AM &ndash; 4:00 PM. You
                can change them any time.
              </p>

              <DashboardButton asChild className="mt-1 md:w-full">
                <Link href={`/sponsors/${id}/coffee-chats`}>
                  {coffeeChatBookedCount > 0
                    ? "View & edit your bookings"
                    : "Schedule coffee chats"}
                  <ArrowRight />
                </Link>
              </DashboardButton>
            </div>
          </DashboardPanel>
        )}

        {/* Event details */}
        <div className="flex flex-col gap-3">
          <h2 className="dashboard-section-label m-0 text-dashboard-text-light">
            Event details
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hasBoothLocation && (
              <DashboardPanel className="gap-2 p-4 sm:p-5">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
                  <MapPin
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.67}
                  />
                  Booth location
                </span>
                <span className="text-xl font-semibold text-dashboard-text-heavy">
                  {boothLocation}
                </span>
                <span className="text-sm font-medium text-dashboard-text-light">
                  Your assigned sponsor booth table
                </span>
              </DashboardPanel>
            )}

            {hasJudgingRoom && (
              <DashboardPanel className="gap-2 p-4 sm:p-5">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
                  <Presentation
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.67}
                  />
                  Judging room
                </span>
                <span className="text-xl font-semibold text-dashboard-text-heavy">
                  Room {roomNumber}
                </span>
                <span className="text-sm font-medium text-dashboard-text-light">
                  Head here when judging deliberations start
                </span>
              </DashboardPanel>
            )}
          </div>

          {/* Workshop — only when the sheet has data for this sponsor */}
          {hasWorkshop && (
            <DashboardPanel className="gap-2 p-4 sm:p-5">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
                <Clock
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.67}
                />
                Workshop
              </span>
              <div className="flex flex-col gap-1.5">
                {workshopLocation && (
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-dashboard-text-light">
                      Location
                    </span>
                    <span className="text-xl font-semibold text-dashboard-text-heavy">
                      {workshopLocation}
                    </span>
                  </div>
                )}
                {workshopTime && (
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-dashboard-text-light">
                      Time
                    </span>
                    <span className="text-xl font-semibold text-dashboard-text-heavy">
                      {workshopTime}
                    </span>
                  </div>
                )}
              </div>
            </DashboardPanel>
          )}

          {/* HW contact */}
          <DashboardPanel className="flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
                <Phone
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.67}
                />
                Your Hack Western contact
              </span>
              <span className="text-lg font-semibold text-dashboard-text-heavy">
                {hwContact ?? "Hack Western Organizer Team"}
              </span>
              {hwContact && hwContactPhone && (
                <a
                  href={`tel:${hwContactPhone.replace(/[^\d+]/g, "")}`}
                  className="text-base font-medium text-dashboard-text-link underline-offset-2 hover:underline"
                >
                  {hwContactPhone}
                </a>
              )}
            </div>

            <DashboardTag className="self-start sm:self-auto">
              On-Site Support
            </DashboardTag>
          </DashboardPanel>
        </div>

        <p className="m-0 mt-1 text-center text-sm font-medium leading-relaxed text-dashboard-text-light">
          Need immediate assistance during the hackathon? Reach out to your HW
          contact.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SEO title="Sponsor Portal" noindex />
      <div className="min-h-screen bg-dashboard-bg-page px-4 pb-12 pt-6 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
          <header className="flex items-center justify-between">
            <span className="text-sm font-semibold tracking-tight text-dashboard-text-medium">
              Hack Western 13
            </span>
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
