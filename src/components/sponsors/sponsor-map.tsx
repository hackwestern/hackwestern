import Image from "next/image";
import { useState } from "react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { dashboardFieldClass } from "~/components/sponsors/coffee-chat-fields";
import { sponsorMapCopy as copy } from "~/content/sponsor-map";
import type { CompanyLocations, RunOfShowDay } from "~/lib/run-of-show";
import { runOfShowInstant } from "~/lib/run-of-show-time";
import {
  roomsOnFloor,
  sponsorMapOccupancy,
  type SponsorMapEntry,
} from "~/lib/sponsor-map";
import {
  SPONSOR_MAP_FLOORS,
  type SponsorMapFloorId,
  type SponsorMapRoom,
} from "~/lib/sponsor-map-rooms";
import { cn } from "~/lib/utils";

/** "HH:MM" of `now` in Eastern time, the run of show's clock. */
function easternClock(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

// Floor plans with a pin per sponsor room; each pin lists who is there at
// the chosen day and time (now by default). Pins live in
// src/lib/sponsor-map-rooms.ts. The list below the map says the same in text.
export function SponsorMap({
  data,
  watchers,
  day,
  now,
}: {
  data: CompanyLocations;
  /** Sponsor name -> sponsor-team member watching their coffee chats. */
  watchers: Readonly<Record<string, string | null>>;
  day: RunOfShowDay;
  now: Date;
}) {
  // null = follow the clock.
  const [time, setTime] = useState<string | null>(null);
  const [floor, setFloor] = useState<SponsorMapFloorId>("floor2");
  const [picked, setPicked] = useState<string | null>(null);

  const shownTime = time ?? easternClock(now);
  const at = runOfShowInstant(day, shownTime);
  const { byRoom, unplaced } = sponsorMapOccupancy(data, watchers, at);
  const floorInfo = SPONSOR_MAP_FLOORS.find((f) => f.id === floor)!;
  const rooms = roomsOnFloor(floor);
  const selected =
    rooms.find((r) => r.id === picked) ??
    rooms.find((r) => (byRoom[r.id]?.length ?? 0) > 0) ??
    null;

  return (
    <DashboardPanel>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-lg font-semibold">{copy.heading}</h2>
          <p className="m-0 text-sm text-dashboard-text-medium">{copy.intro}</p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-dashboard-text-light">{copy.time}</span>
            <input
              type="time"
              step={900}
              value={shownTime}
              onChange={(e) => setTime(e.target.value || null)}
              className={dashboardFieldClass}
            />
          </label>
          <DashboardButton
            variant="outline"
            className="h-10"
            disabled={time === null}
            onClick={() => setTime(null)}
          >
            {copy.now}
          </DashboardButton>
          <div
            role="group"
            aria-label={copy.floors}
            className="flex gap-2 sm:ml-auto"
          >
            {SPONSOR_MAP_FLOORS.map((f) => (
              <DashboardChip
                key={f.id}
                selected={f.id === floor}
                onClick={() => {
                  setFloor(f.id);
                  setPicked(null);
                }}
                className="min-h-11"
              >
                {f.label}
              </DashboardChip>
            ))}
          </div>
        </div>

        {/* Wider than a phone on purpose, so close pins stay apart; it
            scrolls sideways inside this box, never the page. */}
        <div className="overflow-x-auto rounded-dashboard-md border border-dashboard-border-subtle">
          <div className="relative min-w-[720px]">
            <Image
              src={floorInfo.image}
              width={floorInfo.width}
              height={floorInfo.height}
              alt={copy.floorAlt(floorInfo.label)}
              sizes="(min-width: 920px) 840px, 720px"
              className="block h-auto w-full"
            />
            {rooms.map((room) => (
              <Pin
                key={room.id}
                room={room}
                count={byRoom[room.id]?.length ?? 0}
                selected={selected?.id === room.id}
                onPick={() => setPicked(room.id)}
              />
            ))}
          </div>
        </div>

        <div aria-live="polite">
          {selected ? (
            <RoomDetails room={selected} entries={byRoom[selected.id] ?? []} />
          ) : (
            <p className="m-0 text-sm text-dashboard-text-light">
              {copy.pickPin}
            </p>
          )}
        </div>

        <RoomList byRoom={byRoom} unplaced={unplaced} />
      </div>
    </DashboardPanel>
  );
}

/**
 * A room pin. `muted` draws it smaller and quiet, for rooms that are context
 * rather than the point (the Coffee chats tab's non-coffee rooms).
 */
export function Pin({
  room,
  count,
  selected,
  onPick,
  muted = false,
}: {
  room: SponsorMapRoom;
  count: number;
  selected: boolean;
  onPick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={copy.pin(room.label, count)}
      style={{ left: `${room.x}%`, top: `${room.y}%` }}
      className={cn(
        "absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
        muted
          ? "h-6 border-dashboard-border-subtle bg-dashboard-bg-inset px-1.5 text-xs text-dashboard-text-light"
          : "h-7 px-2 text-xs shadow-dashboard-card",
        !muted &&
          (count > 0
            ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
            : "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-light"),
        selected && "ring-2 ring-dashboard-text-heavy ring-offset-2",
      )}
    >
      {room.label}
      {count > 0 && (
        <span className="rounded-full bg-dashboard-bg-surface px-1.5 text-dashboard-text-active">
          {count}
        </span>
      )}
    </button>
  );
}

function entryLine(e: SponsorMapEntry): string {
  if (e.kind === "coffee") return copy.coffee;
  if (e.kind === "bay") return copy.bay;
  return e.title;
}

function Entries({ entries }: { entries: SponsorMapEntry[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {entries.map((e) => (
        <li key={e.sponsor} className="flex flex-col gap-0.5 text-sm">
          <span className="font-semibold">{e.sponsor}</span>
          <span className="text-dashboard-text-medium">
            {entryLine(e)}
            {e.kind === "coffee" && e.watcher
              ? ` · ${copy.watcher(e.watcher)}`
              : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RoomDetails({
  room,
  entries,
}: {
  room: SponsorMapRoom;
  entries: SponsorMapEntry[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-dashboard-md bg-dashboard-bg-inset p-3">
      <h3 className="m-0 text-base font-semibold">
        {copy.roomTitle(room.label, room.id)}
      </h3>
      {entries.length === 0 ? (
        <p className="m-0 text-sm text-dashboard-text-light">{copy.empty}</p>
      ) : (
        <Entries entries={entries} />
      )}
    </div>
  );
}

// Text version of the map: every occupied room on both floors, then
// sponsors whose location has no pin.
function RoomList({
  byRoom,
  unplaced,
}: {
  byRoom: Record<string, SponsorMapEntry[]>;
  unplaced: SponsorMapEntry[];
}) {
  const floors = SPONSOR_MAP_FLOORS.map((f) => ({
    ...f,
    rooms: roomsOnFloor(f.id).filter((r) => (byRoom[r.id]?.length ?? 0) > 0),
  })).filter((f) => f.rooms.length > 0);

  return (
    <section aria-labelledby="map-list" className="flex flex-col gap-3">
      <h3 id="map-list" className="m-0 text-base font-semibold">
        {copy.listHeading}
      </h3>
      {floors.length === 0 && unplaced.length === 0 ? (
        <p className="m-0 text-sm text-dashboard-text-light">{copy.nobody}</p>
      ) : (
        <dl className="m-0 flex flex-col gap-3">
          {floors.flatMap((f) =>
            f.rooms.map((room) => (
              <div
                key={room.id}
                className="flex flex-col gap-1 border-b border-dashboard-border-subtle pb-3 last:border-0"
              >
                <dt className="text-sm text-dashboard-text-light">
                  {f.label} · {copy.roomTitle(room.label, room.id)}
                </dt>
                <dd className="m-0">
                  <Entries entries={byRoom[room.id]!} />
                </dd>
              </div>
            )),
          )}
          {unplaced.length > 0 && (
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-dashboard-text-light">
                {copy.unplaced}
              </dt>
              <dd className="m-0">
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {unplaced.map((e) => (
                    <li
                      key={e.sponsor}
                      className="flex flex-col gap-0.5 text-sm"
                    >
                      <span className="font-semibold">{e.sponsor}</span>
                      <span className="text-dashboard-text-medium">
                        {entryLine(e)}
                        {" · "}
                        {e.location ?? copy.noRoom}
                      </span>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
