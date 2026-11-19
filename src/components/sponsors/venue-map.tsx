import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { sponsorVenueCopy as copy } from "~/content/sponsor-venue";
import {
  SPONSOR_MAP_FLOORS,
  SPONSOR_MAP_ROOMS,
  type SponsorMapFloorId,
} from "~/lib/sponsor-map-rooms";
import { cn } from "~/lib/utils";

const PLACES = copy.places.map((p) => ({
  ...p,
  pin: SPONSOR_MAP_ROOMS.find((r) => r.id === p.room) ?? null,
}));

/** The map dialog around any trigger (the header button, a text link). */
export function VenueMapDialog({
  trigger,
  initialFloor = "floor2",
}: {
  trigger: React.ReactNode;
  initialFloor?: SponsorMapFloorId;
}) {
  const [floorId, setFloorId] = useState<SponsorMapFloorId>(initialFloor);

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40 duration-200 ease-out data-[state=closed]:duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        {/* Same motion as the schedule's details dialog: a bottom sheet on
            phones, a centred dialog wider up. */}
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[92dvh] w-full flex-col gap-4 overflow-y-auto overscroll-contain bg-dashboard-bg-surface p-5 font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card focus:outline-none sm:p-6",
            "inset-x-0 bottom-0 rounded-t-dashboard-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]",
            "ease-out data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full motion-reduce:animate-none",
            "sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[880px] sm:rounded-dashboard-2xl sm:pb-6",
            "sm:data-[state=closed]:duration-150 sm:data-[state=open]:duration-200 sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Dialog.Title className="m-0 text-xl font-semibold">
                {copy.map.title}
              </Dialog.Title>
              <Dialog.Description className="m-0 text-sm text-dashboard-text-light">
                {copy.map.description}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={copy.map.close}
              className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.97] [@media(hover:hover)]:hover:bg-dashboard-bg-highlight"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>

          <VenueFloors floorId={floorId} onFloorChange={setFloorId} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * The floor plans with the rooms sponsors use pinned, and the key places
 * under them. Shared by the map dialog and the Map page.
 */
export function VenueFloors({
  floorId,
  onFloorChange,
}: {
  floorId: SponsorMapFloorId;
  onFloorChange: (id: SponsorMapFloorId) => void;
}) {
  const floor =
    SPONSOR_MAP_FLOORS.find((f) => f.id === floorId) ?? SPONSOR_MAP_FLOORS[0];
  const pins = PLACES.filter((p) => p.pin?.floor === floor.id);
  return (
    <>
      {/* Floor pills */}
      <div
        role="group"
        aria-label={copy.map.floors}
        data-tour="map-floors"
        className="flex flex-wrap gap-2"
      >
        {SPONSOR_MAP_FLOORS.map((f) => (
          <DashboardChip
            key={f.id}
            selected={f.id === floor.id}
            onClick={() => onFloorChange(f.id)}
          >
            {f.label}
          </DashboardChip>
        ))}
      </div>

      <div className="relative w-full shrink-0 overflow-hidden rounded-dashboard-lg border border-dashboard-border-subtle bg-dashboard-bg-inset">
        {/* eslint-disable-next-line @next/next/no-img-element -- a static
            floor plan shown at its natural ratio; next/image adds nothing */}
        <img
          src={floor.image}
          alt={copy.map.floorAlt(floor.label)}
          width={floor.width}
          height={floor.height}
          className="block h-auto w-full"
        />
        {pins.map(
          (p) =>
            p.pin && (
              <span
                key={p.room}
                aria-hidden
                style={{ left: `${p.pin.x}%`, top: `${p.pin.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-dashboard-action-primary bg-dashboard-action-primary px-2 py-0.5 text-xs font-semibold text-dashboard-text-inverse shadow-dashboard-card"
              >
                {p.name}
              </span>
            ),
        )}
      </div>

      <section
        aria-labelledby="venue-key-places"
        className="flex flex-col gap-2"
      >
        <h3
          id="venue-key-places"
          className="dashboard-section-label m-0 text-dashboard-text-light"
        >
          {copy.map.keyPlaces}
        </h3>
        <ul className="m-0 grid list-none gap-x-6 gap-y-2 p-0 sm:grid-cols-2">
          {PLACES.map((p) => (
            <li
              key={p.room}
              data-tour={`map-place-${p.room}`}
              className="flex flex-col"
            >
              <span className="text-sm font-semibold">{p.name}</span>
              <span className="text-sm text-dashboard-text-light">
                {p.where}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
