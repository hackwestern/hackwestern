import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Check, Coffee } from "lucide-react";

import SEO from "~/components/seo";
import { api } from "~/utils/api";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import {
  COFFEE_CHAT_DAY_LABEL,
  COFFEE_CHAT_ROOMS,
  COFFEE_CHAT_SLOTS,
  COFFEE_CHAT_WINDOW_LABEL,
  coffeeChatColorFor,
  coffeeChatSlotKeyOf,
  formatCoffeeChatTime,
  groupCoffeeChatSlotsByHour,
} from "~/lib/coffee-chats";
import { cn } from "~/lib/utils";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HOUR_SLOTS = groupCoffeeChatSlotsByHour(COFFEE_CHAT_SLOTS);

function parseSlotKey(key: string): { room: number; time: string } {
  const separator = key.indexOf(":");
  const room = Number(key.slice(0, separator));
  const time = key.slice(separator + 1);
  return { room, time };
}

export default function SponsorCoffeeChatsPage() {
  const router = useRouter();
  const uuid = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(uuid);

  // The sponsor's desired final state: selected slot keys stay local until
  // they hit save, then replace everything they hold on the sheet grid.
  const [selected, setSelected] = useState<string[]>([]);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const scheduleQ = api.sponsorJudging.getCoffeeChatSchedule.useQuery(
    { sponsor: uuid },
    { enabled: validUuid, refetchOnWindowFocus: false },
  );
  const data = scheduleQ.data;
  const utils = api.useUtils();

  useEffect(() => {
    if (!data || seededFor === uuid) return;
    setSeededFor(uuid);
    setSelected(
      data.myBooked.map(({ room, time }) => coffeeChatSlotKeyOf({ room, time })),
    );
  }, [data, seededFor, uuid]);

  const save = api.sponsorJudging.setCoffeeChatBooking.useMutation();

  // Other sponsors' bookings, keyed like selected for chip shading.
  const takenByOthers = useMemo(() => {
    const map = new Map<string, string>();
    for (const booking of data?.othersBooked ?? []) {
      map.set(
        coffeeChatSlotKeyOf({ room: booking.room, time: booking.time }),
        booking.sponsor,
      );
    }
    return map;
  }, [data?.othersBooked]);

  const maxBlocks = data?.maxBlocks ?? 0;
  // A sponsor with zero allowance but existing bookings can still cancel.
  const canEdit = maxBlocks > 0 || (data?.myBooked.length ?? 0) > 0;
  const overMax = selected.length > maxBlocks;

  function toggle(room: number, time: string) {
    const key = coffeeChatSlotKeyOf({ room, time });
    setSaved(false);
    setSelected((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key],
    );
  }

  function saveBooking() {
    save.mutate(
      { sponsorId: uuid, slots: selected.map(parseSlotKey) },
      {
        onSuccess: () => {
          setSaved(true);
          // Refresh others' bookings so the grid shows the latest state.
          void utils.sponsorJudging.getCoffeeChatSchedule
            .invalidate()
            .catch(() => undefined);
        },
      },
    );
  }

  if (!router.isReady) {
    return (
      <Shell>
        <div className="flex flex-col gap-3" aria-busy="true">
          <div className="h-8 w-44 animate-pulse rounded-dashboard-sm bg-dashboard-bg-nav" />
          <div className="h-20 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-40 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card"
            />
          ))}
        </div>
      </Shell>
    );
  }

  const notFound = !validUuid || scheduleQ.isError;

  if (notFound) {
    return (
      <Shell>
        <DashboardPanel className="text-center">
          <h1 className="dashboard-h1 m-0">Link not recognised</h1>
          <p className="mb-0 mt-2 text-base leading-relaxed text-dashboard-text-medium">
            This private link isn&apos;t valid. If you believe this is an
            error, please reach out to your Hack Western organizer contact
            for assistance.
          </p>
        </DashboardPanel>
      </Shell>
    );
  }

  if (data && !canEdit) {
    return (
      <Shell>
        <div className="flex flex-col gap-4">
          <Link
            href={`/sponsors/${uuid}`}
            className="mb-1 inline-flex items-center gap-1.5 self-start text-sm font-medium text-dashboard-text-medium hover:text-dashboard-text-heavy"
          >
            <ArrowLeft
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.67}
            />
            Back to sponsor hub
          </Link>
          <DashboardPanel className="gap-2 text-center">
            <h1 className="dashboard-h1 m-0">Coffee chats unavailable</h1>
            <p className="mb-3 mt-2 text-base leading-relaxed text-dashboard-text-medium">
              Your sponsor package doesn&apos;t include coffee chat time
              right now. If you were expecting slots, ask your Hack Western
              contact to add your allowance to the sponsor info sheet.
            </p>
            <DashboardButton asChild className="mx-auto md:w-auto">
              <Link href={`/sponsors/${uuid}`}>Back to sponsor hub</Link>
            </DashboardButton>
          </DashboardPanel>
        </div>
      </Shell>
    );
  }

  const canSave = !overMax && !save.isPending;

  return (
    <Shell
      counter={
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            overMax
              ? "text-dashboard-status-warning"
              : "text-dashboard-text-light",
          )}
        >
          {selected.length} of {maxBlocks} blocks selected
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          {validUuid && (
            <Link
              href={`/sponsors/${uuid}`}
              className="mb-1 inline-flex items-center gap-1.5 self-start text-sm font-medium text-dashboard-text-medium hover:text-dashboard-text-heavy"
            >
              <ArrowLeft
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.67}
              />
              Back to sponsor hub
            </Link>
          )}
          {data?.sponsorName && (
            <DashboardTag className="self-start">
              {data.sponsorName}
            </DashboardTag>
          )}
          <h1 className="dashboard-h1 m-0 flex items-center gap-2">
            <Coffee
              aria-hidden="true"
              className="size-6 shrink-0 text-dashboard-text-medium"
              strokeWidth={1.67}
            />
            Schedule coffee chats
          </h1>
          <p className="mb-0 mt-1 text-base font-medium leading-relaxed text-dashboard-text-medium">
            {data
              ? `Your package includes ${data.maxCoffeeChatMinutes} minutes — that's ${maxBlocks} × 15-minute slot${maxBlocks === 1 ? "" : "s"} across our three rooms. `
              : ""}
            {COFFEE_CHAT_DAY_LABEL}, {COFFEE_CHAT_WINDOW_LABEL}.
          </p>
          <p className="m-0 text-sm font-medium text-dashboard-text-light">
            Tap slots to add or remove them, then save. Slots shaded by
            another sponsor are already taken.
          </p>
        </div>

        {scheduleQ.isLoading &&
          COFFEE_CHAT_ROOMS.map((room) => (
            <div
              key={room.id}
              className="h-44 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card"
            />
          ))}

        {data &&
          COFFEE_CHAT_ROOMS.map((room) => (
            <DashboardPanel key={room.id} className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-base font-semibold text-dashboard-text-heavy">
                  {room.label}
                </span>
                <span className="text-xs font-medium text-dashboard-text-light">
                  {COFFEE_CHAT_DAY_LABEL} · 15 min slots
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {HOUR_SLOTS.map((group) => (
                  <div key={group.label} className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
                      {group.label}
                    </span>
                    <div className="grid grid-cols-4 gap-2">
                      {group.slots.map((time) => {
                        const key = coffeeChatSlotKeyOf({ room: room.id, time });
                        const taken = takenByOthers.get(key) ?? null;
                        const on = selected.includes(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            aria-pressed={on}
                            disabled={Boolean(taken)}
                            onClick={() => toggle(room.id, time)}
                            style={
                              taken
                                ? {
                                    backgroundColor:
                                      coffeeChatColorFor(taken),
                                    color: "#ffffff",
                                  }
                                : undefined
                            }
                            className={cn(
                              "flex min-h-[52px] cursor-pixel-hover flex-col items-center justify-center gap-0.5 rounded-dashboard-md border p-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
                              taken
                                ? "cursor-not-allowed border-transparent font-semibold"
                                : on
                                  ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
                                  : "border-dashboard-border-default bg-dashboard-bg-surface text-dashboard-text-heavy hover:bg-dashboard-bg-highlight",
                            )}
                          >
                            <span className="flex items-center gap-1 whitespace-nowrap text-sm font-semibold tabular-nums">
                              {on && (
                                <Check
                                  aria-hidden="true"
                                  className="size-3.5"
                                  strokeWidth={2.5}
                                />
                              )}
                              {formatCoffeeChatTime(time)}
                            </span>
                            <span
                              className={cn(
                                "w-full truncate px-0.5 text-[10px] font-medium",
                                taken
                                  ? "text-white/90"
                                  : on
                                    ? "text-white/80"
                                    : "text-dashboard-text-light",
                              )}
                            >
                              {taken
                                ? taken
                                : on
                                  ? "yours"
                                  : /* keep chips even so labels line up */
                                    "\u00A0"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </DashboardPanel>
          ))}

        {overMax && (
          <p className="m-0 rounded-dashboard-md border border-dashboard-border-subtle bg-dashboard-bg-highlight px-4 py-3 text-sm font-medium leading-relaxed text-dashboard-text-heavy">
            You&apos;ve picked {selected.length} blocks but your package
            covers {maxBlocks}. Remove some slots before saving.
          </p>
        )}
      </div>

      {/* Sticky save bar, thumb-reachable on phones like the picks page. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-dashboard-border-subtle bg-dashboard-bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-dashboard-bg-surface/80">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <span className="flex flex-col">
            <span
              className={cn(
                "text-base font-semibold tabular-nums text-dashboard-text-heavy",
                overMax && "text-dashboard-status-warning",
              )}
            >
              {selected.length} / {maxBlocks}
            </span>
            <span className="text-xs font-medium text-dashboard-text-light">
              saving removes deselected slots
            </span>
          </span>
          <DashboardButton
            disabled={!canSave}
            onClick={saveBooking}
            className="flex-1 disabled:cursor-not-allowed disabled:opacity-dashboard-disabled sm:max-w-[260px]"
          >
            {save.isPending
              ? "Saving…"
              : save.isError
                ? "Failed — tap to retry"
                : saved
                  ? "Saved"
                  : "Save booking"}
          </DashboardButton>
        </div>
        {save.isError && (
          <p className="m-0 bg-[#fdecea] px-4 pb-3 pt-2 text-center text-sm font-medium text-[#7a1a0f]">
            {save.error?.message
              ? `${save.error.message}`
              : "Couldn't save your booking. Check your connection and try again."}
          </p>
        )}
        {saved && !save.isError && (
          <p className="m-0 px-4 pb-3 text-center text-sm font-medium text-dashboard-status-live">
            Your times are saved to the coffee chat grid.
          </p>
        )}
      </div>
      {/* Room so the last panel clears the sticky bar. */}
      <div className="h-32" />
    </Shell>
  );
}

function Shell({
  children,
  counter,
}: {
  children: React.ReactNode;
  counter?: React.ReactNode;
}) {
  return (
    <>
      <SEO title="Coffee chats" noindex />
      <div className="min-h-screen bg-dashboard-bg-page px-4 pb-4 pt-6 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold tracking-tight text-dashboard-text-medium">
              Hack Western 13
            </span>
            {counter}
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
