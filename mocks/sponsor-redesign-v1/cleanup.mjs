// Removes exactly the rows seed.mjs created in the shared hackwestern_spon DB.
//   node mocks/sponsor-redesign-v1/cleanup.mjs
import postgres from "postgres";

const sql = postgres(
  "postgresql://postgres:postgres@localhost:5432/hackwestern_spon",
);
const sponsors = [
  "33333333-3333-4333-8333-000000000001",
  "33333333-3333-4333-8333-000000000002",
];
const users = Array.from(
  { length: 8 },
  (_, i) => `redesign-hacker-${String(i + 1).padStart(2, "0")}`,
);
const r = {};
r.chats = (await sql`delete from coffee_chat where user_id in ${sql(users)} or sponsor_id in ${sql(sponsors)}`).count;
r.shortlist = (await sql`delete from sponsor_shortlist where user_id in ${sql(users)} or sponsor_id in ${sql(sponsors)}`).count;
r.interest = (await sql`delete from sponsor_interest where user_id in ${sql(users)} or sponsor_id in ${sql(sponsors)}`).count;
r.help = (await sql`delete from sponsor_help_request where sponsor_id in ${sql(sponsors)}`).count;
r.applications = (await sql`delete from application where user_id in ${sql(users)}`).count;
r.users = (await sql`delete from "user" where id in ${sql(users)}`).count;
r.sponsors = (await sql`delete from sponsor_judging_sponsor where id in ${sql(sponsors)}`).count;
await sql.end();
console.log(r);
