// Lists what's already in the local DB before seeding the T48 board.
import postgres from "postgres";
const sql = postgres("postgresql://postgres:postgres@localhost:5432/hackwestern_sd_chat");
console.log(await sql`select id, name, coffee_chat_reps, coffee_chat_room, coffee_chat_watcher from sponsor_judging_sponsor order by name`);
console.log(await sql`select u.id, u.hacker_id, a.first_name, a.last_name, a.status from "user" u join application a on a.user_id = u.id where u.type = 'hacker' limit 30`);
console.log(await sql`select count(*), status from coffee_chat group by status`);
await sql.end();
