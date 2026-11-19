import { useState } from "react";
import { Coffee } from "lucide-react";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { COFFEE_SESSIONS } from "~/lib/coffee-chat-sessions";
import { cn } from "~/lib/utils";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { hatch, workshopWhen } from "./availability-grid";
import { cardClass, ScrollHint, sessionLabel, shortClock, type SetupData } from "./shared";

const copy = sponsorSetupCopy.chats;

type Chat = SetupData["chats"][number];

/**
 * "Your chats" once organizers send: sessions x reps with room and
 * building, filterable by rep; Calendar (default) or List.
 */
export function YourChats({ data }: { data: SetupData }) {
  const [rep, setRep] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const reps = data.reps.filter((r) => rep === null || r.id === rep);
  const chatAt = (repId: string, sessionId: string) =>
    data.chats.find((c) => c.repId === repId && c.sessionId === sessionId);
  const when = workshopWhen(data);
  const chip = (on: boolean) =>
    cn(
      "min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
      on
        ? "border-2 border-dashboard-action-primary bg-dashboard-bg-highlight text-dashboard-text-active"
        : "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-medium",
      pressable,
    );

  return (
    <section className={cardClass} aria-labelledby="your-chats">
      <h2 id="your-chats" className="m-0 flex items-center gap-2 text-xl font-semibold text-dashboard-text-heavy">
        <Coffee aria-hidden className="size-5" />
        {copy.heading}
      </h2>
      <div role="radiogroup" aria-label={copy.filterLabel} className="flex flex-wrap gap-2">
        <button type="button" role="radio" aria-checked={rep === null} className={chip(rep === null)} onClick={() => setRep(null)}>
          {copy.everyone}
        </button>
        {data.reps.map((r) => (
          <button key={r.id} type="button" role="radio" aria-checked={rep === r.id} className={chip(rep === r.id)} onClick={() => setRep(r.id)}>
            {r.name}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label={copy.viewLabel} className="grid w-fit grid-cols-2 gap-1 rounded-dashboard-lg bg-dashboard-bg-nav p-1">
        {(["calendar", "list"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            onClick={() => setView(v)}
            className={cn(
              "min-h-11 rounded-dashboard-md px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
              view === v ? "bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card" : "text-dashboard-text-medium",
              pressable,
            )}
          >
            {copy[v]}
          </button>
        ))}
      </div>

      {view === "calendar" ? (
        // Sessions down the side, reps across: all six sessions show at
        // phone width, and only a wide team scrolls (with a hint).
        <ScrollHint label={copy.heading}>
          <table className="w-full border-collapse text-sm" style={{ minWidth: `${4.5 + reps.length * 7.5}rem` }}>
            <thead>
              <tr className="bg-dashboard-bg-inset">
                <th scope="col" className="sticky left-0 z-10 w-20 bg-dashboard-bg-inset p-2 text-left font-medium text-dashboard-text-light">
                  {sponsorSetupCopy.daySubtitle}
                </th>
                {reps.map((r) => {
                  const total = data.chats.filter((c) => c.repId === r.id).reduce((n, c) => n + c.chats, 0);
                  return (
                    <th key={r.id} scope="col" className="p-2 text-left align-bottom">
                      <span className="block break-words font-semibold text-dashboard-text-heavy">{r.name}</span>
                      <span className="block text-xs font-normal text-dashboard-text-light">{copy.repChats(total)}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {COFFEE_SESSIONS.map((s) => {
                const blocked = data.blocked.includes(s.id);
                return (
                  <tr key={s.id} className="border-t border-dashboard-border-subtle">
                    <th scope="row" className="sticky left-0 z-10 w-20 bg-dashboard-bg-surface p-2 text-left align-top font-semibold text-dashboard-text-heavy">
                      {sessionLabel(s.id)}
                    </th>
                    {reps.map((r) => {
                      const c = chatAt(r.id, s.id);
                      if (c) {
                        return (
                          <td key={r.id} className="p-1 align-top">
                            <ChatCard chat={c} data={data} />
                          </td>
                        );
                      }
                      if (blocked) {
                        return (
                          <td key={r.id} className={cn("p-2 text-xs font-semibold text-dashboard-text-medium", hatch)}>
                            {copy.workshop}
                            {when && ` ${when}`}
                          </td>
                        );
                      }
                      return (
                        <td key={r.id} className="p-2 align-top text-dashboard-text-light">
                          <span aria-hidden>{copy.none}</span>
                          <span className="sr-only">{copy.noneLabel(r.name, sessionLabel(s.id))}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollHint>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {reps.map((r) => {
            const mine = data.chats.filter((c) => c.repId === r.id);
            return (
              <li key={r.id} className="flex flex-col gap-2">
                <h3 className="m-0 text-base font-semibold text-dashboard-text-heavy">{r.name}</h3>
                {mine.length === 0 ? (
                  <p className="m-0 text-sm text-dashboard-text-light">{copy.emptyRep}</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {mine.map((c) => (
                      <li key={c.placementId} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
                        <span className="w-28 shrink-0 font-semibold tabular-nums text-dashboard-text-heavy">
                          {shortClock(c.start)}–{shortClock(c.end)}
                        </span>
                        <ChatCard chat={c} data={data} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ChatCard({ chat, data }: { chat: Chat; data: SetupData }) {
  // A session cut by their workshop starts late or ends early: say when.
  const fullHour =
    chat.start.endsWith(":00") &&
    chat.end === `${String(Number(chat.start.slice(0, 2)) + 1).padStart(2, "0")}:00`;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-dashboard-sm border-l-4 border-dashboard-action-primary bg-dashboard-bg-highlight p-2 text-xs text-dashboard-text-medium">
      <span className="text-sm font-semibold text-dashboard-text-heavy">
        {copy.room(chat.room)} · {copy.building(chat.building)}
      </span>
      <span>
        {copy.format(data.hackersPerChat, data.chatMinutes)} · {copy.chatCount(chat.chats)}
        {!fullHour && ` · ${copy.between(shortClock(chat.start), shortClock(chat.end))}`}
      </span>
      <span className="font-semibold text-dashboard-text-heavy">{copy.hackers(chat.hackers.length)}</span>
      {chat.hackers.length > 0 && (
        <ul className="m-0 list-none p-0">
          {chat.hackers.map((h, i) => (
            <li key={`${h.firstName}-${i}`}>
              {h.firstName} · {copy.status[h.status] ?? h.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
