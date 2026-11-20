import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, Plus, TriangleAlert, X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import {
  HackerMatches,
  useDebounced,
} from "~/components/sponsors/add-coffee-chat";
import {
  ChatRequestForm,
  requestSummary,
} from "~/components/sponsors/chat-request-form";
import { dashboardFieldClass } from "~/components/sponsors/coffee-chat-fields";
import { hover } from "~/components/internals/interaction";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { SponsorBadge } from "~/components/sponsors/sponsor-badge";
import { sponsorLogo } from "~/lib/sponsor-logos";
import { coffeeChatCopy } from "~/content/coffee-chat";
import {
  DEFAULT_HOLD_MINUTES,
  HOLD_LENGTHS,
  holdAsRoomUse,
  holdEndOf,
  holdFitsChat,
  holdMinutes,
} from "~/lib/coffee-chat-holds";
import {
  chatExpiresAt,
  coffeeChatRoomOf,
  coffeeChatsOverlap,
} from "~/lib/coffee-chat-requests";
import { formatClock } from "~/lib/run-of-show";
import { cn } from "~/lib/utils";
import type { OrganizerHackerMatch } from "~/server/api/routers/coffee-chat-requests";
import type {
  BoardChat,
  BoardHold,
  BoardSponsor,
  ChatBoard,
} from "~/server/api/utils/coffee-chat-board";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.organizer.roomTable;
const add = coffeeChatCopy.organizer.add;
const shortName = coffeeChatCopy.organizer.board.shortName;
const booked = coffeeChatCopy.organizer;

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
      {HOLD_LENGTHS.map((m) => (
        <DashboardChip
          key={m}
          selected={value === m && !disabled(m)}
          disabled={disabled(m)}
          onClick={() => onChange(m)}
        >
          {copy.length(m)}
        </DashboardChip>
      ))}
    </div>
  );
}

// A free cell: room · time · Free, a sponsor (with their request), a
// length, and Give room. Nothing else.
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
    (sponsor !== undefined &&
      !holdFitsChat(m, sponsor.request.durationMinutes));
  const end = holdEndOf(slotTime, length);
  const g = copy.give;
  const selectId = `give-${room}-${slotTime}`;

  if (sponsors.length === 0) {
    return (
      <p className="m-0 text-sm text-dashboard-text-medium">{g.noSponsors}</p>
    );
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
            {g.request(
              requestSummary(sponsor.request),
              sponsor.request.durationMinutes,
            )}
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

// Inside a sponsor's block: each slot's status in plain words ("Still
// missing 2 hackers · 1 waiting on approval"), its hackers with Cancel or
// Reject, and Invite a hacker. Change length and Release room sit at the
// bottom as small links. Nothing about giving the room (Jazz, 2026-11-18).
export function BlockDetails({
  board,
  hold,
  now,
  onReleased,
}: {
  board: ChatBoard & { rooms: string[] };
  hold: BoardHold;
  now: Date;
  onReleased: () => void;
}) {
  const sponsor = board.sponsors.find((s) => s.sponsorId === hold.sponsorId);
  const b = copy.block;
  const [adding, setAdding] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "length" | "release">("idle");

  return (
    <div className="flex flex-col gap-4">
      <section aria-label={b.slotsLabel} className="flex flex-col">
        <ul className="m-0 flex list-none flex-col p-0">
          {hold.slots.map((slot) => {
            const chats = board.chats.filter((c) =>
              slot.chatIds.includes(c.chatId),
            );
            const waiting = chats.filter((c) => c.status === "pending").length;
            const time = formatClock(slot.slotTime);
            const open = slot.booked < slot.needed && now < chatExpiresAt(slot);
            return (
              <li
                key={slot.slotTime}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-2 border-b border-dashboard-border-subtle py-3 text-sm last:border-b-0"
              >
                <span className="font-semibold tabular-nums text-dashboard-text-medium">
                  {time}
                </span>
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-dashboard-text-heavy">
                      {b.slotStatus(slot.needed - slot.booked, waiting)}
                    </span>
                    <SlotFill slot={slot} status={false} />
                  </span>
                  {chats.map((c) => (
                    <BlockChat key={c.chatId} chat={c} sponsor={hold.sponsor} />
                  ))}
                  {open && adding !== slot.slotTime && (
                    <DashboardButton
                      variant="small"
                      aria-label={b.inviteLabel(time)}
                      onClick={() => setAdding(slot.slotTime)}
                      className="w-fit"
                    >
                      <Plus aria-hidden />
                      {b.invite}
                    </DashboardButton>
                  )}
                  {open && adding === slot.slotTime && (
                    <AddHacker
                      sponsorId={hold.sponsorId}
                      slotTime={slot.slotTime}
                      onDone={() => setAdding(null)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-col gap-3 border-t border-dashboard-border-subtle pt-3">
        {mode === "idle" && (
          <div className="flex flex-wrap gap-1">
            <DashboardButton
              variant="link"
              onClick={() => setMode("length")}
              className="-ml-2"
            >
              {b.changeLength}
            </DashboardButton>
            <DashboardButton variant="link" onClick={() => setMode("release")}>
              {b.release}
            </DashboardButton>
          </div>
        )}
        {mode === "length" && (
          <ChangeLength
            board={board}
            hold={hold}
            durationMinutes={sponsor?.request.durationMinutes ?? 15}
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
          variant="small"
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
          variant="small"
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
  slotTime,
  onDone,
}: {
  sponsorId: string;
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
      className="flex flex-col gap-2"
      aria-label={copy.block.inviteLabel(formatClock(slotTime))}
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
            className="min-h-11 md:min-h-0"
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
          {copy.block.sendInvite}
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

// "2/3 Needs 1" or "3/3 Full", plus "asked for 2" when the sponsor lowered
// it. `compact` (grid cells): only the count below sm, so narrow columns
// never clip a word. `status={false}` (block dialog, which says it in
// words) leaves out "Needs N" / "Full".
export function SlotFill({
  slot,
  compact = false,
  status = true,
}: {
  slot: { booked: number; needed: number; lowered: boolean };
  compact?: boolean;
  status?: boolean;
}) {
  const short = slot.needed - slot.booked;
  const words = compact ? "hidden sm:inline" : undefined;
  return (
    <span className="flex flex-wrap items-baseline justify-end gap-x-1.5 whitespace-nowrap">
      <span
        aria-label={copy.fillLabel(slot.booked, slot.needed)}
        className="font-semibold text-dashboard-text-heavy"
      >
        {copy.fill(slot.booked, slot.needed)}
      </span>
      {status && (
        <span
          className={cn(
            words,
            short > 0
              ? "text-dashboard-text-medium"
              : "text-dashboard-text-light",
          )}
        >
          {short > 0 ? copy.needs(short) : copy.full}
        </span>
      )}
      {slot.lowered && (
        <span className={cn(words, "text-dashboard-text-light")}>
          {copy.askedFor(slot.needed)}
        </span>
      )}
    </span>
  );
}

// One hacker in a block slot: photo, name, status, and Cancel (accepted)
// or Reject (waiting), each confirmed once.
function BlockChat({ chat, sponsor }: { chat: BoardChat; sponsor: string }) {
  const b = copy.block;
  const [confirming, setConfirming] = useState(false);
  const done = useBlockDone(() => setConfirming(false));
  const cancel = api.coffeeChatRequests.cancel.useMutation({ onSuccess: done });
  const active = chat.status === "pending" || chat.status === "accepted";
  const waiting = chat.status === "pending";
  const hacker = booked.hacker(chat.firstName, chat.lastName);
  const time = formatClock(chat.slotTime);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex min-w-0 items-center gap-2">
        <HackerAvatar name={hacker} github={chat.github} size="sm" />
        <span className="min-w-0 truncate">
          {shortName(chat.firstName, chat.lastName)}
        </span>
        <span className="shrink-0 text-dashboard-text-light">
          {b.status[chat.status]}
        </span>
        {active && !confirming && (
          <DashboardButton
            variant="link"
            aria-label={
              waiting
                ? b.rejectLabel(hacker, time)
                : b.cancelLabel(hacker, time)
            }
            onClick={() => setConfirming(true)}
            className="ml-auto shrink-0"
          >
            {waiting ? b.reject : b.cancelChat}
          </DashboardButton>
        )}
      </span>
      {active && confirming && (
        <div className="flex flex-wrap items-center gap-2">
          <span>
            {waiting
              ? b.rejectConfirm(hacker, sponsor, time)
              : booked.cancelConfirm(hacker, sponsor, time)}
          </span>
          <DashboardButton
            variant="small"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({ chatId: chat.chatId })}
          >
            {waiting ? b.confirmReject : booked.confirmCancel}
          </DashboardButton>
          <DashboardButton
            variant="tertiary"
            className="min-h-11 md:min-h-0"
            onClick={() => setConfirming(false)}
          >
            {b.keep}
          </DashboardButton>
        </div>
      )}
      {cancel.error && (
        <p role="alert" className="m-0 text-dashboard-text-warning">
          {cancel.error.message || booked.actionError}
        </p>
      )}
    </div>
  );
}

// The sponsor strip above the room table (replaces "By sponsor"): logo,
// name, request and length, available hours, room hours booked of their
// chatting hours, hackers booked of the day's target, and a quiet note
// when the sheet's numbers don't add up. Picking one highlights their
// blocks; Edit request lets organizers change it for them.
export function SponsorStrip({
  items,
  colors,
  highlight,
  onHighlight,
}: {
  items: BoardSponsor[];
  colors: ReadonlyMap<string, number>;
  highlight: string | null;
  onHighlight?: (name: string) => void;
}) {
  const [editing, setEditing] = useState<BoardSponsor | null>(null);
  if (items.length === 0) return null;
  const s = copy.strip;
  return (
    <>
      <ul
        aria-label={s.label}
        data-tour="coffee-strip"
        className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1"
      >
        {items.map((item) => {
          const target = item.sheet.hackers ?? item.asked;
          const picked = highlight === item.sponsor;
          return (
            <li
              key={item.sponsor}
              className={cn(
                "flex w-56 shrink-0 flex-col gap-1 rounded-dashboard-md border border-dashboard-border-subtle bg-dashboard-bg-surface px-3 py-2 text-xs leading-4",
                picked && "ring-2 ring-dashboard-text-heavy ring-offset-1",
              )}
            >
              <button
                type="button"
                aria-pressed={picked}
                aria-label={s.highlight(item.sponsor)}
                onClick={() => onHighlight?.(item.sponsor)}
                className={cn(
                  "-mx-1 flex flex-col gap-1 rounded-dashboard-sm px-1 py-0.5 text-left",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                  hover.highlightSubtle,
                )}
              >
                <span className="flex min-h-7 min-w-0 items-center gap-1.5 text-sm font-semibold text-dashboard-text-heavy">
                  <SponsorBadge
                    name={item.sponsor}
                    colors={colors}
                    className="h-6 max-w-28"
                  />
                  {!sponsorLogo(item.sponsor) && (
                    <span className="truncate">{item.sponsor}</span>
                  )}
                </span>
                <span className="text-dashboard-text-medium">
                  {item.request.source === "none"
                    ? coffeeChatCopy.request.none
                    : copy.give.request(
                        requestSummary(item.request),
                        item.request.durationMinutes,
                      )}
                </span>
                {item.windowStart && item.windowEnd && (
                  <span className="text-dashboard-text-medium">
                    {s.window(
                      formatClock(item.windowStart),
                      formatClock(item.windowEnd),
                    )}
                  </span>
                )}
                <span className="flex flex-wrap justify-between gap-x-2 text-dashboard-text-medium">
                  <span>
                    {s.hoursBooked(item.blockMinutes, item.sheet.chattingHours)}
                  </span>
                  {target > 0 && (
                    <span className="font-semibold tabular-nums text-dashboard-text-heavy">
                      {s.hackers(item.booked, target)}
                    </span>
                  )}
                </span>
                {item.mismatch.length > 0 && (
                  <span
                    title={s.mismatchDetail(
                      item.sheet.slots,
                      item.sheet.hackers,
                      item.sheet.chattingHours,
                    )}
                    className="inline-flex items-center gap-1 text-dashboard-text-light"
                  >
                    <TriangleAlert aria-hidden className="size-3 shrink-0" />
                    {s.mismatch}
                    <span className="sr-only">
                      {s.mismatchDetail(
                        item.sheet.slots,
                        item.sheet.hackers,
                        item.sheet.chattingHours,
                      )}
                    </span>
                  </span>
                )}
              </button>
              {item.sponsorId ? (
                <DashboardButton
                  variant="link"
                  aria-label={s.editLabel(item.sponsor)}
                  onClick={() => setEditing(item)}
                  className="-mx-2 w-fit"
                >
                  <Pencil aria-hidden className="size-3.5" />
                  {s.edit}
                </DashboardButton>
              ) : (
                <span className="text-dashboard-text-light">
                  {s.notRegistered}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <EditRequest sponsor={editing} onClose={() => setEditing(null)} />
    </>
  );
}

// An organizer changes a sponsor's request for them (same form as the
// sponsor's "Your chat setup").
function EditRequest({
  sponsor,
  onClose,
}: {
  sponsor: BoardSponsor | null;
  onClose: () => void;
}) {
  const done = useBlockDone();
  const save = api.coffeeChatRequests.organizerSetChatRequest.useMutation({
    onSuccess: done,
  });
  return (
    <Dialog.Root open={Boolean(sponsor)} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-dashboard-2xl bg-dashboard-bg-surface p-6 font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card focus:outline-none",
          )}
        >
          {sponsor?.sponsorId && (
            <>
              <div className="flex items-start justify-between gap-3">
                <Dialog.Title className="m-0 text-lg font-semibold">
                  {copy.strip.editTitle(sponsor.sponsor)}
                </Dialog.Title>
                <Dialog.Close
                  aria-label={copy.close}
                  className={cn(
                    "-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                    hover.highlight,
                  )}
                >
                  <X aria-hidden className="size-5" />
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">
                {requestSummary(sponsor.request)}
              </Dialog.Description>
              <ChatRequestForm
                key={sponsor.sponsorId}
                initial={sponsor.request}
                saving={save.isPending}
                saved={save.isSuccess}
                error={save.isError}
                onSave={(value) =>
                  save.mutate({ sponsorId: sponsor.sponsorId!, ...value })
                }
              />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
