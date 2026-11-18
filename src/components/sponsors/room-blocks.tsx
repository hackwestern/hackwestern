import { useState } from "react";
import { Plus } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import {
  HackerMatches,
  useDebounced,
} from "~/components/sponsors/add-coffee-chat";
import { dashboardFieldClass } from "~/components/sponsors/coffee-chat-fields";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { SponsorBadge } from "~/components/sponsors/sponsor-badge";
import { coffeeChatCopy } from "~/content/coffee-chat";
import {
  DEFAULT_HOLD_MINUTES,
  HOLD_LENGTHS,
  holdAsRoomUse,
  holdEndOf,
  holdFitsChat,
  holdMinutes,
} from "~/lib/coffee-chat-holds";
import { ROOM_CAPACITY } from "~/lib/coffee-chat-room-table";
import {
  coffeeChatExpiresAt,
  coffeeChatRoomOf,
  coffeeChatsOverlap,
} from "~/lib/coffee-chat-requests";
import { formatClock } from "~/lib/run-of-show";
import { cn } from "~/lib/utils";
import type { OrganizerHackerMatch } from "~/server/api/routers/coffee-chat-requests";
import type {
  BoardHold,
  BoardSponsor,
  ChatBoard,
} from "~/server/api/utils/coffee-chat-board";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.organizer.roomTable;
const add = coffeeChatCopy.organizer.add;
const shortName = coffeeChatCopy.organizer.board.shortName;

/** Refetch everything that shows rooms after a block changes. */
function useBlockDone(onDone?: () => void) {
  const utils = api.useUtils();
  return async () => {
    onDone?.();
    await Promise.all([
      utils.coffeeChatRequests.invalidate(),
      utils.sponsorSchedule.invalidate(),
      utils.sponsorOrganizer.invalidate(),
    ]);
  };
}

function sameRoom(a: string, b: string) {
  return (coffeeChatRoomOf(a) ?? a) === (coffeeChatRoomOf(b) ?? b);
}

/**
 * True when a block of `minutes` from `start` in `room` would run into
 * another block there (any sponsor) or past midnight. The server checks
 * this too (and chats); here it only greys out lengths.
 */
function lengthBlocked(
  board: ChatBoard,
  room: string,
  start: string,
  minutes: number,
  exceptHoldId?: string,
) {
  if (!holdEndOf(start, minutes)) return true;
  const span = { slotTime: start, durationMinutes: minutes };
  return board.holds.some(
    (h) =>
      h.holdId !== exceptHoldId &&
      sameRoom(h.room, room) &&
      coffeeChatsOverlap(holdAsRoomUse(h), span),
  );
}

// Small pills for the block lengths (15 min to 1 hr 30).
function LengthPills({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (minutes: number) => void;
  disabled: (minutes: number) => boolean;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {HOLD_LENGTHS.map((m) =>
        disabled(m) ? (
          <span
            key={m}
            aria-disabled
            className="inline-flex items-center rounded-dashboard-lg bg-dashboard-bg-inset px-3 py-2 text-sm text-dashboard-text-light"
          >
            {copy.length(m)}
          </span>
        ) : (
          <DashboardChip
            key={m}
            selected={value === m}
            onClick={() => onChange(m)}
          >
            {copy.length(m)}
          </DashboardChip>
        ),
      )}
    </div>
  );
}

// A free cell: room · time · Free, a sponsor (with their chat type and
// reps), a length, and Give room. Nothing else.
export function GiveRoom({
  board,
  room,
  slotTime,
  colors,
  onGiven,
}: {
  board: ChatBoard;
  room: string;
  slotTime: string;
  colors: ReadonlyMap<string, number>;
  onGiven: () => void;
}) {
  const sponsors = board.sponsors.filter(
    (s): s is BoardSponsor & { sponsorId: string } => s.sponsorId !== null,
  );
  const [sponsorId, setSponsorId] = useState("");
  const [length, setLength] = useState<number>(DEFAULT_HOLD_MINUTES);
  const done = useBlockDone(onGiven);
  const give = api.coffeeChatRequests.createHold.useMutation({
    onSuccess: done,
  });
  const sponsor = sponsors.find((s) => s.sponsorId === sponsorId);
  const blocked = (m: number) =>
    lengthBlocked(board, room, slotTime, m) ||
    (sponsor !== undefined && !holdFitsChat(m, sponsor.durationMinutes));
  const end = holdEndOf(slotTime, length);
  const g = copy.give;
  const selectId = `give-${room}-${slotTime}`;

  if (sponsors.length === 0) {
    return <p className="m-0 text-sm text-dashboard-text-medium">{g.noSponsors}</p>;
  }
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!sponsorId || !end || blocked(length) || give.isPending) return;
        give.mutate({ sponsorId, room, startTime: slotTime, endTime: end });
      }}
    >
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={selectId} className="text-dashboard-text-light">
          {g.sponsor}
        </label>
        <select
          id={selectId}
          value={sponsorId}
          onChange={(e) => setSponsorId(e.target.value)}
          className={dashboardFieldClass}
        >
          <option value="">{g.pickSponsor}</option>
          {sponsors.map((s) => (
            <option key={s.sponsorId} value={s.sponsorId}>
              {s.sponsor}
            </option>
          ))}
        </select>
        {sponsor && (
          <span className="flex items-center gap-2 text-dashboard-text-medium">
            <SponsorBadge name={sponsor.sponsor} colors={colors} />
            {g.format(sponsor.groupSize, sponsor.durationMinutes, sponsor.reps)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-dashboard-text-light">{g.length}</span>
        <LengthPills
          value={length}
          onChange={setLength}
          disabled={blocked}
          label={g.length}
        />
      </div>
      <DashboardButton
        type="submit"
        disabled={!sponsorId || !end || blocked(length) || give.isPending}
        className="w-fit"
      >
        {give.isPending ? g.saving : g.submit}
      </DashboardButton>
      {give.error && (
        <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
          {give.error.message || g.error}
        </p>
      )}
    </form>
  );
}

// A block: one row per slot (hackers with photo and status, booked /
// needed, or "Needs a hacker" with Add a hacker), then Change length and
// Release room.
export function BlockDetails({
  board,
  hold,
  now,
  onReleased,
}: {
  board: ChatBoard;
  hold: BoardHold;
  now: Date;
  onReleased: () => void;
}) {
  const sponsor = board.sponsors.find((s) => s.sponsorId === hold.sponsorId);
  const b = copy.block;
  const [adding, setAdding] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "length" | "release">("idle");
  const people = (sponsor?.perSlot ?? 0) + (sponsor?.reps ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={b.slotsLabel} className="flex flex-col">
        <ul className="m-0 flex list-none flex-col p-0">
          {hold.slots.map((slot) => {
            const chats = board.chats.filter((c) =>
              slot.chatIds.includes(c.chatId),
            );
            const time = formatClock(slot.slotTime);
            const open =
              slot.booked < slot.needed &&
              now < coffeeChatExpiresAt(slot.slotTime);
            return (
              <li
                key={slot.slotTime}
                className="flex flex-col gap-2 border-b border-dashboard-border-subtle py-2.5 text-sm last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <span className="w-16 shrink-0 font-semibold tabular-nums text-dashboard-text-medium">
                    {time}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    {chats.map((c) => (
                      <span key={c.chatId} className="flex min-w-0 items-center gap-2">
                        <HackerAvatar
                          name={`${c.firstName} ${c.lastName ?? ""}`}
                          github={c.github}
                          size="sm"
                        />
                        <span className="min-w-0 truncate">
                          {shortName(c.firstName, c.lastName)}
                        </span>
                        <span className="text-dashboard-text-light">
                          · {b.status[c.status]}
                        </span>
                      </span>
                    ))}
                    {slot.booked < slot.needed && (
                      <span className="text-dashboard-text-medium">
                        {b.needsHacker}
                      </span>
                    )}
                  </div>
                  <span
                    aria-label={copy.fillLabel(slot.booked, slot.needed)}
                    className="shrink-0 font-semibold tabular-nums"
                  >
                    {copy.fill(slot.booked, slot.needed)}
                  </span>
                </div>
                {open && adding !== slot.slotTime && (
                  <DashboardButton
                    variant="small"
                    aria-label={b.addLabel(time)}
                    onClick={() => setAdding(slot.slotTime)}
                    className="ml-[4.75rem] w-fit"
                  >
                    <Plus aria-hidden />
                    {b.addHacker}
                  </DashboardButton>
                )}
                {open && adding === slot.slotTime && (
                  <AddHacker
                    sponsorId={hold.sponsorId}
                    sponsor={hold.sponsor}
                    slotTime={slot.slotTime}
                    onDone={() => setAdding(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
        {people > ROOM_CAPACITY && (
          <p className="m-0 pt-1 text-xs text-dashboard-text-light">
            {b.roomNote(people, ROOM_CAPACITY)}
          </p>
        )}
      </section>

      <div className="flex flex-col gap-3 border-t border-dashboard-border-subtle pt-4">
        {mode === "idle" && (
          <div className="flex flex-wrap gap-2">
            <DashboardButton variant="outline" onClick={() => setMode("length")}>
              {b.changeLength}
            </DashboardButton>
            <DashboardButton
              variant="outline"
              onClick={() => setMode("release")}
            >
              {b.release}
            </DashboardButton>
          </div>
        )}
        {mode === "length" && (
          <ChangeLength
            board={board}
            hold={hold}
            durationMinutes={sponsor?.durationMinutes ?? 15}
            onDone={() => setMode("idle")}
          />
        )}
        {mode === "release" && (
          <Release
            hold={hold}
            onCancel={() => setMode("idle")}
            onReleased={onReleased}
          />
        )}
      </div>
    </div>
  );
}

function ChangeLength({
  board,
  hold,
  durationMinutes,
  onDone,
}: {
  board: ChatBoard;
  hold: BoardHold;
  durationMinutes: number;
  onDone: () => void;
}) {
  const b = copy.block;
  const [length, setLength] = useState(holdMinutes(hold));
  const done = useBlockDone(onDone);
  const save = api.coffeeChatRequests.moveHold.useMutation({ onSuccess: done });
  const blocked = (m: number) =>
    lengthBlocked(board, hold.room, hold.startTime, m, hold.holdId) ||
    !holdFitsChat(m, durationMinutes);
  const end = holdEndOf(hold.startTime, length);
  return (
    <div className="flex flex-col gap-3">
      <LengthPills
        value={length}
        onChange={setLength}
        disabled={blocked}
        label={b.changeLength}
      />
      <div className="flex flex-wrap gap-2">
        <DashboardButton
          variant="outline"
          disabled={!end || blocked(length) || save.isPending}
          onClick={() =>
            end &&
            save.mutate({
              holdId: hold.holdId,
              room: hold.room,
              startTime: hold.startTime,
              endTime: end,
            })
          }
        >
          {b.save}
        </DashboardButton>
        <DashboardButton variant="tertiary" onClick={onDone}>
          {b.cancel}
        </DashboardButton>
      </div>
      {save.error && (
        <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
          {save.error.message || b.error}
        </p>
      )}
    </div>
  );
}

function Release({
  hold,
  onCancel,
  onReleased,
}: {
  hold: BoardHold;
  onCancel: () => void;
  onReleased: () => void;
}) {
  const b = copy.block;
  const done = useBlockDone(onReleased);
  const release = api.coffeeChatRequests.deleteHold.useMutation({
    onSuccess: done,
  });
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-sm">{b.releaseConfirm(hold.sponsor)}</p>
      <div className="flex flex-wrap gap-2">
        <DashboardButton
          variant="outline"
          disabled={release.isPending}
          onClick={() => release.mutate({ holdId: hold.holdId })}
        >
          {b.confirmRelease}
        </DashboardButton>
        <DashboardButton variant="tertiary" onClick={onCancel}>
          {b.cancel}
        </DashboardButton>
      </div>
      {release.error && (
        <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
          {release.error.message || b.error}
        </p>
      )}
    </div>
  );
}

// Find a hacker and send them a request for this slot (same rules and
// notification as a sponsor's offer; they accept on /live).
function AddHacker({
  sponsorId,
  sponsor,
  slotTime,
  onDone,
}: {
  sponsorId: string;
  sponsor: string;
  slotTime: string;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [hacker, setHacker] = useState<OrganizerHackerMatch | null>(null);
  const search = useDebounced(query.trim(), 250);
  const matches = api.coffeeChatRequests.searchHackers.useQuery(
    { query: search },
    { enabled: !hacker && search.length >= 2, retry: false },
  );
  const done = useBlockDone(onDone);
  const offer = api.coffeeChatRequests.organizerOffer.useMutation({
    onSuccess: done,
  });
  const inputId = `add-${sponsorId}-${slotTime}`;
  return (
    <form
      className="ml-[4.75rem] flex flex-col gap-2"
      aria-label={copy.block.addLabel(formatClock(slotTime))}
      onSubmit={(e) => {
        e.preventDefault();
        if (!hacker || offer.isPending) return;
        offer.mutate({ sponsorId, userId: hacker.userId, slotTime });
      }}
    >
      {hacker ? (
        <div className="flex min-h-10 items-center justify-between gap-2 rounded-dashboard-md bg-dashboard-bg-inset px-3 py-2">
          <span className="min-w-0 break-words">
            <span className="font-semibold">{hacker.name}</span>
            <span className="block break-all text-dashboard-text-light">
              {add.code(hacker.hackerId)}
            </span>
          </span>
          <DashboardButton
            type="button"
            variant="tertiary"
            onClick={() => setHacker(null)}
          >
            {add.change}
          </DashboardButton>
        </div>
      ) : (
        <>
          <label htmlFor={inputId} className="sr-only">
            {add.hacker}
          </label>
          <input
            id={inputId}
            type="search"
            autoComplete="off"
            autoFocus
            value={query}
            placeholder={add.hackerPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
            aria-describedby="add-chat-hacker-status"
            className={dashboardFieldClass}
          />
          <HackerMatches
            query={query.trim()}
            settled={search}
            loading={matches.isFetching}
            matches={matches.data}
            onPick={setHacker}
          />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <DashboardButton
          type="submit"
          variant="small"
          disabled={!hacker || offer.isPending}
        >
          {add.submit}
        </DashboardButton>
        <DashboardButton type="button" variant="tertiary" onClick={onDone}>
          {copy.block.cancel}
        </DashboardButton>
      </div>
      {offer.error && (
        <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
          {offer.error.message || add.addError}
        </p>
      )}
    </form>
  );
}

// Per-sponsor strip above the room table: logo, chat type, reps, blocks,
// hackers booked / needed. Picking one highlights their blocks.
export function SponsorStrip({
  items,
  colors,
  highlight,
  onHighlight,
}: {
  items: {
    sponsor: string;
    sponsorId: string;
    groupSize: number;
    reps: number;
    blocks: number;
    booked: number;
    needed: number;
  }[];
  colors: ReadonlyMap<string, number>;
  highlight: string | null;
  onHighlight?: (name: string) => void;
}) {
  if (items.length === 0) return null;
  const s = copy.strip;
  return (
    <ul
      aria-label={s.label}
      className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1"
    >
      {items.map((item) => (
        <li key={item.sponsorId} className="shrink-0">
          <button
            type="button"
            aria-pressed={highlight === item.sponsor}
            aria-label={s.highlight(item.sponsor)}
            onClick={() => onHighlight?.(item.sponsor)}
            className={cn(
              "flex min-w-44 flex-col gap-1 rounded-dashboard-md border border-dashboard-border-subtle bg-dashboard-bg-surface px-3 py-2 text-left text-xs leading-4",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
              highlight === item.sponsor &&
                "ring-2 ring-dashboard-text-heavy ring-offset-1",
            )}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-dashboard-text-heavy">
              <SponsorBadge name={item.sponsor} colors={colors} className="size-5" />
              <span className="truncate">{item.sponsor}</span>
            </span>
            <span className="text-dashboard-text-medium">
              {copy.chatType(item.groupSize, item.reps)}
            </span>
            <span className="flex justify-between gap-2 text-dashboard-text-medium">
              <span>{s.blocks(item.blocks)}</span>
              {item.blocks > 0 && (
                <span className="font-semibold tabular-nums text-dashboard-text-heavy">
                  {s.hackers(item.booked, item.needed)}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
