import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowRight,
  Clock,
  Coffee,
  Luggage,
  MapPin,
  Phone,
  Presentation,
  Siren,
  Sofa,
  type LucideIcon,
} from "lucide-react";
import { uuidRegex } from "~/utils/urls";
import { api } from "~/utils/api";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { sponsorVenueCopy as venue } from "~/content/sponsor-venue";
import { VenueMapDialog } from "~/components/sponsors/venue-map";
import { sponsorPortalCopy as copy } from "~/content/sponsor-portal";
import { sponsorHelpCopy as helpCopy } from "~/content/sponsor-help";
import {
  SponsorHelp,
  useHelpContacts,
} from "~/components/sponsors/help-button";
import { PhoneCopy } from "~/components/sponsors/phone-copy";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorLogo } from "~/lib/sponsor-logos";
import { BoothLayout } from "~/components/sponsors/booth-layout";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { cn } from "~/lib/utils";

export default function SponsorHubPage() {
  const router = useRouter();
  const rawId = (router.query.uuid ?? router.query.id) as string | undefined;
  const id = typeof rawId === "string" ? rawId : "";
  const validUuid = uuidRegex.test(id);

  const sponsorQ = api.sponsorPortal.getSponsorPortalInfo.useQuery(
    { sponsor: id },
    {
      enabled: validUuid,
      refetchOnWindowFocus: false,
    },
  );

  const data = sponsorQ.data;
  // "What to do now": coffee chat preferences until they're submitted.
  const setupQ = api.coffeeChatSetup.get.useQuery(
    { sponsor: id },
    { enabled: validUuid, retry: false, refetchOnWindowFocus: false },
  );
  const prefsIn = !!setupQ.data?.submittedAt;
  // One answer to "who do I contact?" (B11): the same HW lead (Sponsor
  // Day-Of) and emergency contact (Noah, HW Contacts) as the Help dialog,
  // read at runtime (never in the repo).
  const { lead, emergency } = useHelpContacts(validUuid ? id : "");

  if (!router.isReady) {
    return (
      <SponsorShell title={copy.seoTitle}>
        <div className="flex flex-col gap-5" aria-busy="true">
          <div className="h-36 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-nav motion-reduce:animate-none" />
          <div className="h-11 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-nav motion-reduce:animate-none md:hidden" />
          <div className="h-56 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card motion-reduce:animate-none" />
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

  const sponsorName = data?.sponsorName ?? copy.welcome.fallbackName;
  const logo = data?.sponsorName ? sponsorLogo(data.sponsorName) : null;
  const roomNumber = data?.roomNumber ?? "TBD";
  const boothLocation = data?.boothLocation ?? "TBD";
  const workshopLocation = data?.workshopLocation ?? null;
  const workshopTime = data?.workshopTime ?? null;
  // Not every sponsor runs a workshop — omit the row entirely when blank.
  const hasWorkshop = Boolean(workshopLocation) || Boolean(workshopTime);

  // Unassigned booth/room ("TBD" from the sheet) hides the row entirely.
  const hasBoothLocation = boothLocation !== "TBD";
  const hasJudgingRoom = roomNumber !== "TBD";
  return (
    <SponsorShell title={copy.seoTitle}>
      <div className="flex flex-col gap-5">
        {/* Welcome */}
        <section
          data-tour="welcome"
          className="flex flex-col gap-2 rounded-dashboard-2xl bg-dashboard-action-primary p-5 text-dashboard-text-inverse shadow-dashboard-card sm:p-7"
        >
          {/* The sponsor's own logo, on white so any logo colour reads on
              the blue card (Jazz, 2026-11-18). Phones only: the side nav
              shows it from tablets up. */}
          {logo && (
            <span className="mb-2 inline-flex h-14 w-fit items-center rounded-dashboard-lg bg-dashboard-bg-surface px-4 py-2.5 shadow-dashboard-card md:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- small static logo */}
              <img
                src={logo}
                alt={copy.welcome.logoAlt(sponsorName)}
                width={160}
                height={36}
                className="h-full w-auto max-w-[200px] object-contain"
              />
            </span>
          )}
          <h1 className="m-0 break-words text-2xl font-bold leading-default tracking-tight sm:text-3xl">
            {copy.welcome.title(sponsorName)}
          </h1>
          <p className="m-0 max-w-[540px] text-base font-medium leading-relaxed text-dashboard-text-inverse/90">
            {copy.welcome.body}
          </p>
        </section>

        {/* The one thing to do now (filled until preferences are in). */}
        {setupQ.data && (
          <section aria-labelledby="todo-heading" className="flex flex-col gap-2">
            <h2
              id="todo-heading"
              className="dashboard-section-label m-0 text-dashboard-text-light"
            >
              {copy.todo.label}
            </h2>
            <Link
              href={`/sponsors/${id}/coffee-chats`}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-dashboard-2xl p-4 shadow-dashboard-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2 sm:p-5",
                prefsIn
                  ? "bg-dashboard-bg-surface text-dashboard-text-heavy [@media(hover:hover)]:hover:bg-dashboard-bg-highlight"
                  : "bg-dashboard-action-primary text-dashboard-text-inverse",
                pressable,
              )}
            >
              <Coffee aria-hidden className="size-6 shrink-0" strokeWidth={1.67} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-lg font-semibold">
                  {prefsIn ? copy.todo.chatsDone : copy.todo.chats}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    prefsIn
                      ? "text-dashboard-text-medium"
                      : "text-dashboard-text-inverse/90",
                  )}
                >
                  {prefsIn ? copy.todo.chatsDoneHint : copy.todo.chatsHint}
                </span>
              </span>
              <ArrowRight aria-hidden className="size-5 shrink-0" />
            </Link>
          </section>
        )}

        {/* Judging isn't in the nav for them, so say why, once, quietly. */}
        {data?.hasPrizeTrack === false && (
          <p className="m-0 text-sm text-dashboard-text-light">
            {copy.noPrizeTrack}
          </p>
        )}

        {/* Need help: your HW lead and the emergency contact. In the side
            nav from tablets up. */}
        <div className="md:hidden">
          <SponsorHelp />
        </div>

        {/* Venue (the side nav's Venue item): important places, then the
            Sponsor Bay layout. */}
        <div id="venue" className="flex scroll-mt-6 flex-col gap-5">
          {/* Important things to remember */}
          <section
            aria-labelledby="important-heading"
            data-tour="important"
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="important-heading"
                className="dashboard-section-label m-0 text-dashboard-text-light"
              >
                {venue.important.heading}
              </h2>
              <VenueMapDialog
                trigger={
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-dashboard-text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:underline"
                  >
                    {venue.important.openMap}
                  </button>
                }
              />
            </div>
            <dl className="m-0 flex flex-col divide-y divide-dashboard-border-subtle rounded-dashboard-2xl bg-dashboard-bg-surface px-4 shadow-dashboard-card sm:px-5">
              <DetailRow
                icon={Sofa}
                label={venue.important.lounge.label}
                value={venue.important.lounge.value}
                hint={venue.important.lounge.hint}
              />
              <DetailRow
                icon={Luggage}
                label={venue.important.belongings.label}
                value={venue.important.belongings.value}
                hint={venue.important.belongings.hint}
              />
              <div className="flex items-center gap-3 py-4">
                <DetailIcon icon={Siren} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <dt className="text-sm font-medium text-dashboard-text-light">
                    {venue.important.emergency.label}
                  </dt>
                  <dd className="m-0 break-words text-base font-semibold text-dashboard-text-heavy">
                    {emergency?.name ?? helpCopy.contacts.noEmergency}
                  </dd>
                </div>
                {emergency?.phone ? (
                  <PhoneCopy
                    name={emergency.name}
                    phone={emergency.phone}
                    className="shrink-0"
                  />
                ) : (
                  <span className="shrink-0 rounded-dashboard-sm bg-dashboard-bg-nav px-2 py-1 text-xs font-medium text-dashboard-text-light">
                    {venue.important.emergency.phonePlaceholder}
                  </span>
                )}
              </div>
            </dl>
          </section>

          {/* Sponsor Bay layout: booths around the projector screen */}
          <section
            aria-labelledby="booths-heading"
            data-tour="booths"
            className="flex flex-col gap-3"
          >
            <h2
              id="booths-heading"
              className="dashboard-section-label m-0 text-dashboard-text-light"
            >
              {venue.booths.heading}
            </h2>
            <BoothLayout sponsorName={data?.sponsorName} />
          </section>
        </div>

        {/* Event details */}
        <section
          aria-labelledby="details-heading"
          className="flex flex-col gap-3"
        >
          <h2
            id="details-heading"
            className="dashboard-section-label m-0 text-dashboard-text-light"
          >
            {copy.details.heading}
          </h2>

          <dl className="m-0 flex flex-col divide-y divide-dashboard-border-subtle rounded-dashboard-2xl bg-dashboard-bg-surface px-4 shadow-dashboard-card sm:px-5">
            {hasBoothLocation && (
              <DetailRow
                icon={MapPin}
                label={copy.details.booth.label}
                value={boothLocation}
                hint={copy.details.booth.hint}
              />
            )}
            {hasJudgingRoom && (
              <DetailRow
                icon={Presentation}
                label={copy.details.judging.label}
                value={copy.details.judging.value(roomNumber)}
                hint={copy.details.judging.hint}
              />
            )}
            {/* Workshop — only when the sheet has data for this sponsor */}
            {hasWorkshop && (
              <DetailRow
                icon={Clock}
                label={copy.details.workshop.label}
                value={[workshopTime, workshopLocation]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}
            <div className="flex items-center gap-3 py-4">
              <DetailIcon icon={Phone} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <dt className="text-sm font-medium text-dashboard-text-light">
                  {copy.details.contact.label}
                </dt>
                <dd className="m-0 break-words text-base font-semibold text-dashboard-text-heavy">
                  {lead?.name ?? helpCopy.contacts.noLead}
                </dd>
                {lead && !lead.phone && (
                  <dd className="m-0 text-sm font-medium text-dashboard-text-light">
                    {helpCopy.contacts.noPhone}
                  </dd>
                )}
              </div>
              {lead?.phone && (
                <PhoneCopy
                  name={lead.name}
                  phone={lead.phone}
                  className="shrink-0"
                />
              )}
            </div>
          </dl>
        </section>

        <p className="m-0 text-center text-sm font-medium leading-relaxed text-dashboard-text-light">
          {copy.footer}
        </p>
      </div>
    </SponsorShell>
  );
}

function DetailIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-inset text-dashboard-text-medium"
    >
      <Icon className="size-5" strokeWidth={1.67} />
    </span>
  );
}

function DetailRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-4">
      <DetailIcon icon={icon} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-sm font-medium text-dashboard-text-light">
          {label}
        </dt>
        <dd className="m-0 break-words text-base font-semibold text-dashboard-text-heavy">
          {value}
        </dd>
        {hint && (
          <dd className="m-0 text-sm font-medium text-dashboard-text-light">
            {hint}
          </dd>
        )}
      </div>
    </div>
  );
}
