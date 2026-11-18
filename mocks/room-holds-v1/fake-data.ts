// Demo data for the room-holds screenshots: the run-of-show sheet can't be
// read in a worktree without sheet credentials, so capture.mjs answers the
// three sheet-backed organizer queries with this, built by the real pure
// builders (buildChatBoard, buildSponsorSummaries). Fake people only.
// Usage: npx tsx mocks/room-holds-v1/fake-data.ts > mocks/room-holds-v1/fake-data.json
import { buildSponsorSummaries } from "~/lib/sponsor-organizer";
import type { CoffeeChatSetup } from "~/lib/run-of-show";
import { buildChatBoard } from "~/server/api/utils/coffee-chat-board";

const now = new Date("2026-11-21T08:00:00-05:00");
const S = [
  ["ef75780e-e201-4056-919b-e2df68c5a42f", "Canada Life", "Rm 2241", 1],
  ["764846fa-3fff-4487-b2b3-7f69c3a809c4", "Commure", null, 2],
  ["47bd093d-8eb1-4c54-85b3-6aba883e8e3d", "CSE", "Rm 2242", 2],
  ["6e9f7724-418d-429b-b60e-64112772dc9c", "Scotiabank", null, 1],
  ["adaa0779-1608-42bd-9ce2-aad41b3840c2", "StarTech", "Rm 2243", 1],
  ["89170676-4186-4912-8a06-fa0eda0ff309", "Sun Life", null, 2],
] as const;
const sponsors = S.map(([id, name, room, reps]) => ({
  id,
  name,
  reps,
  style: null,
  perSlot: reps,
  assignedRoom: room,
  watcher: name === "CSE" ? "Sam Organizer" : null,
}));
const setup = (
  sponsor: string,
  windowStart: string,
  windowEnd: string,
  group = false,
): CoffeeChatSetup => ({
  sponsor,
  windowStart,
  windowEnd,
  durationMinutes: group ? 30 : 15,
  groupSize: group ? 3 : 1,
  chattingHours: null,
  slots: null,
  hackers: null,
  format: null,
  notes: null,
  room: null,
});
const setups = [
  setup("Canada Life", "10:00", "11:00", true),
  setup("CSE", "10:00", "11:30"),
  setup("StarTech", "13:00", "14:00"),
];
const chatRow = (
  i: number,
  sponsorId: string,
  slotTime: string,
  status: "accepted" | "pending",
  room: string,
  durationMinutes = 15,
) => ({
  chatId: `00000000-0000-4000-8000-00000000000${i}`,
  sponsorId,
  firstName: ["Avery", "Jordan", "Riley", "Sam", "Taylor", "Morgan"][i]!,
  lastName: "Example",
  hackerId: null,
  slotTime,
  durationMinutes,
  room,
  repName: null,
  status,
});
const chats = [
  chatRow(0, S[0][0], "10:00", "accepted", "Rm 2241", 30),
  chatRow(1, S[0][0], "10:00", "pending", "Rm 2241", 30),
  chatRow(2, S[2][0], "10:15", "accepted", "Rm 2242"),
  chatRow(3, S[2][0], "10:15", "accepted", "Rm 2242"),
  chatRow(4, S[4][0], "13:00", "pending", "Rm 2243"),
  chatRow(5, S[1][0], "11:30", "accepted", "Rm 2243"),
];
const holds = [
  {
    holdId: "10000000-0000-4000-8000-000000000001",
    sponsorId: S[1][0],
    room: "Rm 2243",
    startTime: "11:30",
    endTime: "12:00",
    note: null,
  },
  {
    holdId: "10000000-0000-4000-8000-000000000002",
    sponsorId: S[3][0],
    room: "Rm 2241",
    startTime: "11:00",
    endTime: "11:30",
    note: null,
  },
  {
    holdId: "10000000-0000-4000-8000-000000000003",
    sponsorId: S[5][0],
    room: "Rm 2242",
    startTime: "13:00",
    endTime: "13:30",
    note: null,
  },
];
const board = buildChatBoard({ sponsors, setups, chats, holds, now });
const summary = buildSponsorSummaries({
  sponsors: sponsors.map((s) => ({
    id: s.id,
    name: s.name,
    coffeeChatRoom: s.assignedRoom,
    coffeeChatReps: s.reps,
    coffeeChatWatcher: s.watcher,
  })),
  setups,
  chats: chats.map((c) => ({ ...c, share: c.firstName === "Avery" })),
  help: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      sponsorId: S[3][0],
      status: "open",
      claimedByName: null,
      createdAt: new Date("2026-11-21T09:58:00-05:00"),
    },
  ],
  holds,
  now,
});
const tiers = ["Gold", "Silver", "Gold", "Platinum", "Bronze", "Silver"];
const statuses = [
  "Checked in",
  "Booth set up",
  "Workshop live",
  "Not arrived",
  "Checked in",
  "Left",
];
const list = S.map(([id, name], i) => ({
  name,
  tier: tiers[i]!,
  amount: "",
  companyContact: "Alex Example",
  hwContact: i % 2 ? "Sam Organizer" : "Jo Organizer",
  notes: "",
  sponsorId: id,
  teamIds: i === 0 ? ["t1", "t2"] : [],
  status: statuses[i]!,
  roomNumber: i === 3 ? "TBD" : `30${i}`,
  boothLocation: `Atrium ${i + 1}`,
  onMasterSheet: true,
}));
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
    list,
  }),
);
