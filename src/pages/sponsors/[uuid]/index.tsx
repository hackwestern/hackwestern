import { useRouter } from "next/router";
import {
  Clock,
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
import { SponsorHelp } from "~/components/sponsors/help-button";
import { pressable, SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorLogo } from "~/lib/sponsor-logos";
import { BoothLayout } from "~/components/sponsors/booth-layout";
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
  const hwContact =
    data?.hwContact && data.hwContact !== "—" ? data.hwContact : null;
  const hwContactPhone = data?.hwContactPhone ?? null;
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

        {/* Judging isn't in the nav for them, so say why, once, quietly. */}
        {data?.hasPrizeTrack === false && (
          <p className="m-0 text-sm text-dashboard-text-light">
            {copy.noPrizeTrack}
          </p>
        )}

        {/* Need help: pings the sponsor team in Slack. In the side nav
            from tablets up. */}
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
                    {venue.important.emergency.name}
                  </dd>
                </div>
                {venue.important.emergency.phone ? (
                  <a
                    href={`tel:${venue.important.emergency.phone.replace(/[^\d+]/g, "")}`}
                    aria-label={venue.important.emergency.call(
                      venue.important.emergency.phone,
                    )}
                    className={cn(
                      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-sm font-semibold text-dashboard-text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
                      pressable,
                    )}
                  >
                    <Phone aria-hidden className="size-4" />
                    {venue.important.emergency.phone}
                  </a>
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
                  {hwContact ?? copy.details.contact.fallback}
                </dd>
              </div>
              {hwContact && hwContactPhone ? (
                <a
                  href={`tel:${hwContactPhone.replace(/[^\d+]/g, "")}`}
                  aria-label={copy.details.contact.call(hwContactPhone)}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-sm font-semibold text-dashboard-text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
                    pressable,
                  )}
                >
                  <Phone aria-hidden className="size-4" />
                  {hwContactPhone}
                </a>
              ) : (
                <span className="shrink-0 rounded-dashboard-sm bg-dashboard-bg-nav px-2 py-1 text-xs font-medium text-dashboard-text-light">
                  {copy.details.contact.tag}
                </span>
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
