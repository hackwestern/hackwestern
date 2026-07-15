import { inArray } from "drizzle-orm";
import { exit } from "process";
import { silentdb as db } from "~/server/db";
import { users } from "~/server/db/schema";
import { UserSeeder } from "~/server/db/seed/userSeeder";
import bcrypt from "bcrypt";

//@ts-expect-error This is totally valid just dont pass anything weird
const AUTH_TYPE: "n" | "y" | "o" = process.env.AUTH_TYPE ?? "n";

export interface LoadTestingUser {
  email: string;
  password: string;
  id: string;
}

export async function SeedDBForLoadTesting() {
  const userSeeder = new UserSeeder();

  const selectedUsersPromise = Array.from({ length: 100 }, (_, i) => i).map(
    async (_) => {
      const u = userSeeder.createRandom();
      const password = "ThisIsAStrongPassword1!";

      const salt: string = await bcrypt.genSalt(10);
      const hashedPassword: string = await bcrypt.hash(password, salt);
      const user_type: "organizer" | "hacker" =
        AUTH_TYPE == "o" ? "organizer" : "hacker";

      return {
        internalUser: {
          email: u.email,
          password: password,
          id: u.id,
        },
        dbUser: {
          password: hashedPassword,
          type: user_type,
          ...u,
        },
      };
    },
  );
  const selectedUsers = await Promise.all(selectedUsersPromise);

  await db.transaction(async (tx) => {
    await tx.insert(users).values(selectedUsers.map((u) => u.dbUser));
  });

  const json = JSON.stringify(selectedUsers.map((v) => v.internalUser));
  console.log(json);
  exit(0);
}

export async function RemoveSeededUsers() {
  const usersEnv: string | undefined = process.env.USERS;
  if (usersEnv == undefined) {
    console.log(
      "The USERS env var is not set, this must be set to remove the users",
    );
    exit(0);
  }
  const decoded: LoadTestingUser[] = JSON.parse(usersEnv);

  const ids = decoded.map((v) => v.id);
  await db.delete(users).where(inArray(users.id, ids));

  exit(0);
}
