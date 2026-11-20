import { useState } from "react";
import { Coffee, MapPin } from "lucide-react";
import { card, CardTitle, chip, seg } from "~/components/sponsors/portal-ui";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { COFFEE_SESSIONS } from "~/lib/coffee-chat-sessions";
import { roomLabel } from "~/lib/sponsor-home";
import { cn } from "~/lib/utils";
import { hatch } from "./availability-grid";
import { shortClock, type SetupData } from "./shared";

const copy = sponsorSetupCopy.chats;

type Chat = SetupData["chats"][number];
type Hacker = Chat["hackers"][number];

/** Accepted: a filled green dot. Waiting: an open ring. */
function StatusDot({ status }: { status: Hacker["status"] }) {
  return (
    <i
      aria-hidden
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        status === "accepted"
          ? "bg-dashboard-status-live"
          : "border-2 border-dashboard-action-primary bg-dashboard-bg-surface",
      )}
    />
  );
}

/**
 * Your chats once organizers send (mock sponsor-chats-v3): rep chips, a
 * Calendar / List switch, then a Saturday calendar with the sessions across
 * and one row per rep (your workshop on top). Hackers show only as Accepted
 * or Waiting: declined people and empty seats aren't shown.
 */
export function YourChats({ data }: { data: SetupData }) {
  const [rep, setRep] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const chatReps = data.reps.filter((r) => data.chats.some((c) => c.repId === r.id));
  const reps = chatReps.filter((r) => rep === null || r.id === rep);
  const chatAt = (repId: string, sessionId: string) =>
    data.chats.find((c) => c.repId === repId && c.sessionId === sessionId);
  const workshop = data.workshops[0] ?? null;
  const firstBlocked = COFFEE_SESSIONS.findIndex((s) => data.blocked.includes(s.id));
  const blockedCount = COFFEE_SESSIONS.filter((s) => data.blocked.includes(s.id)).length;
  const cell = "min-w-0 border-l border-t border-dashboard-border-subtle p-1.5 text-xs";
  // The rep column stays put while the sessions scroll sideways.
  const nameCell =
    "sticky left-0 z-[2] min-w-0 border-t border-dashboard-border-subtle bg-dashboard-bg-surface p-1.5 text-xs shadow-[1px_0_0_theme(colors.dashboard.border.default)]";

  return (
    <section className={card} aria-labelledby="your-chats">
      <CardTitle id="your-chats" icon={<Coffee aria-hidden />} className="text-lg">
        {copy.heading}
      </CardTitle>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
        <div role="group" aria-label={copy.filterLabel} className="flex flex-wrap gap-2">
          {[{ id: null, name: copy.everyone }, ...chatReps].map((r) => (
            <button
              key={r.id ?? "all"}
              type="button"
              aria-pressed={rep === r.id}
              className={chip(rep === r.id)}
              onClick={() => setRep(r.id)}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-label={copy.viewLabel} className={cn(seg.frame, "w-fit")}>
        {(["calendar", "list"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={cn(seg.button(view === v), "px-3")}
          >
            {copy[v]}
          </button>
        ))}
      </div>

      {view === "calendar" ? (
        <>
          <p className="m-0 flex gap-4 text-[13px] text-dashboard-text-medium">
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status="accepted" />
              {copy.accepted}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <StatusDot status="pending" />
              {copy.waiting}
            </span>
          </p>
          <div
            role="region"
            tabIndex={0}
            aria-label={copy.calendarLabel}
            className="overflow-x-auto rounded-dashboard-md border border-dashboard-border-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
          >
            <div
              className="grid min-w-[812px]"
              style={{ gridTemplateColumns: `104px repeat(${COFFEE_SESSIONS.length}, minmax(0,1fr))` }}
            >
              <div className="sticky left-0 z-[3] bg-dashboard-bg-inset p-1.5 text-xs font-semibold text-dashboard-text-light shadow-[1px_0_0_theme(colors.dashboard.border.default)]">
                {sponsorSetupCopy.daySubtitle}
              </div>
              {COFFEE_SESSIONS.map((s) => (
                <div
                  key={s.id}
                  className="border-l border-dashboard-border-subtle bg-dashboard-bg-inset p-1.5 text-center text-[13px] font-bold tabular-nums"
                >
                  {copy.sessionsShort[s.id] ?? s.id}
                </div>
              ))}
              {/* Your workshop row */}
              <div className={cn(nameCell, "flex items-center text-sm font-bold")}>{copy.yourWorkshop}</div>
              {COFFEE_SESSIONS.map((s, i) => {
                if (data.blocked.includes(s.id)) {
                  if (i !== firstBlocked) return null;
                  return (
                    <div
                      key={s.id}
                      className={cn(cell, "bg-dashboard-notice-workshopBg")}
                      style={{ gridColumn: `span ${blockedCount}` }}
                    >
                      {workshop && (
                        <div className="flex flex-col gap-0.5 rounded-dashboard-sm border-l-4 border-dashboard-notice-workshopLine bg-dashboard-schedule-pink p-1.5 text-xs text-dashboard-text-medium">
                          <b className="text-[13px] text-dashboard-text-heavy">{workshop.title}</b>
                          <span className="tabular-nums">
                            {shortClock(workshop.start)}–{shortClock(workshop.end)}
                          </span>
                          {workshop.location && <span>{roomLabel(workshop.location)}</span>}
                        </div>
                      )}
                    </div>
                  );
                }
                return <div key={s.id} className={cell} />;
              })}
              {reps.map((r) => {
                const total = data.chats.filter((c) => c.repId === r.id).reduce((n, c) => n + c.chats, 0);
                return [
                  <div key={`${r.id}-name`} className={cn(nameCell, "flex flex-col justify-center")}>
                    <b className="break-words text-sm font-bold">{r.name}</b>
                    <span className="font-semibold text-dashboard-text-light">{copy.repChats(total)}</span>
                  </div>,
                  ...COFFEE_SESSIONS.map((s) => {
                    const c = chatAt(r.id, s.id);
                    if (c) {
                      return (
                        <div key={`${r.id}-${s.id}`} className={cell}>
                          <ChatBlock chat={c} data={data} />
                        </div>
                      );
                    }
                    if (data.blocked.includes(s.id)) {
                      return (
                        <div
                          key={`${r.id}-${s.id}`}
                          className={cn(cell, hatch, "flex items-center justify-center text-center text-[11.5px] text-dashboard-text-medium")}
                        >
                          {copy.workshop}
                        </div>
                      );
                    }
                    return (
                      <div key={`${r.id}-${s.id}`} className={cn(cell, "flex items-center justify-center text-dashboard-text-light")}>
                        <span aria-hidden>–</span>
                        <span className="sr-only">{copy.noneLabel(r.name, copy.sessionsShort[s.id] ?? s.id)}</span>
                      </div>
                    );
                  }),
                ];
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {[...data.chats]
            .filter((c) => rep === null || c.repId === rep)
            .sort((a, b) => a.start.localeCompare(b.start))
            .map((c) => {
              const name = data.reps.find((r) => r.id === c.repId)?.name ?? "";
              return (
                <div key={c.placementId} className="flex flex-col gap-1.5 border-t border-dashboard-border-subtle pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <b className="font-semibold">{name}</b>
                    <span className="text-sm tabular-nums text-dashboard-text-light">
                      {shortClock(c.start)}–{shortClock(c.end)} · {copy.chatCount(c.chats)} ·{" "}
                      {copy.format(data.hackersPerChat, data.chatMinutes)}
                    </span>
                  </div>
                  <p className="m-0 flex items-center gap-1.5 text-sm text-dashboard-text-medium">
                    <MapPin aria-hidden className="size-4 shrink-0 text-dashboard-text-light" />
                    {copy.room(c.room)} · {copy.building(c.building)}
                  </p>
                  {c.hackers.length === 0 ? (
                    <p className="m-0 text-sm text-dashboard-text-light">{copy.hackers(0)}</p>
                  ) : (
                    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                      {c.hackers.map((h, i) => (
                        <li key={`${h.firstName}-${i}`} className="inline-flex items-center gap-2 text-sm">
                          {h.firstName}
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-semibold",
                              h.status === "accepted"
                                ? "bg-dashboard-notice-okBg text-dashboard-notice-okText"
                                : "bg-dashboard-bg-highlight text-dashboard-text-active",
                            )}
                          >
                            {copy.status[h.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </section>
  );
}

function ChatBlock({ chat, data }: { chat: Chat; data: SetupData }) {
  // A session cut by their workshop (or not full) starts late or ends early: say when.
  const fullHour =
    chat.start.endsWith(":00") &&
    chat.end === `${String(Number(chat.start.slice(0, 2)) + 1).padStart(2, "0")}:00`;
  return (
    <div className="flex h-full min-w-0 flex-col gap-0.5 rounded-dashboard-sm border-l-4 border-dashboard-action-primary bg-dashboard-bg-highlight p-2 text-[11.5px] text-dashboard-text-medium">
      <b className="text-xs font-bold text-dashboard-text-heavy">
        {copy.room(chat.room)} · {copy.building(chat.building)}
      </b>
      <span>
        {copy.chatCount(chat.chats)} · {copy.format(data.hackersPerChat, data.chatMinutes)}
        {!fullHour && ` · ${copy.between(shortClock(chat.start), shortClock(chat.end))}`}
      </span>
      {chat.hackers.length > 0 && (
        <ul aria-label={copy.hackersLabel} className="m-0 mt-0.5 flex list-none flex-col gap-0.5 p-0">
          {chat.hackers.map((h, i) => (
            <li key={`${h.firstName}-${i}`} className="flex items-center gap-1.5 text-dashboard-text-heavy">
              <StatusDot status={h.status} />
              <span>
                {h.firstName}
                <span className="sr-only"> · {copy.status[h.status]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
