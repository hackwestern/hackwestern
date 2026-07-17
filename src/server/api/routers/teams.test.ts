import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { mockSession } from "~/server/auth";
import { db } from "~/server/db";
import { createInnerTRPCContext } from "../trpc";
import { createCaller } from "~/server/api/root";
import { eq, inArray } from "drizzle-orm";
import { teams, users } from "~/server/db/schema";
import { faker } from "@faker-js/faker";

const session = await mockSession(db);

const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

const insertTeam = async () => {
  const id = faker.string.sample(6);
  await db.insert(teams).values({ name: "Team 1", id: id });
  return id;
};
const removeTeam = async (id: string) => {
  await db.delete(teams).where(eq(teams.id, id));
};

describe("teams basic endpoints", () => {
  describe("createTeam Tests", () => {
    test("createTeam success", () => {
      const res = caller.teams.createTeam({ name: "Best Team" });
      return expect(res).resolves.toEqual({ success: true });
    });
    test("createTeam already in team", async () => {
      const teamId = await insertTeam();
      await db
        .update(users)
        .set({ teamId: teamId })
        .where(eq(users.id, ctx.session!.user.id));
      const res = caller.teams.createTeam({ name: "Best Team" });

      await expect(res).rejects.toThrow();

      await db
        .update(users)
        .set({ teamId: null })
        .where(eq(users.id, ctx.session!.user.id));
      await removeTeam(teamId);
    });
  });
  describe.sequential("joinTeam Tests", () => {
    let teamId: string;
    beforeAll(async () => {
      teamId = await insertTeam();
    });
    afterAll(async () => {
      await removeTeam(teamId);
    });
    test("joinTeam success", async () => {
      const res = caller.teams.joinTeam({ teamId: teamId });

      return expect(res).resolves.toEqual({ success: true });
    });
    test("joinTeam fail", async () => {
      const res = caller.teams.joinTeam({ teamId: teamId });

      return expect(res).rejects.toThrow();
    });
    test("joinTeam full", async () => {
      const teamId = await insertTeam();

      const s = () => {
        return {
          id: faker.string.uuid(),
          name: faker.person.fullName(),
          email: faker.internet.email(),
          emailVerified: faker.date.anytime(),
          image: faker.image.avatar(),
          teamId: teamId,
        };
      };
      const newUsers = Array.from({ length: 4 }, s);

      await db.insert(users).values(newUsers);

      const res = caller.teams.joinTeam({ teamId: teamId });
      await expect(res).rejects.toThrow();

      await db.delete(users).where(
        inArray(
          users.id,
          newUsers.map((u) => u.id),
        ),
      );
      await removeTeam(teamId);
    });
  });
  describe.sequential("leaveTeam Tests", () => {
    let teamId: string;
    beforeAll(async () => {
      teamId = await insertTeam();
    });

    test("leaveTeam success", async () => {
      await db
        .update(users)
        .set({ teamId: teamId })
        .where(eq(users.id, ctx.session!.user.id));
      const res = caller.teams.leaveTeam();

      await expect(res).resolves.toEqual({ success: true });
      const deletedTeam = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
      });
      expect(deletedTeam).toBeUndefined();
    });
    test("leaveTeam fail", async () => {
      const res = caller.teams.leaveTeam();

      await expect(res).rejects.toThrow();
    });
  });
  describe.sequential("deleteTeam Tests", () => {
    let teamId: string;
    beforeAll(async () => {
      teamId = await insertTeam();
    });
    afterAll(async () => {
      removeTeam(teamId);
    });

    test("deleteTeam success", async () => {
      await db
        .update(users)
        .set({ teamId: teamId })
        .where(eq(users.id, ctx.session!.user.id));

      const res = caller.teams.deleteTeam();
      await expect(res).resolves.toEqual({ success: true });
    });
    test("deleteTeam fail", async () => {
      const res = caller.teams.deleteTeam();
      await expect(res).rejects.toThrow();
    });
  });
});
