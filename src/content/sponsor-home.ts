// User-facing copy for the sponsor portal Home (/sponsors/[uuid]), from
// mock sponsor-chats-v3: the greeting, the welcome card, Contacts, Up next
// and Key rooms. Keep wording here, not in components.
//
// The Up next agenda below is the sponsor's weekend from the Spon Team run
// of show (as of 2026-11-19), trimmed to what a sponsor does. Times are
// minutes after midnight, Eastern. The sponsor's own workshop, judging room
// and coffee chats come from their data, not from here.

import {
  PRESENTATION_WINDOW_END,
  SHORTLIST_MAX,
} from "~/lib/sponsor-presentations";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** "a Gold", "an Emerald". */
const withArticle = (word: string) =>
  `${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;

export type AgendaAction = "chats" | "scan" | "yourChats" | "judging";

export type AgendaStep = {
  id: string;
  /** 0 Friday, 1 Saturday, 2 Sunday. */
  day: 0 | 1 | 2;
  start: number;
  end: number;
  title: string;
  where?: string;
  sub?: string;
  action?: AgendaAction;
  /** "By 10:00 PM" instead of a start time. */
  by?: boolean;
  /** Shows "to 11:48 AM" under the start time. */
  range?: boolean;
  /** Shows "due 9:30 AM" under the start time. */
  due?: number;
  /** An all-day line (no time, no done state). */
  note?: boolean;
  /** Only for sponsors with a prize track. */
  prizeOnly?: boolean;
  /** Only for sponsors who do coffee chats (Sponsor Day-Of checkbox). */
  chatsOnly?: boolean;
  /** Its button and sub-line are about coffee chats (booth scanning): a
   * sponsor without chats sees the row without them. */
  chatsExtras?: boolean;
  /**
   * Done once the sponsor has sent this. "finalists" (judging shortlist
   * sent) and "top5" (top 5 submitted) are read only by the HW lead's
   * Slack pings (src/server/slack/sponsor-lead-pings.ts), which skip a
   * done step; the Home marks those rows by time.
   */
  doneWhen?: "availability" | "shortlist" | "finalists" | "top5";
  /** Saturday's coffee chat placeholder, replaced by the real chats once
   * organizers send them. */
  chatsPlaceholder?: boolean;
  /** A coffee chat at Ivey: shows the walk note (src/content/ivey-walk.ts). */
  ivey?: boolean;
};

export const AGENDA: AgendaStep[] = [
  // Friday
  {
    id: "f1",
    day: 0,
    start: 1020,
    end: 1050,
    title: "Send availability",
    where: "Sponsor workshop, Rm 2110",
    action: "chats",
    doneWhen: "availability",
    chatsOnly: true,
  },
  {
    id: "f2",
    day: 0,
    start: 1050,
    end: 1140,
    title: "Dinner",
    where: "Rm 1230",
  },
  {
    id: "f3",
    day: 0,
    start: 1050,
    end: 1140,
    title: "Open your booth",
    where: "Sponsor Bay (SM Atrium)",
    sub: "Scan hackers you meet. They're invited first.",
    action: "scan",
    chatsExtras: true,
  },
  {
    id: "f5",
    day: 0,
    start: 1170,
    end: 1230,
    title: "Opening ceremony",
    where: "Ivey BMO Auditorium",
  },
  {
    id: "f6",
    day: 0,
    start: 1230,
    end: 1380,
    title: "Back to your booth",
    where: "Sponsor Bay (SM Atrium)",
    action: "scan",
    chatsExtras: true,
  },
  {
    id: "f7",
    day: 0,
    start: 1230,
    end: 1320,
    by: true,
    title: "Submit your shortlist",
    action: "chats",
    doneWhen: "shortlist",
    chatsOnly: true,
  },
  {
    id: "f8",
    day: 0,
    start: 1320,
    end: 1320,
    title: "We confirm your chat times and invite hackers",
    sub: "Nothing to do.",
    chatsOnly: true,
  },
  {
    id: "f9",
    day: 0,
    start: 1380,
    end: 1380,
    title: "Sponsor Bay closes",
    where: "SM Atrium",
  },
  // Saturday
  {
    id: "s0",
    day: 1,
    start: 0,
    end: 0,
    note: true,
    title: "Sponsor Bay is open 10:00 AM–11:00 PM",
    sub: "Staff your booth as long as you like.",
  },
  {
    id: "s1",
    day: 1,
    start: 480,
    end: 570,
    title: "Breakfast",
    where: "Rm 1230",
  },
  {
    id: "sp",
    day: 1,
    start: 600,
    end: 1260,
    title: "Coffee chats",
    sub: "We confirm your reps' times and rooms at 10:00 PM Friday.",
    action: "chats",
    chatsPlaceholder: true,
    chatsOnly: true,
  },
  { id: "s4", day: 1, start: 720, end: 810, title: "Lunch", where: "Rm 1230" },
  {
    id: "s6",
    day: 1,
    start: 930,
    end: 990,
    title: "Snack wagon",
    where: "Whole building",
  },
  {
    id: "s8",
    day: 1,
    start: 1140,
    end: 1200,
    title: "Dinner",
    where: "Rm 1230",
  },
  // Sunday
  {
    id: "u1",
    day: 2,
    start: 480,
    end: 570,
    title: "Breakfast",
    where: "Rm 1230",
  },
  {
    id: "u2",
    day: 2,
    start: 510,
    end: 540,
    title: "Judging workshop",
    where: "SM 2235",
    prizeOnly: true,
  },
  {
    id: "u3",
    day: 2,
    start: 540,
    end: 585,
    due: 585,
    title: `Pick your finalists, up to ${SHORTLIST_MAX}`,
    action: "judging",
    prizeOnly: true,
    doneWhen: "finalists",
  },
  {
    id: "u4",
    day: 2,
    start: 600,
    end: PRESENTATION_WINDOW_END,
    range: true,
    title: "Hear presentations",
    prizeOnly: true,
  },
  {
    id: "u5",
    day: 2,
    start: PRESENTATION_WINDOW_END,
    end: 720,
    by: true,
    title: "Submit your final picks",
    action: "judging",
    prizeOnly: true,
    doneWhen: "top5",
  },
  {
    id: "u6",
    day: 2,
    start: 720,
    end: 780,
    title: "Demo fair",
    where: "Grand Hall",
  },
  { id: "u7", day: 2, start: 750, end: 840, title: "Lunch", where: "Rm 1230" },
  {
    id: "u8",
    day: 2,
    start: 840,
    end: 960,
    title: "Closing ceremony",
    where: "Ivey BMO Auditorium",
  },
];

export const sponsorHomeCopy = {
  seoTitle: "Home",
  hi: "Hi",
  logoAlt: (sponsor: string) => sponsor,

  welcome: {
    title: "Welcome to Hack Western 13!",
    /** The tier comes from the sponsor sheet; without one, no tier. */
    thanks: (tier: string | null) =>
      tier
        ? `Thank you so much for being ${withArticle(tier)} sponsor.`
        : "Thank you so much for sponsoring Hack Western 13.",
    close: "Close welcome message",
    closeTitle: "Close",
  },

  contacts: {
    title: "Contacts",
    pointOfContact: "Your point of contact",
    emergency: "Emergency contact",
    copy: "Copy",
    copied: "Copied",
    copyLabel: (name: string, phone: string) =>
      `Copy ${name}'s number, ${phone}`,
    copiedLabel: (name: string) => `${name}'s number copied`,
    loading: "Loading contacts…",
  },

  upNext: {
    title: "Up next",
    showAll: "Show all",
    showLess: "Show less",
    now: "Now",
    next: "Up next",
    /** "Up next · in 25 min" */
    nextIn: (minutes: number) =>
      minutes < 60
        ? `Up next · in ${minutes} min`
        : `Up next · in ${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`,
    earlier: "Earlier",
    ahead: "Look ahead",
    allSet: "That's everything for today.",
    allDay: "All day",
    by: (time: string) => `By ${time}`,
    to: (time: string) => `to ${time}`,
    due: (time: string) => `due ${time}`,
    done: "Done",
    days: [
      { name: "Friday", short: "Fri", date: "Nov 20" },
      { name: "Saturday", short: "Sat", date: "Nov 21" },
      { name: "Sunday", short: "Sun", date: "Nov 22" },
    ],
    dayHeading: (name: string, date: string) => `${name}, ${date}`,
    /** "Fri Nov 20 · 6:00 PM" */
    clock: (day: string, time: string) => `${day} · ${time}`,
    actions: {
      chats: "Chats",
      scan: "Scan",
      yourChats: "Your chats",
      judging: "Judging",
    } satisfies Record<AgendaAction, string>,
    /** Saturday's workshop row, from the sponsor's run of show workshop. */
    workshopArrive: (time: string) => `Arrive by ${time} to set up`,
    workshopSub: (title: string, time: string, where: string | null) =>
      where ? `${title} ${time}, ${where}` : `${title} ${time}`,
    /** One row per rep session once chats are confirmed. */
    chatTitle: (rep: string) => `${rep}'s coffee chats`,
    chatSub: (chats: number, confirmed: number) =>
      `${plural(chats, "chat")}, ${plural(confirmed, "hacker")} confirmed`,
    /** Sunday's presentations: the sponsor's judging room, when it's set. */
    judgingRoom: (room: string) => `Rm ${room}`,
  },

  keyRooms: {
    title: "Key rooms",
    lounge: { label: "Sponsor lounge", hint: "All weekend", room: "Rm 2110" },
    belongings: {
      label: "Belongings overnight",
      hint: "Between days",
      room: "Rm 2244",
    },
    chats: "Coffee chats",
    chatsPending: "Rooms assigned Fri 10:00 PM",
    room: (room: string) => `Rm ${room}`,
    iveyRoom: (room: string) => `Ivey Rm ${room}`,
    /** "Ivey Rm 1352, Rm 1354 (15 min walk)" */
    iveyGroup: (rooms: string[]) =>
      `Ivey ${rooms.map((r) => `Rm ${r}`).join(", ")} (15 min walk)`,
    repRooms: (rep: string) => `${rep}:`,
  },
} as const;
