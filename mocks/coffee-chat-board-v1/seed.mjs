// Seeds coffee chats across sponsors and statuses for the T48 board
// screenshots. Local DB hackwestern_sd_chat only. Replaces the coffee_chat
// rows in this worktree's DB (dev data) and sets reps, rooms and watchers.
import postgres from "postgres";

const sql = postgres(
  "postgresql://postgres:postgres@localhost:5432/hackwestern_sd_chat",
);
const S = {
  StarTech: "11111111-1111-4111-8111-111111111111",
  Northwind: "33333333-3333-4333-8333-333333333333",
  "Maple Labs": "22222222-2222-4222-8222-000000000003",
  "Lumen AI": "22222222-2222-4222-8222-000000000005",
  "Northwind Robotics": "22222222-2222-4222-8222-000000000002",
};
const sponsors = [
  ["StarTech", 2, "Rm 2241", "Wendy Organizer"],
  ["Northwind", 1, "Rm 2242", "Sam Kim"],
  ["Maple Labs", 2, "Rm 2243", "Wendy Organizer"],
  ["Lumen AI", 2, null, null],
  ["Northwind Robotics", 2, null, null],
];
for (const [name, reps, room, watcher] of sponsors) {
  await sql`update sponsor_judging_sponsor set coffee_chat_reps = ${reps},
    coffee_chat_room = ${room}, coffee_chat_watcher = ${watcher}
    where id = ${S[name]}`;
}
const codes = {
  "h-1": "quiet-heron-moss",
  "h-2": "amber-fox-lake",
  "h-3": "swift-pine-cove",
  "seed-hacker-priya": "bright-wren-hill",
  "seed-hacker-marcus": "calm-reef-stone",
};
for (const [id, code] of Object.entries(codes)) {
  await sql`update "user" set hacker_id = ${code} where id = ${id} and hacker_id is null`;
}

// [sponsor, user, time, minutes, status, rep, room]
const chats = [
  ["StarTech", "h-1", "10:00", 15, "accepted", "Dana", "Rm 2241"],
  ["StarTech", "h-2", "10:00", 15, "accepted", "Leo", "Rm 2241"],
  ["StarTech", "h-3", "10:15", 15, "pending", null, "Rm 2241"],
  ["StarTech", "seed-hacker-priya", "10:45", 15, "accepted", "Dana", "Rm 2241"],
  ["StarTech", "seed-hacker-marcus", "10:45", 15, "declined", null, "Rm 2241"],
  ["StarTech", "seed-hacker-jun", "11:15", 15, "pending", "Leo", "Rm 2241"],
  ["StarTech", "seed-hacker-sofia", "11:30", 15, "pending", null, "Rm 2241"],
  ["Northwind", "seed-hacker-omar", "10:30", 30, "accepted", "Kai", "Rm 2242"],
  ["Northwind", "seed-hacker-alex", "10:30", 30, "accepted", "Kai", "Rm 2242"],
  ["Northwind", "seed-hacker-tess", "10:30", 30, "accepted", "Kai", "Rm 2242"],
  ["Northwind", "seed-hacker-nico", "11:30", 30, "pending", null, "Rm 2242"],
  ["Northwind", "h-1", "11:30", 30, "cancelled", null, "Rm 2242"],
  ["Maple Labs", "seed-hacker-tess", "10:00", 15, "declined", null, "Rm 2243"],
  ["Maple Labs", "seed-hacker-nico", "10:15", 15, "accepted", "Ivy", "Rm 2243"],
  ["Maple Labs", "seed-hacker-marcus", "10:30", 15, "accepted", "Ivy", "Rm 2243"],
  ["Maple Labs", "seed-hacker-sofia", "10:45", 15, "expired", null, "Rm 2243"],
  ["Lumen AI", "seed-hacker-omar", "11:15", 15, "pending", null, null],
  ["Lumen AI", "h-2", "11:45", 15, "pending", "Mo", null],
  ["Northwind Robotics", "seed-hacker-jun", "13:00", 30, "accepted", null, null],
  ["Northwind Robotics", "seed-hacker-sofia", "13:00", 30, "pending", null, null],
];
await sql`delete from coffee_chat`;
for (const [sponsor, user, time, minutes, status, rep, room] of chats) {
  await sql`insert into coffee_chat (sponsor_id, user_id, slot_time, duration_minutes, status, rep_name, room)
    values (${S[sponsor]}, ${user}, ${time}, ${minutes}, ${status}, ${rep}, ${room})`;
}
console.log("seeded", chats.length, "chats");
await sql.end();
