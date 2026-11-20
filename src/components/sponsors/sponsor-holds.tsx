import { useState } from "react";
import Link from "next/link";
import { DoorOpen, ScanLine, Users } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import {
  requestSummary,
  Stepper,
} from "~/components/sponsors/chat-request-form";
import { coffeeChatCopy } from "~/content/coffee-chat";
import type { BlockSlot, SponsorHoldView } from "~/lib/coffee-chat-holds";
import type { ChatRequest, SlotLimit } from "~/lib/coffee-chat-request";
import {
  coffeeChatMinutesOf,
  coffeeChatTimeOf,
} from "~/lib/coffee-chat-requests";
import { formatClock } from "~/lib/run-of-show";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.sponsorHolds;
const fewer = coffeeChatCopy.fewer;

/** Full-width compact outline buttons (DashboardButton "small"). */
const actionClass = "w-full";

/** The scan page, opened on this block's first open slot. */
export function scanHrefForHold(sponsor: string, startTime: string): string {
  return `/sponsors/${sponsor}/scan?time=${encodeURIComponent(startTime)}`;
}

// "Pick from candidates" and "Scan a badge" for a block's open slots (Scan
// opens on the first one). Candidates is a button when the caller can
// switch tabs in place, else a link.
export function HoldActions({
  sponsor,
  hold,
  onPickCandidates,
}: {
  sponsor: string;
  hold: Pick<SponsorHoldView, "room" | "startTime">;
  onPickCandidates?: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={copy.actionsLabel(hold.room, formatClock(hold.startTime))}
      className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2"
    >
      {onPickCandidates ? (
        <DashboardButton
          variant="small"
          type="button"
          onClick={onPickCandidates}
          className={actionClass}
        >
          <Users aria-hidden />
          {copy.pick}
        </DashboardButton>
      ) : (
        <DashboardButton variant="small" asChild className={actionClass}>
          <Link href={`/sponsors/${sponsor}/coffee-chats#interested`}>
            <Users aria-hidden />
            {copy.pick}
          </Link>
        </DashboardButton>
      )}
      <DashboardButton variant="small" asChild className={actionClass}>
        <Link href={scanHrefForHold(sponsor, hold.startTime)}>
          <ScanLine aria-hidden />
          {copy.scan}
        </Link>
      </DashboardButton>
    </div>
  );
}

// The sponsor's own room blocks: "Rm 2243 · 9:00–10:00 · 3 of 4 chats
// filled", each slot's hackers booked of asked for with "Ask for fewer",
// ways to fill the open slots, and their asks for fewer hackers.
export function SponsorHolds({
  sponsor,
  holds,
  request,
  limits,
  onPickCandidates,
}: {
  sponsor: string;
  holds: SponsorHoldView[];
  request: ChatRequest;
  limits: SlotLimit[];
  onPickCandidates?: () => void;
}) {
  if (holds.length === 0) return null;
  return (
    <section aria-labelledby="held-rooms" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2
          id="held-rooms"
          className="m-0 text-lg font-semibold text-dashboard-text-heavy"
        >
          {copy.heading}
        </h2>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {copy.intro} {requestSummary(request)}.
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {holds.map((h) => (
          <li
            key={h.holdId}
            className={cn(
              "flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card",
              h.needsHacker && "border-l-4 border-dashboard-border-strong",
            )}
          >
            <div className="flex flex-col gap-1">
              <p className="m-0 flex items-center gap-2 text-base font-semibold tabular-nums text-dashboard-text-heavy">
                <DoorOpen
                  aria-hidden
                  className="size-4 shrink-0 text-dashboard-text-light"
                />
                {copy.line(
                  h.room,
                  formatClock(h.startTime),
                  formatClock(h.endTime),
                  h.filled,
                  h.total,
                )}
              </p>
            </div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {h.slots.map((slot) => (
                <SlotRow
                  key={slot.slotTime}
                  sponsor={sponsor}
                  slot={slot}
                  block={h}
                  request={request}
                />
              ))}
            </ul>
            {h.needsHacker && h.firstOpen && (
              <HoldActions
                sponsor={sponsor}
                hold={{ room: h.room, startTime: h.firstOpen }}
                onPickCandidates={onPickCandidates}
              />
            )}
          </li>
        ))}
      </ul>
      <Asks sponsor={sponsor} limits={limits} request={request} />
    </section>
  );
}

/** Refetch the sponsor's chats after an ask changes. */
function useAskFewer(onDone?: () => void) {
  const utils = api.useUtils();
  return api.coffeeChatRequests.askForFewer.useMutation({
    onSuccess: async () => {
      onDone?.();
      await utils.coffeeChatRequests.invalidate();
    },
  });
}

// "9:00 AM · 2 of 3 booked" (+ "asked for 2"), and "Ask for fewer" for
// this slot or its hour inside the room block (down to 0 = no chat then).
function SlotRow({
  sponsor,
  slot,
  block,
  request,
}: {
  sponsor: string;
  slot: BlockSlot;
  block: { startTime: string; endTime: string };
  request: ChatRequest;
}) {
  const [open, setOpen] = useState(false);
  const [hackers, setHackers] = useState(slot.needed);
  const [scope, setScope] = useState<"slot" | "hour">("slot");
  const save = useAskFewer(() => setOpen(false));
  const time = formatClock(slot.slotTime);
  const start = coffeeChatMinutesOf(slot.slotTime) ?? 0;
  const hour = start - (start % 60);
  // The server takes one slot, or the part of its clock hour inside the
  // block (saveSlotLimit).
  const span =
    scope === "slot"
      ? {
          startTime: slot.slotTime,
          endTime: coffeeChatTimeOf(start + request.durationMinutes),
        }
      : {
          startTime: coffeeChatTimeOf(
            Math.max(hour, coffeeChatMinutesOf(block.startTime) ?? hour),
          ),
          endTime: coffeeChatTimeOf(
            Math.min(
              hour + 60,
              coffeeChatMinutesOf(block.endTime) ?? hour + 60,
            ),
          ),
        };
  return (
    <li className="flex flex-col gap-2 text-sm">
      <span className="flex flex-wrap items-center gap-x-2 tabular-nums">
        <span className="text-dashboard-text-medium">
          {fewer.slotLine(time, slot.booked, slot.needed)}
        </span>
        {slot.lowered && (
          <span className="text-dashboard-text-light">
            {fewer.askedFor(slot.needed)}
          </span>
        )}
        {!open && (
          <DashboardButton
            variant="link"
            aria-label={fewer.askLabel(time)}
            onClick={() => {
              setHackers(Math.max(0, slot.needed - 1));
              setOpen(true);
            }}
            className="ml-auto"
          >
            {fewer.ask}
          </DashboardButton>
        )}
      </span>
      {open && (
        <form
          aria-label={fewer.askLabel(time)}
          className="flex flex-col gap-2 rounded-dashboard-md bg-dashboard-bg-inset p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!save.isPending) save.mutate({ sponsor, ...span, hackers });
          }}
        >
          <span className="text-dashboard-text-light">{fewer.hackers}</span>
          <Stepper
            value={hackers}
            min={0}
            max={request.perSlot}
            label={fewer.hackers}
            onChange={setHackers}
          />
          <span className="text-xs text-dashboard-text-light">
            {fewer.noChat}
          </span>
          <div
            role="group"
            aria-label={fewer.scope}
            className="flex flex-wrap gap-1.5"
          >
            {(["slot", "hour"] as const).map((v) => (
              <DashboardChip
                key={v}
                selected={scope === v}
                onClick={() => setScope(v)}
              >
                {fewer[v]}
              </DashboardChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <DashboardButton
              type="submit"
              variant="small"
              disabled={save.isPending}
            >
              {fewer.save}
            </DashboardButton>
            <DashboardButton
              type="button"
              variant="tertiary"
              onClick={() => setOpen(false)}
            >
              {fewer.cancel}
            </DashboardButton>
          </div>
          {save.error && (
            <p role="alert" className="m-0 text-dashboard-text-warning">
              {save.error.message || fewer.error}
            </p>
          )}
        </form>
      )}
    </li>
  );
}

// The sponsor's asks for fewer, each with "Back to full".
function Asks({
  sponsor,
  limits,
  request,
}: {
  sponsor: string;
  limits: SlotLimit[];
  request: ChatRequest;
}) {
  const clear = useAskFewer();
  if (limits.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="m-0 text-sm font-semibold text-dashboard-text-heavy">
        {fewer.heading}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {limits.map((l) => {
          const start = formatClock(l.startTime);
          const end = formatClock(l.endTime);
          return (
            <li
              key={`${l.startTime}-${l.endTime}`}
              className="flex flex-wrap items-center justify-between gap-2 text-sm text-dashboard-text-medium"
            >
              <span className="tabular-nums">
                {fewer.item(start, end, l.hackers)}
              </span>
              <DashboardButton
                variant="link"
                aria-label={fewer.removeLabel(start, end)}
                disabled={clear.isPending}
                onClick={() =>
                  clear.mutate({
                    sponsor,
                    startTime: l.startTime,
                    endTime: l.endTime,
                    hackers: request.perSlot,
                  })
                }
              >
                {fewer.remove}
              </DashboardButton>
            </li>
          );
        })}
      </ul>
      {clear.error && (
        <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
          {clear.error.message || fewer.error}
        </p>
      )}
    </div>
  );
}
