import { useState } from "react";
import { useRouter } from "next/router";
import { MapPin } from "lucide-react";
import { BoothLayout } from "~/components/sponsors/booth-layout";
import {
  InvalidLink,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { VenueFloors } from "~/components/sponsors/venue-map";
import { sponsorCard } from "~/components/sponsors/sponsor-shell-styles";
import { sponsorVenueCopy as copy } from "~/content/sponsor-venue";
import {
  SPONSOR_MAP_FLOORS,
  type SponsorMapFloorId,
} from "~/lib/sponsor-map-rooms";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

// The Map tab (design: mocks/sponsor-portal-flow-hacker-v6 #map): the
// sponsor's booth in the Sponsor Bay, then the floor plans with the rooms
// sponsors use. It replaces the Map button the header used to have; the
// map tour's steps (map-floors, map-place-*) target this page.
export default function SponsorMapPage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const [floorId, setFloorId] = useState<SponsorMapFloorId>(
    SPONSOR_MAP_FLOORS[0].id,
  );
  const info = api.sponsorPortal.getSponsorPortalInfo.useQuery(
    { sponsor: id },
    { enabled: validUuid, refetchOnWindowFocus: false, retry: false },
  );

  const shell = (children: React.ReactNode) => (
    <SponsorShell
      title={copy.page.seoTitle}
      heading={copy.page.heading}
      lead={copy.page.lead}
    >
      {children}
    </SponsorShell>
  );
  if (!router.isReady || (validUuid && info.isLoading))
    return shell(<ScheduleSkeleton />);
  if (!validUuid || info.error?.data?.code === "NOT_FOUND")
    return shell(<InvalidLink />);

  const booth = info.data?.boothLocation;
  const where = booth && booth !== "TBD" ? booth : null;
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
      />
      <section
        aria-label={copy.page.floorsHeading}
        className={cn("flex flex-col gap-4", sponsorCard)}
      >
        <VenueFloors floorId={floorId} onFloorChange={setFloorId} />
      </section>
    </>,
  );
}
