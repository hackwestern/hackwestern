import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  ChevronRight,
  Clock,
  Coffee,
  Lock,
  Luggage,
  MapPin,
  Phone,
  Presentation,
  ScanLine,
  Siren,
  Sofa,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import SEO from "~/components/seo";
import { uuidRegex } from "~/utils/urls";
import { api } from "~/utils/api";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";
import { judgingUnlocked } from "~/lib/sponsor-judging-unlock";
import { useNow } from "~/components/sponsors/use-now";
import { sponsorVenueCopy as venue } from "~/content/sponsor-venue";
import {
  VenueMapButton,
  VenueMapDialog,
} from "~/components/sponsors/venue-map";
import { sponsorPortalCopy as copy } from "~/content/sponsor-portal";
import { SponsorHelp } from "~/components/sponsors/help-button";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorLogo } from "~/lib/sponsor-logos";
import { BoothLayout } from "~/components/sponsors/booth-layout";
import { SponsorTour } from "~/components/sponsors/tour/sponsor-tour";
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
  const now = useNow();

  if (!router.isReady) {
    return (
      <Shell>
        <div className="flex flex-col gap-5" aria-busy="true">
          <div className="h-36 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-nav motion-reduce:animate-none" />
          <div className="h-11 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-nav motion-reduce:animate-none" />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 h-20 animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card motion-reduce:animate-none" />
            <div className="h-28 animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card motion-reduce:animate-none" />
            <div className="h-28 animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card motion-reduce:animate-none" />
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
          <h1 className="dashboard-h1 m-0">{copy.invalid.title}</h1>
          <p className="mb-0 mt-2 text-base leading-relaxed text-dashboard-text-medium">
            {copy.invalid.body}
          </p>
        </DashboardPanel>
      </Shell>
    );
  }

  const sponsorName = data?.sponsorName ?? copy.welcome.fallbackName;
  const logo = data?.sponsorName ? sponsorLogo(data.sponsorName) : null;
  const roomNumber = data?.roomNumber ?? "TBD";
  const boothLocation = data?.boothLocation ?? "TBD";
  const hwContact =
    data?.hwContact && data.hwContact !== "—" ? data.hwContact : null;
  const hwContactPhone = data?.hwContactPhone ?? null;
  const picksCount = data?.picksCount ?? 0;
  const workshopLocation = data?.workshopLocation ?? null;
  const workshopTime = data?.workshopTime ?? null;
  // Not every sponsor runs a workshop — omit the row entirely when blank.
  const hasWorkshop = Boolean(workshopLocation) || Boolean(workshopTime);

  // Unassigned booth/room ("TBD" from the sheet) hides the row entirely.
  const hasBoothLocation = boothLocation !== "TBD";
  const hasJudgingRoom = roomNumber !== "TBD";
  // The Judging tile always shows: locked until round 1 opens, so sponsors
  // know it's coming (Jazz, 2026-11-18).
  // `?preview=judging` opens the tile early so the team can walk through
  // the flow before Sunday (Jazz, 2026-11-18). The picks page itself was
  // never time-gated, so this exposes nothing new.
  const judgingOpen =
    router.query.preview === "judging" || judgingUnlocked(now);
  const actions = copy.actions;

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        {/* Welcome */}
        <section
          data-tour="welcome"
          className="flex flex-col gap-2 rounded-dashboard-2xl bg-dashboard-action-primary p-5 text-dashboard-text-inverse shadow-dashboard-card sm:p-7"
        >
          {/* The sponsor's own logo, on white so any logo colour reads on
              the blue card (Jazz, 2026-11-18). */}
          {logo && (
            <span className="mb-2 inline-flex h-14 w-fit items-center rounded-dashboard-lg bg-dashboard-bg-surface px-4 py-2.5 shadow-dashboard-card">
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

        {/* Need help: pings the sponsor team in Slack */}
        <SponsorHelp sponsor={id} boothLocation={boothLocation} />

        {/* The things a rep does all weekend, one tap each. */}
        <nav aria-label={actions.label}>
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0">
            <li className="col-span-2" data-tour="tile-scan">
              <ActionTile
                href={`/sponsors/${id}/scan`}
                icon={ScanLine}
                title={actions.scan.title}
                body={actions.scan.body}
                primary
              />
            </li>
            <li data-tour="tile-chats">
              <ActionTile
                href={`/sponsors/${id}/coffee-chats`}
                icon={Coffee}
                title={actions.chats.title}
                body={actions.chats.body}
              />
            </li>
            <li data-tour="tile-schedule">
              <ActionTile
                href={`/sponsors/${id}/schedule`}
                icon={Clock}
                title={actions.schedule.title}
                body={actions.schedule.body}
              />
            </li>
            <li className="col-span-2" data-tour="tile-judging">
              {judgingOpen ? (
                <ActionTile
                  href={`/sponsors/${id}/picks`}
                  icon={Trophy}
                  title={actions.picks.title}
                  body={actions.picks.body(SPONSOR_FINAL_TOP)}
                  badge={
                    picksCount > 0
                      ? actions.picks.picked(picksCount)
                      : actions.picks.pending
                  }
                />
              ) : (
                <LockedTile
                  icon={Trophy}
                  title={actions.picks.title}
                  body={actions.picks.body(SPONSOR_FINAL_TOP)}
                  badge={venue.judgingLocked.badge}
                  message={venue.judgingLocked.message}
                />
              )}
            </li>
          </ul>
        </nav>

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
    </Shell>
  );
}

function ActionTile({
  href,
  icon: Icon,
  title,
  body,
  badge,
  primary = false,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  body: string;
  badge?: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full min-h-11 items-center gap-3 rounded-dashboard-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
        primary
          ? "bg-dashboard-text-heavy text-dashboard-text-inverse shadow-dashboard-primary-btn [@media(hover:hover)]:hover:bg-dashboard-text-medium"
          : "flex-col items-start bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card [@media(hover:hover)]:hover:bg-dashboard-bg-highlightSubtle",
        pressable,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
          primary
            ? "bg-dashboard-action-primary text-dashboard-text-inverse"
            : "bg-dashboard-bg-highlight text-dashboard-action-primary",
        )}
      >
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold">
          {title}
          {badge && (
            <span className="rounded-dashboard-sm bg-dashboard-bg-highlight px-2 py-0.5 text-xs font-medium text-dashboard-text-active">
              {badge}
            </span>
          )}
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            primary
              ? "text-dashboard-text-inverse/80"
              : "text-dashboard-text-light",
          )}
        >
          {body}
        </span>
      </span>
      {primary && (
        <ChevronRight
          aria-hidden
          className="size-5 shrink-0 transition-transform duration-150 ease-out motion-reduce:transition-none [@media(hover:hover)]:group-hover:translate-x-0.5"
        />
      )}
    </Link>
  );
}

/**
 * A tile for something that isn't open yet: greyed, with a lock. Tapping it
 * says when it opens instead of going anywhere.
 */
function LockedTile({
  icon: Icon,
  title,
  body,
  badge,
  message,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  badge: string;
  message: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="locked-tile-message"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex min-h-11 w-full items-center gap-3 rounded-dashboard-2xl border border-dashed border-dashboard-border-control bg-dashboard-bg-inset p-4 text-left text-dashboard-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
          pressable,
        )}
      >
        <span
          aria-hidden
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-nav text-dashboard-text-light"
        >
          <Icon className="size-5" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-dashboard-text-medium">
            {title}
            <span className="rounded-dashboard-sm bg-dashboard-bg-nav px-2 py-0.5 text-xs font-medium text-dashboard-text-light">
              {badge}
            </span>
          </span>
          <span className="text-sm font-medium">{body}</span>
        </span>
        <Lock aria-hidden className="size-5 shrink-0" />
      </button>
      <p
        id="locked-tile-message"
        role="status"
        className={cn(
          "m-0 rounded-dashboard-lg bg-dashboard-bg-highlight px-4 py-3 text-sm font-medium text-dashboard-text-active",
          !open && "hidden",
        )}
      >
        {open ? message : ""}
      </p>
    </div>
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SEO title={copy.seoTitle} noindex />
      <div className="min-h-dvh bg-dashboard-bg-page px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-4 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5 sm:pt-6">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
          <header className="flex min-h-11 items-center justify-between gap-3">
            <span className="text-sm font-semibold tracking-tight text-dashboard-text-light">
              {copy.brand}
            </span>
            <div className="flex items-center gap-2">
              <SponsorTour offerWelcome />
              <VenueMapButton />
            </div>
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
