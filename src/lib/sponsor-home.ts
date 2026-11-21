// The sponsor Home's Up next timeline (mock sponsor-chats-v3): which steps
// show on each day, which are done, which is happening now and what's next.
// Pure, so it can be tested without a clock.

import {
  AGENDA,
  sponsorHomeCopy,
  type AgendaStep,
} from "~/content/sponsor-home";
import { runOfShowInstant } from "~/lib/run-of-show-time";

const copy = sponsorHomeCopy.upNext;

export type HomeChat = {
  id: string;
  rep: string;
  /** "HH:MM", Saturday. */
  start: string;
  end: string;
  room: string;
  building: "near" | "ivey";
  chats: number;
  confirmed: number;
};

export type HomeContext = {
  hasPrizeTrack: boolean;
  /** Coffee chats on (Sponsor Day-Of checkbox, not opted out). Off: no
   * availability, shortlist or chat rows, and no Scan buttons. */
  hasCoffeeChats: boolean;
  availabilitySent: boolean;
  shortlistSent: boolean;
  /** Organizers sent the chats: Saturday shows them instead of the placeholder. */
  confirmed: boolean;
  chats: HomeChat[];
  /** The sponsor's own Saturday workshop from the run of show. */
  workshop: { start: string; title: string; location: string | null } | null;
  /** Sunday's judging room, when the sheet has one. */
  judgingRoom: string | null;
};

export type StepState = "done" | "on" | "later" | "note";

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

/** "2:30" from minutes after midnight. */
export const shortTime = (m: number) =>
  `${Math.floor(m / 60) % 12 || 12}:${String(m % 60).padStart(2, "0")}`;

/** "6:00 PM" from minutes after midnight. */
export const clockTime = (m: number) =>
  `${shortTime(m)} ${Math.floor(m / 60) % 24 >= 12 ? "PM" : "AM"}`;

/** "Rm 2230" from a run of show location ("2230 (50)", "Rm 2230 (50)"). */
export function roomLabel(location: string | null): string | null {
  if (!location) return null;
  const s = location.trim().replace(/\s*\(\d+\)$/, "");
  return /^\d/.test(s) ? `Rm ${s}` : s;
}

/** Minutes since Friday midnight (Eastern) and the day to show (0-2). */
export function eventClock(now: Date): {
  abs: number;
  day: 0 | 1 | 2;
  minute: number;
} {
  const abs = Math.floor(
    (now.getTime() - runOfShowInstant("Friday", "00:00").getTime()) / 60_000,
  );
  const day = Math.min(2, Math.max(0, Math.floor(abs / 1440))) as 0 | 1 | 2;
  return { abs, day, minute: abs - day * 1440 };
}

/** One day's steps, in time order (the all-day note first). */
export function stepsFor(day: 0 | 1 | 2, ctx: HomeContext): AgendaStep[] {
  let steps = AGENDA.filter(
    (s) =>
      s.day === day &&
      (!s.prizeOnly || ctx.hasPrizeTrack) &&
      (!s.chatsOnly || ctx.hasCoffeeChats),
  ).map((s) =>
    s.chatsExtras && !ctx.hasCoffeeChats
      ? { ...s, action: undefined, sub: undefined }
      : s,
  );
  if (day === 1) {
    if (ctx.hasCoffeeChats && ctx.confirmed && ctx.chats.length > 0) {
      steps = [
        ...steps.filter((s) => !s.chatsPlaceholder),
        ...ctx.chats.map(
          (c): AgendaStep => ({
            id: `chat-${c.id}`,
            day: 1,
            start: minutes(c.start),
            end: minutes(c.end),
            range: true,
            title: copy.chatTitle(c.rep),
            where:
              c.building === "ivey" ? `Ivey, Rm ${c.room}` : `Rm ${c.room}`,
            sub: copy.chatSub(c.chats, c.confirmed),
            action: "yourChats",
            ivey: c.building === "ivey",
          }),
        ),
      ];
    }
    if (ctx.workshop) {
      const start = minutes(ctx.workshop.start);
      const where = roomLabel(ctx.workshop.location);
      steps.push({
        id: "workshop",
        day: 1,
        start: start - 15,
        end: start,
        title: copy.workshopArrive(shortTime(start - 15)),
        where: where ?? undefined,
        sub: copy.workshopSub(ctx.workshop.title, shortTime(start), where),
      });
    }
  }
  if (day === 2 && ctx.judgingRoom) {
    steps = steps.map((s) =>
      s.id === "u4" ? { ...s, where: copy.judgingRoom(ctx.judgingRoom!) } : s,
    );
  }
  return [...steps].sort((a, b) =>
    a.note ? -1 : b.note ? 1 : a.start - b.start,
  );
}

export function stateOf(
  step: AgendaStep,
  abs: number,
  ctx: HomeContext,
): StepState {
  if (step.note) return "note";
  if (step.doneWhen === "availability" && ctx.availabilitySent) return "done";
  if (step.doneWhen === "shortlist" && ctx.shortlistSent) return "done";
  const s = step.day * 1440 + step.start;
  // Availability is required: unsent, it stays current after its slot
  // instead of reading as done. (The shortlist is optional: past its
  // deadline, skipping it is fine.)
  if (step.doneWhen === "availability") return abs >= s ? "on" : "later";
  const e = step.day * 1440 + step.end;
  if (step.start === step.end) return abs >= s ? "done" : "later";
  return abs >= e ? "done" : abs >= s ? "on" : "later";
}

/**
 * The day's rows with the highlighted one: the latest step happening now
 * ("Now"), else the first one still to come ("Up next"). `next` is the step
 * after a "Now" row, labelled "Up next".
 */
export function planDay(day: 0 | 1 | 2, abs: number, ctx: HomeContext) {
  const rows = stepsFor(day, ctx).map((step) => ({
    step,
    state: stateOf(step, abs, ctx),
  }));
  const on = rows.filter((r) => r.state === "on");
  let hi = on[on.length - 1] ?? null;
  let mode: "now" | "next" = "now";
  let next: (typeof rows)[number] | null = null;
  if (hi) {
    next =
      rows.slice(rows.indexOf(hi) + 1).find((r) => r.state === "later") ?? null;
  } else {
    hi = rows.find((r) => r.state === "later") ?? null;
    mode = "next";
  }
  return { rows, hi, mode, next };
}
