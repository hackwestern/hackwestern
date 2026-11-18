// Seeds the local hackwestern_notifycenter DB for the /live notification
// center screenshots. Hacker Ivy has three coffee chats (offered, confirmed,
// cancelled) and her team presents to two sponsors on Sunday (she was
// emailed her times). Re-run before each shot set: it resets her seen
// notices and Slack email.
import postgres from "postgres";

const sql = postgres(
  "postgresql://postgres:postgres@localhost:5432/hackwestern_notifycenter",
);
const sponsors = [
  ["33333333-3333-4333-8333-000000000001", "StarTech"],
  ["33333333-3333-4333-8333-000000000002", "Northwind Robotics"],
  ["33333333-3333-4333-8333-000000000003", "Maple Labs"],
  ["33333333-3333-4333-8333-000000000004", "Scotiabank"],
  ["33333333-3333-4333-8333-000000000005", "Canada Life"],
];
for (const [id, name] of sponsors) {
  await sql`insert into sponsor_judging_sponsor (id, name) values (${id}, ${name}) on conflict do nothing`;
}
const team = "seedteamivy1";
await sql`insert into team (id, name, "joinCode") values (${team}, 'Lantern', 'IVY123') on conflict do nothing`;
for (const [id, first] of [
  ["seed-hacker-ivy", "Ivy"],
  ["seed-hacker-omar", "Omar"],
]) {
  await sql`insert into "user" (id, email, name, type, team_id) values (${id}, ${id + "@example.com"}, ${first + " Example"}, 'hacker', ${team}) on conflict (id) do nothing`;
  await sql`insert into application (user_id, status, first_name, last_name, github_link, linkedin_link, devpost_link, resume_link) values (${id}, 'CONFIRMED', ${first}, 'Example', '', '', '', '') on conflict do nothing`;
}
await sql`update "user" set slack_email = null, notifications_seen = '{}' where id = 'seed-hacker-ivy'`;
await sql`delete from coffee_chat where user_id = 'seed-hacker-ivy'`;
const chats = [
  [sponsors[0][0], "15:30", 30, "pending", "Rm 2241", null],
  [sponsors[1][0], "14:15", 15, "accepted", "Rm 2242", "2026-11-18T15:20:00Z"],
  [sponsors[2][0], "13:00", 15, "cancelled", "Rm 2243", null],
];
for (const [sponsor, slot, minutes, status, room, responded] of chats) {
  await sql`insert into coffee_chat (sponsor_id, user_id, room, slot_time, duration_minutes, status, responded_at) values (${sponsor}, 'seed-hacker-ivy', ${room}, ${slot}, ${minutes}, ${status}, ${responded})`;
}
await sql`delete from sponsor_presentation where team_id = ${team}`;
await sql`delete from sponsor_presentation_notice where team_id = ${team}`;
const slots = [
  [sponsors[3][0], "Rm 2110", 600],
  [sponsors[4][0], "Rm 2230", 615],
];
for (const [sponsor, room, start] of slots) {
  await sql`insert into sponsor_presentation (sponsor_id, team_id, room, start_minute) values (${sponsor}, ${team}, ${room}, ${start})`;
}
// slotsKey() in src/lib/sponsor-presentations.ts.
const key = slots
  .map(([sponsor, room, start]) => `${start}|${sponsor}|${room}`)
  .sort()
  .join(";");
for (const [user, status] of [
  ["seed-hacker-ivy", "emailed"],
  ["seed-hacker-omar", "sent"],
]) {
  await sql`insert into sponsor_presentation_notice (user_id, team_id, status, slots_key, sent_at) values (${user}, ${team}, ${status}, ${key}, now())`;
}
await sql.end();
