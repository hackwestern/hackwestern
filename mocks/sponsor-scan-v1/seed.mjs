// Seeds the local hackwestern_sd_chat DB for the scan + coffee chat screenshots.
import postgres from "postgres";
const sql = postgres("postgresql://postgres:postgres@localhost:5432/hackwestern_sd_chat");
const SPONSOR = "11111111-1111-4111-8111-111111111111";
await sql`insert into sponsor_judging_sponsor (id, name, coffee_chat_reps) values (${SPONSOR}, 'StarTech', 2) on conflict (id) do update set coffee_chat_reps = 2`;
const hackers = [
  ["seed-hacker-alex", "Alex"],
  ["seed-hacker-priya", "Priya"],
  ["seed-hacker-marcus", "Marcus"],
  ["seed-hacker-jun", "Jun"],
  ["seed-hacker-sofia", "Sofia"],
  ["seed-hacker-omar", "Omar"],
];
for (const [id, first] of hackers) {
  await sql`insert into "user" (id, email, name, type) values (${id}, ${id + "@example.com"}, ${first + " Example"}, 'hacker') on conflict (id) do nothing`;
  await sql`insert into application (user_id, status, first_name, last_name, github_link, linkedin_link, devpost_link, resume_link) values (${id}, 'CONFIRMED', ${first}, 'Example', '', '', '', '') on conflict do nothing`;
}
await sql`delete from coffee_chat where sponsor_id = ${SPONSOR}`;
const chats = [
  ["seed-hacker-priya", "10:00", "accepted", "Sam"],
  ["seed-hacker-marcus", "10:00", "declined", null],
  ["seed-hacker-jun", "10:15", "expired", "Sam"],
  ["seed-hacker-sofia", "10:30", "pending", "Lee"],
  ["seed-hacker-omar", "10:30", "cancelled", null],
];
for (const [user, slot, status, rep] of chats) {
  await sql`insert into coffee_chat (sponsor_id, user_id, room, slot_time, duration_minutes, status, rep_name) values (${SPONSOR}, ${user}, 'Rm 2241', ${slot}, 15, ${status}, ${rep})`;
}
console.log(await sql`select u.id, a.status, a.first_name from "user" u join application a on a.user_id = u.id where u.id like 'seed-hacker-%'`);
await sql.end();
