// Demo data for the coffee chats v2 screenshots. The run-of-show sheet
// can't be read in a worktree without sheet credentials, so capture.mjs
// answers the sheet-backed queries with this, built by the real pure
// builders from the owner's Coffee Chats rows (2026-11-18). Fake people.
// Usage: npx tsx mocks/room-blocks-v2/fake-data.ts > mocks/room-blocks-v2/fake-data.json
import { holdsForSponsor } from "~/lib/coffee-chat-holds";
import { chatRequestOf } from "~/lib/coffee-chat-request";
import { buildSponsorSummaries } from "~/lib/sponsor-organizer";
import { buildChatBoard } from "~/server/api/utils/coffee-chat-board";
import {
  applySponsorNames,
  parseCoffeeChatsTab,
} from "~/server/api/utils/run-of-show-parse";

const now = new Date("2026-11-21T08:00:00-05:00");
const S = [
  ["ef75780e-e201-4056-919b-e2df68c5a42f", "Canada Life"],
  ["764846fa-3fff-4487-b2b3-7f69c3a809c4", "Commure"],
  ["47bd093d-8eb1-4c54-85b3-6aba883e8e3d", "CSE"],
  ["6e9f7724-418d-429b-b60e-64112772dc9c", "Scotiabank"],
  ["adaa0779-1608-42bd-9ce2-aad41b3840c2", "StarTech"],
  ["89170676-4186-4912-8a06-fa0eda0ff309", "Sun Life"],
] as const;
const id = (name: string) => S.find((s) => s[1] === name)![0];
const sponsors = S.map(([sid, name]) => ({
  id: sid,
  name,
  style: null as string | null,
  perSlot: null as number | null,
  watcher: name === "StarTech" ? "Jo Organizer" : null,
}));

const setups = applySponsorNames(
  {
    items: [],
    tasks: [],
    coffeeChats: parseCoffeeChatsTab([
      ["Sponsor", "AVAILABILITY START", "AVAILABILITY END", "CHATTING HOURS", "SLOTS", "HACKERS CHATTING", "FORMAT", "NOTES"],
      ["StarTech", "9:00 AM", "1:00 PM", "2", "24", "24", "Individual (15 mins)", "3-4 reps (notes based on 3)"],
      ["Sunlife", "10:00 AM", "4:00 PM", "3", "12", "36", "Groups (30 mins with 3 people)", ""],
      ["Canada Life", "10:00 AM", "12:00 PM", "3", "4", "12", "Groups (30 mins with 3 people)", ""],
      ["Scotiabank"],
      ["CSE"],
    ]),
  },
  S.map((s) => s[1]),
).coffeeChats;

const hold = (
  n: number,
  name: string,
  room: string,
  startTime: string,
  endTime: string,
) => ({
  holdId: `20000000-0000-4000-8000-00000000000${n}`,
  sponsorId: id(name),
  room,
  startTime,
  endTime,
  note: null,
});
const holds = [
  hold(1, "StarTech", "Rm 2241", "09:00", "10:00"),
  hold(2, "StarTech", "Rm 2241", "11:00", "12:00"),
  hold(3, "Sun Life", "Rm 2242", "10:00", "11:30"),
  hold(4, "Canada Life", "Rm 2243", "10:00", "11:00"),
  hold(5, "Scotiabank", "Rm 2243", "11:30", "12:00"),
];
// A rep leaves at 11: StarTech asks for 2 from 11 to 12.
const limits = [
  { sponsorId: id("StarTech"), startTime: "11:00", endTime: "12:00", hackers: 2 },
];

const names = [
  ["Ava", "Chen"], ["Ben", "Okafor"], ["Chloe", "Singh"], ["Dev", "Patel"],
  ["Ema", "Rossi"], ["Finn", "Walsh"], ["Gia", "Nguyen"], ["Hugo", "Lam"],
  ["Iris", "Khan"], ["Jay", "Moreau"], ["Kai", "Ito"], ["Lena", "Brooks"],
];
let k = 0;
const chat = (
  name: string,
  room: string,
  slotTime: string,
  durationMinutes: number,
  status: "accepted" | "pending" = "accepted",
) => {
  const [firstName, lastName] = names[k % names.length]!;
  k += 1;
  return {
    chatId: `30000000-0000-4000-8000-0000000000${String(k).padStart(2, "0")}`,
    sponsorId: id(name),
    firstName: firstName!,
    lastName: lastName!,
    hackerId: `demo-code-${k}`,
    github: null,
    slotTime,
    durationMinutes,
    room,
    repName: null,
    status,
  };
};
const chats = [
  chat("StarTech", "Rm 2241", "09:00", 15),
  chat("StarTech", "Rm 2241", "09:00", 15),
  chat("StarTech", "Rm 2241", "09:00", 15),
  chat("StarTech", "Rm 2241", "09:15", 15),
  chat("StarTech", "Rm 2241", "09:15", 15, "pending"),
  chat("StarTech", "Rm 2241", "11:00", 15),
  chat("Sun Life", "Rm 2242", "10:00", 30),
  chat("Sun Life", "Rm 2242", "10:00", 30),
  chat("Sun Life", "Rm 2242", "10:00", 30),
  chat("Sun Life", "Rm 2242", "10:30", 30, "pending"),
  chat("Canada Life", "Rm 2243", "10:00", 30),
];

const board = buildChatBoard({ sponsors, setups, chats, holds, limits, now });
const summary = buildSponsorSummaries({
  sponsors: sponsors.map((s) => ({
    id: s.id,
    name: s.name,
    coffeeChatStyle: s.style,
    coffeeChatPerSlot: s.perSlot,
    coffeeChatWatcher: s.watcher,
  })),
  setups,
  chats,
  help: [],
  holds,
  limits,
  now,
});

// StarTech's own page (sponsorChats).
const star = setups.find((s) => s.sponsor === "StarTech")!;
const starRequest = chatRequestOf(star, null);
const starLive = chats.filter((c) => c.sponsorId === id("StarTech"));
const sponsorChats = {
  sponsorName: "StarTech",
  watcherName: "Jo Organizer",
  request: starRequest,
  sheet: {
    windowStart: star.windowStart,
    windowEnd: star.windowEnd,
    chattingHours: star.chattingHours,
  },
  limits: limits.filter((l) => l.sponsorId === id("StarTech")),
  chats: starLive.map((c) => ({
    chatId: c.chatId,
    firstName: c.firstName,
    slotTime: c.slotTime,
    durationMinutes: c.durationMinutes,
    room: c.room,
    repName: c.repName,
    status: c.status,
    startsAt: `2026-11-21T${c.slotTime}:00-05:00`,
  })),
  holds: holdsForSponsor(
    holds,
    id("StarTech"),
    starLive,
    starRequest,
    limits,
    now,
  ),
};

process.stdout.write(
  JSON.stringify({
    board: {
      ...board,
      rooms: ["Rm 2241", "Rm 2242", "Rm 2243"],
      assignableRooms: ["Rm 2241", "Rm 2242", "Rm 2243"],
      colorNames: [...S.map((s) => s[1]), "Test Sponsor"],
      watchers: ["Jo Organizer", "Sam Organizer"],
      readAt: now.toISOString(),
    },
    summary,
    sponsorChats,
  }),
);
