import { hover } from "~/components/internals/interaction";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { useLiveChatBoard } from "~/components/sponsors/coffee-chat-room-table";
import { Pin, RoomDetails } from "~/components/sponsors/sponsor-map";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { sponsorMapCopy } from "~/content/sponsor-map";
import {
  boardTimeAt,
  coffeeRoomsAt,
  type CoffeeRoomAt,
} from "~/lib/coffee-chat-map";
import { coffeeChatStartsAt } from "~/lib/coffee-chat-requests";
import { formatClock, type CompanyLocations } from "~/lib/run-of-show";
import { roomsOnFloor, sponsorMapOccupancy } from "~/lib/sponsor-map";
import {
  COFFEE_CHAT_MAP_FOCUS,
  inFocus,
  SPONSOR_MAP_FLOORS,
  type SponsorMapFloorId,
} from "~/lib/sponsor-map-rooms";
import { cn } from "~/lib/utils";
import type { ChatBoard } from "~/server/api/utils/coffee-chat-board";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.organizer.side;

// Beside the coffee chat room table (below it on phones, folded): the
// coffee chat rooms on the floor plan and which sponsor is in each, right now. No time
// picking: it follows the clock and the live board polling.
export function CoffeeChatLiveMap({ now }: { now: Date }) {
  const board = useLiveChatBoard();
  const companies = api.sponsorSchedule.organizerCompanies.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const [focusSponsor, setFocusSponsor] = useState<string | null>(null);
  if (!board.data) return null;
  const slots = board.data.slots;
  const time = boardTimeAt(slots, now);
  if (!time) return null;
  const first = slots[0]!;
  const last = slots[slots.length - 1]!;
  const running =
    now >= coffeeChatStartsAt(first) &&
    now.getTime() < coffeeChatStartsAt(last).getTime() + 15 * 60_000;
  const clock = formatClock(time);
  const rooms = coffeeRoomsAt(board.data, board.data.assignableRooms, time);

  return (
    <aside aria-label={copy.label} className="flex min-w-0 flex-col gap-4">
      <Section id="live-map" title={copy.mapHeading}>
        <p
          aria-live="polite"
          className="m-0 text-sm font-semibold text-dashboard-text-heavy"
        >
          {running ? copy.nowAt(formatClock(time)) : copy.notToday}
        </p>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {copy.mapIntroLive}
        </p>
        <RoomsMap
          board={board.data}
          companies={companies.data}
          rooms={running ? rooms : rooms.map(emptyRoom)}
          at={now}
          clock={clock}
          focusSponsor={focusSponsor}
          onFocusSponsor={setFocusSponsor}
        />
      </Section>
    </aside>
  );
}

function emptyRoom(room: CoffeeRoomAt): CoffeeRoomAt {
  return { ...room, sponsor: null, accepted: 0, pending: 0 };
}

// A card on desktop; on phones the body folds away behind its heading.
function Section({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex min-w-0 flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${id}-heading`} className="m-0 text-base font-semibold">
          {title}
        </h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          aria-label={open ? copy.hide(title) : copy.show(title)}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "-my-2 -mr-2 inline-flex size-11 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary lg:hidden",
            hover.highlight,
          )}
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "size-5 motion-safe:transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </div>
      <div
        id={`${id}-body`}
        className={cn(
          "min-w-0 flex-col gap-3",
          open ? "flex" : "hidden lg:flex",
        )}
      >
        {children}
      </div>
    </section>
  );
}

function chatLine(room: CoffeeRoomAt, clock: string): string {
  return room.sponsor
    ? copy.chatsAt(room.accepted + room.pending, clock)
    : copy.free;
}

function RoomsMap({
  board,
  companies,
  rooms,
  at,
  clock,
  focusSponsor,
  onFocusSponsor,
}: {
  board: Pick<ChatBoard, "sponsors">;
  companies: CompanyLocations | undefined;
  rooms: CoffeeRoomAt[];
  at: Date;
  clock: string;
  focusSponsor: string | null;
  onFocusSponsor: (sponsor: string | null) => void;
}) {
  const focus = COFFEE_CHAT_MAP_FOCUS;
  const [floor, setFloor] = useState<SponsorMapFloorId>(focus.floor);
  const [picked, setPicked] = useState<string | null>(null);
  const floorInfo = SPONSOR_MAP_FLOORS.find((f) => f.id === floor)!;
  const crop = floor === focus.floor ? focus : null;

  const watchers = Object.fromEntries(
    board.sponsors.map((s) => [s.sponsor, s.watcher]),
  );
  const { byRoom } = companies
    ? sponsorMapOccupancy(companies, watchers, at)
    : { byRoom: {} as ReturnType<typeof sponsorMapOccupancy>["byRoom"] };
  const coffeeIds = new Set(rooms.flatMap((r) => (r.pin ? [r.pin.id] : [])));
  const others = roomsOnFloor(floor).filter(
    (r) => !coffeeIds.has(r.id) && (!crop || inFocus(r, crop)),
  );
  const coffeePins = rooms.filter(
    (r) => r.pin?.floor === floor && (!crop || inFocus(r.pin, crop)),
  );
  const pickedRoom = roomsOnFloor(floor).find((r) => r.id === picked) ?? null;

  return (
    <>
      <div
        role="group"
        aria-label={sponsorMapCopy.floors}
        className="flex flex-wrap gap-2"
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

      {/* Zoomed into the coffee chat rooms on their floor: the image is
          scaled up and shifted so the crop fills the box (percent offsets
          are of the box, which has the crop's aspect ratio). */}
      <div
        className="relative overflow-hidden rounded-dashboard-md border border-dashboard-border-subtle"
        style={
          crop
            ? {
                aspectRatio: `${floorInfo.width * crop.width} / ${floorInfo.height * crop.height}`,
              }
            : undefined
        }
      >
        <div
          className={crop ? "absolute" : "relative"}
          style={
            crop
              ? {
                  width: `${10_000 / crop.width}%`,
                  left: `${(-crop.x * 100) / crop.width}%`,
                  top: `${(-crop.y * 100) / crop.height}%`,
                }
              : undefined
          }
        >
          <Image
            src={floorInfo.image}
            width={floorInfo.width}
            height={floorInfo.height}
            alt={sponsorMapCopy.floorAlt(floorInfo.label)}
            sizes={crop ? "2000px" : "420px"}
            className="block h-auto w-full"
          />
          {others.map((room) => (
            <Pin
              key={room.id}
              room={room}
              count={byRoom[room.id]?.length ?? 0}
              selected={picked === room.id}
              muted
              onPick={() => setPicked(picked === room.id ? null : room.id)}
            />
          ))}
          {coffeePins.map((room) => (
            <CoffeePin
              key={room.name}
              room={room}
              line={chatLine(room, clock)}
              selected={
                room.sponsor !== null
                  ? focusSponsor === room.sponsor
                  : picked === room.pin!.id
              }
              onPick={() => {
                if (room.sponsor) {
                  setPicked(null);
                  onFocusSponsor(
                    focusSponsor === room.sponsor ? null : room.sponsor,
                  );
                } else {
                  setPicked(picked === room.pin!.id ? null : room.pin!.id);
                }
              }}
            />
          ))}
        </div>
      </div>

      {pickedRoom && (
        <div aria-live="polite">
          <RoomDetails
            room={pickedRoom}
            entries={byRoom[pickedRoom.id] ?? []}
          />
        </div>
      )}

      {/* The same rooms in text, for screen readers and quick reading. */}
      <section aria-labelledby="side-rooms" className="flex flex-col gap-2">
        <h3 id="side-rooms" className="m-0 text-sm font-semibold">
          {copy.roomsNow}
        </h3>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rooms.map((room) => (
            <li
              key={room.name}
              className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
            >
              <span className="min-w-0 break-words">
                <span className="font-semibold">{room.name}</span>
                {room.sponsor && (
                  <span className="text-dashboard-text-medium">
                    {" · "}
                    {room.sponsor}
                  </span>
                )}
              </span>
              <span
                className={
                  room.sponsor
                    ? "text-dashboard-text-medium"
                    : "text-dashboard-text-light"
                }
              >
                {room.sponsor
                  ? copy.breakdown(room.accepted, room.pending)
                  : copy.free}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

// A coffee chat room: a dot on the room with a card beside it naming the
// sponsor and their chats at the shown time. Picking it highlights the
// sponsor's column in the table.
function CoffeePin({
  room,
  line,
  selected,
  onPick,
}: {
  room: CoffeeRoomAt;
  line: string;
  selected: boolean;
  onPick: () => void;
}) {
  const busy = room.sponsor !== null;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={copy.roomPin(room.name, room.sponsor, line)}
      style={{ left: `${room.pin!.x}%`, top: `${room.pin!.y}%` }}
      className="group absolute flex -translate-x-1.5 -translate-y-1/2 items-center gap-1 text-left focus-visible:outline-none"
    >
      <span
        aria-hidden
        className={cn(
          "size-3 shrink-0 rounded-full border-2 border-dashboard-bg-surface shadow-dashboard-card",
          busy ? "bg-dashboard-action-primary" : "bg-dashboard-border-medium",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "flex max-w-[9.5rem] flex-col rounded-dashboard-md border px-2 py-1 text-xs leading-tight shadow-dashboard-card",
          "group-focus-visible:ring-2 group-focus-visible:ring-dashboard-action-primary group-focus-visible:ring-offset-2",
          busy
            ? "border-dashboard-action-primary bg-dashboard-bg-surface text-dashboard-text-heavy"
            : "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-light",
          selected &&
            "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse",
        )}
      >
        <span className="truncate font-semibold">
          {room.pin!.label}
          {room.sponsor ? ` · ${room.sponsor}` : ""}
        </span>
        <span className="whitespace-nowrap">{line}</span>
      </span>
    </button>
  );
}
