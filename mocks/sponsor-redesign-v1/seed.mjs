// Sponsor redesign screenshots: seeds the local hackwestern_spon DB with two
// demo sponsors and redesign-hacker-* users (worst-case names, GitHub links
// valid / missing / junk, consent on and off), interest ranks, a shortlist and
// coffee chats in every status. Touches only rows it owns; re-run any time.
//   node mocks/sponsor-redesign-v1/seed.mjs
import postgres from "postgres";

const sql = postgres(
  "postgresql://postgres:postgres@localhost:5432/hackwestern_spon",
);
export const SPONSOR = "33333333-3333-4333-8333-000000000001";
const SPONSOR_B = "33333333-3333-4333-8333-000000000002";
await sql`insert into sponsor_judging_sponsor (id, name, coffee_chat_reps, coffee_chat_watcher) values (${SPONSOR}, 'Redesign Demo Co', 2, 'Priya from Hack Western') on conflict do nothing`;
await sql`insert into sponsor_judging_sponsor (id, name, coffee_chat_reps) values (${SPONSOR_B}, 'Northwind Robotics Demo', 1) on conflict do nothing`;

// [id suffix, first, last, github, share]
const hackers = [
  ["01", "Tess", "Example", "https://github.com/octocat", true],
  ["02", "Maximiliana-Alexandria", "Featherstonehaugh-Worthington", "https://github.com/torvalds", true],
  ["03", "Li", "Wu", "", true],
  ["04", "Nico", "Park", "https://evil.example.com/x.png", true],
  ["05", "Ama", "Owusu", "https://github.com/this-user-does-not-exist-zz-99", true],
  ["06", "Jordan", "Lee", "https://github.com/gaearon", false],
  ["07", "Zoë", "Ångström", "https://github.com/sindresorhus", true],
  ["08", "Sam", "Rivera", "", true],
];
for (const [n, first, last, github, share] of hackers) {
  const id = `redesign-hacker-${n}`;
  await sql`insert into "user" (id, email, name, type) values (${id}, ${id + "@example.com"}, ${first + " " + last}, 'hacker') on conflict (id) do nothing`;
  await sql`delete from application where user_id = ${id}`;
  await sql`insert into application (user_id, status, first_name, last_name, github_link, linkedin_link, devpost_link, resume_link, agree_share_with_sponsors) values (${id}, 'CONFIRMED', ${first}, ${last}, ${github}, ${share ? "https://linkedin.com/in/example" : ""}, '', ${share ? "https://example.com/resume.pdf" : ""}, ${share})`;
  await sql`update "user" set hacker_id = ${"redesign-code-" + n} where id = ${id}`;
}
const ids = hackers.map(([n]) => `redesign-hacker-${n}`);
await sql`delete from sponsor_interest where user_id in ${sql(ids)}`;
await sql`delete from sponsor_shortlist where user_id in ${sql(ids)}`;
await sql`delete from coffee_chat where user_id in ${sql(ids)}`;
for (const [i, id] of ids.entries()) {
  await sql`insert into sponsor_interest (user_id, sponsor_id, rank) values (${id}, ${SPONSOR}, ${(i % 3) + 1})`;
}
for (const id of [ids[0], ids[1], ids[6]]) {
  await sql`insert into sponsor_shortlist (sponsor_id, user_id) values (${SPONSOR}, ${id})`;
}
const chats = [
  [SPONSOR, ids[0], "10:30", 15, "pending", "Rm 2241", "Lee"],
  [SPONSOR, ids[1], "10:30", 15, "accepted", "Rm 2241", "Alexandra Montgomery-Hughes"],
  [SPONSOR, ids[2], "11:00", 15, "declined", null, null],
  [SPONSOR, ids[5], "11:00", 15, "accepted", "Rm 2241", null],
  [SPONSOR, ids[3], "09:30", 15, "expired", "Rm 2241", null],
  [SPONSOR_B, ids[0], "11:15", 30, "pending", null, null],
  [SPONSOR_B, ids[6], "13:00", 15, "cancelled", "Rm 2242", "Sam"],
];
for (const [sponsor, user, slot, minutes, status, room, rep] of chats) {
  await sql`insert into coffee_chat (sponsor_id, user_id, room, slot_time, duration_minutes, status, rep_name) values (${sponsor}, ${user}, ${room}, ${slot}, ${minutes}, ${status}, ${rep})`;
}
const tess = await sql`select id from coffee_chat where user_id = ${ids[0]}`;
await sql.end();
export const tessChatIds = tess.map((r) => r.id);
console.log("seeded", SPONSOR);
