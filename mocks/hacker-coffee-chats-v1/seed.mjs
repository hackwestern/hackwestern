// T36: seeds the local hackwestern_sd_chat DB for the hacker Coffee chats
// screenshots. Hacker Tess has two pending requests, one accepted chat and
// two closed ones; hacker Nico has a code but no chats (empty state).
// Re-run before each shot set, since accepting / declining changes rows.
import postgres from "postgres";

const sql = postgres(
  "postgresql://postgres:postgres@localhost:5432/hackwestern_sd_chat",
);
const sponsors = [
  ["22222222-2222-4222-8222-000000000001", "StarTech"],
  ["22222222-2222-4222-8222-000000000002", "Northwind Robotics"],
  ["22222222-2222-4222-8222-000000000003", "Maple Labs"],
  ["22222222-2222-4222-8222-000000000004", "Orbit Bank"],
  ["22222222-2222-4222-8222-000000000005", "Lumen AI"],
];
// StarTech may already exist from earlier seeds: reuse whatever id it has.
for (const sponsor of sponsors) {
  await sql`insert into sponsor_judging_sponsor (id, name, coffee_chat_reps) values (${sponsor[0]}, ${sponsor[1]}, 2) on conflict do nothing`;
  const [row] =
    await sql`select id from sponsor_judging_sponsor where name = ${sponsor[1]}`;
  sponsor[0] = row.id;
}
for (const [id, first, code] of [
  ["seed-hacker-tess", "Tess", "lucky-otter-kite"],
  ["seed-hacker-nico", "Nico", "mellow-heron-lamp"],
]) {
  await sql`insert into "user" (id, email, name, type) values (${id}, ${id + "@example.com"}, ${first + " Example"}, 'hacker') on conflict (id) do nothing`;
  await sql`insert into application (user_id, status, first_name, last_name, github_link, linkedin_link, devpost_link, resume_link) values (${id}, 'CONFIRMED', ${first}, 'Example', '', '', '', '') on conflict do nothing`;
  await sql`update "user" set hacker_id = ${code} where id = ${id}`;
}
await sql`delete from coffee_chat where user_id in ('seed-hacker-tess', 'seed-hacker-nico')`;
const chats = [
  [sponsors[0][0], "10:30", 30, "pending", "Rm 2241", "Lee"],
  [sponsors[1][0], "11:15", 15, "pending", null, null],
  [sponsors[2][0], "13:00", 15, "accepted", "Rm 2242", "Sam"],
  [sponsors[3][0], "14:00", 15, "declined", "Rm 2243", null],
  [sponsors[4][0], "09:30", 15, "expired", "Rm 2241", null],
];
for (const [sponsor, slot, minutes, status, room, rep] of chats) {
  await sql`insert into coffee_chat (sponsor_id, user_id, room, slot_time, duration_minutes, status, rep_name) values (${sponsor}, 'seed-hacker-tess', ${room}, ${slot}, ${minutes}, ${status}, ${rep})`;
}
const ids =
  await sql`select id from coffee_chat where user_id = 'seed-hacker-tess'`;
await sql.end();
export const tessChatIds = ids.map((r) => r.id);
