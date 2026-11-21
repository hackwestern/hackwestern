import { useRouter } from "next/router";
import { MapPin, TriangleAlert } from "lucide-react";
import { BoothLayout } from "~/components/sponsors/booth-layout";
import { Note } from "~/components/sponsors/portal-ui";
import VenueMap, { type VenueMapHighlight } from "~/components/live/venue-map";
import {
  InvalidLink,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { sponsorVenueCopy as copy } from "~/content/sponsor-venue";
import { boothFor, boothSpot } from "~/lib/sponsor-bay-layout";
import { floorForQuery, roomsForLocation } from "~/lib/venue-map";
import { IveyWalkNote } from "~/components/ivey-walk-note";
import { showChats } from "~/lib/sponsor-chats";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

/** The Sponsor Bay on the venue map (~/lib/venue-map). */
const SPONSOR_BAY = "1235";
const LOUNGE = "2110";
const BELONGINGS = "2244";

const marks = copy.page.marks;

// The Map tab: the sponsor's booth in the Sponsor Bay with where it sits,
// then the /live floor plan (SEI levels 1 and 2, and the Ivey building) with
// this sponsor's rooms outlined: booth, workshop, coffee chat rooms once
// organizers confirm them, the sponsor lounge and where to leave things.
export default function SponsorMapPage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const info = api.sponsorPortal.getSponsorPortalInfo.useQuery(
    { sponsor: id },
    { enabled: validUuid, refetchOnWindowFocus: false, retry: false },
  );
  const setup = api.coffeeChatSetup.get.useQuery(
    { sponsor: id },
    { enabled: validUuid, retry: false, refetchOnWindowFocus: false },
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

  const highlights: VenueMapHighlight[] = [];
  const add = (rooms: string[], label: string, tour?: string) =>
    rooms.forEach((room) => highlights.push({ room, label, tour }));
  // A booth on the Sponsor Bay layout, or a booth location from the sheet
  const hasBooth = !!mine || where !== null;
  if (hasBooth) {
    add([roomsForLocation(where ?? "")[0] ?? SPONSOR_BAY], marks.booth);
  }
  add(
    (setup.data?.workshops ?? []).flatMap((w) =>
      roomsForLocation(w.location ?? ""),
    ),
    marks.workshop,
  );
  // Chat rooms are only theirs once organizers confirm them
  if (setup.data?.confirmed) {
    add([...new Set(setup.data.chats.map((c) => c.room))], marks.chats);
  }
  add([LOUNGE], marks.lounge, "map-place-2110");
  add([BELONGINGS], marks.belongings, "map-place-2244");

  return shell(
    <>
      <div data-tour="map-booth" className="min-w-0">
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
      </div>
      <div data-tour="map-floors" className="min-w-0">
        {/* ?building=ivey (the Ivey walk "Check map" link) opens on Ivey. */}
        <VenueMap
          key={String(router.query.building ?? "")}
          initialFloor={floorForQuery(router.query.building)}
          highlights={highlights}
          highlightsLabel={copy.page.marksLabel}
        />
      </div>
      {setup.data?.confirmed &&
        setup.data.chats.some((c) => c.building === "ivey") && (
          <IveyWalkNote who="sponsor" mapHref={null} />
        )}
      <Note icon={<TriangleAlert aria-hidden />} tone="strong">
        <p className="m-0 font-bold">{copy.page.venue.lead}</p>
        <ul className="m-0 mt-1 flex list-disc flex-col gap-1 pl-5">
          <li>{copy.page.venue.main}</li>
          {/* Rooms 1348–1358 are coffee chat rooms. */}
          {showChats(info.data) && <li>{copy.page.venue.ivey}</li>}
        </ul>
      </Note>
    </>,
  );
}
