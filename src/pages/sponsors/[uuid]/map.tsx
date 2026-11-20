import { useState } from "react";
import { useRouter } from "next/router";
import { MapPin } from "lucide-react";
import { BoothLayout } from "~/components/sponsors/booth-layout";
import { chip } from "~/components/sponsors/portal-ui";
import {
  InvalidLink,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorCard } from "~/components/sponsors/sponsor-shell-styles";
import { sponsorVenueCopy as copy } from "~/content/sponsor-venue";
import { boothFor, boothSpot } from "~/lib/sponsor-bay-layout";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

/** The venue maps (mock sponsor-chats-v3, the /live floor plans). */
const FLOORS = [
  { id: "floor1", src: "/sponsor-map/v3/floor1.webp" },
  { id: "floor2", src: "/sponsor-map/v3/floor2.webp" },
] as const;

// The Map tab (mock sponsor-chats-v3): the sponsor's booth in the Sponsor
// Bay with where it sits, then the Level 1 and Level 2 floor plans (tap to
// open full size) and the venue address.
export default function SponsorMapPage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const [floorId, setFloorId] = useState<(typeof FLOORS)[number]["id"]>("floor1");
  const info = api.sponsorPortal.getSponsorPortalInfo.useQuery(
    { sponsor: id },
    { enabled: validUuid, refetchOnWindowFocus: false, retry: false },
  );

  const shell = (children: React.ReactNode) => (
    <SponsorShell title={copy.page.seoTitle} heading={copy.page.heading}>
      {children}
    </SponsorShell>
  );
  if (!router.isReady || (validUuid && info.isLoading))
    return shell(<ScheduleSkeleton />);
  if (!validUuid || info.error?.data?.code === "NOT_FOUND")
    return shell(<InvalidLink />);

  const booth = info.data?.boothLocation;
  const where = booth && booth !== "TBD" ? booth : null;
  const mine = boothFor(info.data?.sponsorName);
  const spot = mine ? boothSpot(mine) : null;
  const floor = FLOORS.find((f) => f.id === floorId) ?? FLOORS[0];
  const level = copy.page.levels[floor.id] ?? floor.id;
  return shell(
    <>
      <BoothLayout
        sponsorName={info.data?.sponsorName}
        title={
          <h2 className="m-0 flex items-center gap-2.5 text-base font-semibold">
            <MapPin
              aria-hidden
              className="size-5 shrink-0 text-dashboard-action-primary"
            />
            {where ? copy.page.boothAt(where) : copy.page.booth}
          </h2>
        }
        lead={
          mine &&
          spot && (
            <p className="m-0">
              <b>{copy.booths.spot(mine.side, spot.place)}</b>
              {copy.booths.neighbours(spot.neighbours)}
            </p>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="group" aria-label={copy.page.levelsLabel} className="flex gap-2">
          {FLOORS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={f.id === floor.id}
              className={chip(f.id === floor.id)}
              onClick={() => setFloorId(f.id)}
            >
              {copy.page.levels[f.id]}
            </button>
          ))}
        </div>
        <p className="m-0 text-[15px] text-dashboard-text-medium">{copy.page.hint}</p>
      </div>
      <a
        href={floor.src}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={copy.page.openFull(level)}
        className={cn(
          "block overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
          sponsorCard,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a static floor plan at its natural ratio */}
        <img src={floor.src} alt={copy.page.mapAlt(level)} className="block h-auto w-full" />
      </a>
      <p className="m-0 text-sm">{copy.page.venue}</p>
    </>,
  );
}
