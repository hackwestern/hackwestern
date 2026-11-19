// Seeds a local organizer who signs in with credentials, for the T47
// screenshots. The password is generated here and written only to
// _local/organizer-login.json (git-ignored). Local DB hackwestern_sd_sched2.
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const sql = postgres(
  "postgresql://postgres:postgres@localhost:5432/hackwestern_sd_sched2",
);
const email = "grid-organizer@example.com";
const password = crypto.randomBytes(18).toString("base64url");
const hash = await bcrypt.hash(password, 10);
await sql`
  insert into "user" (id, email, name, type, password)
  values ('org-grid-shot', ${email}, 'Wendy Organizer', 'organizer', ${hash})
  on conflict (id) do update set password = excluded.password, type = 'organizer'`;
fs.mkdirSync("_local", { recursive: true });
fs.writeFileSync(
  path.join("_local", "organizer-login.json"),
  JSON.stringify({ email, password }, null, 2),
);
console.log("seeded", email, "(password in _local/organizer-login.json)");
await sql.end();
