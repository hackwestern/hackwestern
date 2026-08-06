import { describe, expect, test, beforeAll, afterAll, assert } from "vitest";
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
  const joinCode = faker.string.sample(6);
  const id = faker.string.sample(12);
  await db.insert(teams).values({ name: "Team 1", id: id, joinCode: joinCode });
  return { code: joinCode, id: id };
};
const removeTeam = async (id: string) => {
  await db.delete(teams).where(eq(teams.id, id));
};

describe("teams basic endpoints", () => {
  describe("createTeam Tests", () => {
    test("createTeam success", async () => {
      await caller.teams.createTeam({ name: "Best Team" });

      const user = await db.query.users.findFirst({
        where: eq(users.id, ctx.session!.user.id),
      });

      expect(user).toSatisfy((s: { teamId: string | null }) => {
        return s.teamId != null;
      });
    });
    test("createTeam already in team", async () => {
      const teamId = await insertTeam();
      await db
        .update(users)
        .set({ teamId: teamId.id })
        .where(eq(users.id, ctx.session!.user.id));
      const res = caller.teams.createTeam({ name: "Best Team" });

      await expect(res).rejects.toThrow();

      await db
        .update(users)
        .set({ teamId: null })
        .where(eq(users.id, ctx.session!.user.id));
      await removeTeam(teamId.id);
    });
  });
  describe.sequential("joinTeam Tests", () => {
    let teamId: { code: string; id: string };
    beforeAll(async () => {
      teamId = await insertTeam();
    });
    afterAll(async () => {
      await removeTeam(teamId.id);
    });
    test("joinTeam success", async () => {
      const res = caller.teams.joinTeam({ joinCode: teamId.code });

      return expect(res).resolves.toEqual({ success: true });
    });
    test("joinTeam fail because already in team", async () => {
      const res = caller.teams.joinTeam({ joinCode: teamId.code });

      return expect(res).rejects.toThrow();
    });
    test("joinTeam fail because team is full", async () => {
      const teamId = await insertTeam();

      const s = () => {
        return {
          id: faker.string.uuid(),
          name: faker.person.fullName(),
          email: faker.internet.email(),
          emailVerified: faker.date.anytime(),
          image: faker.image.avatar(),
          teamId: teamId.id,
        };
      };
      const newUsers = Array.from({ length: 4 }, s);

      await db.insert(users).values(newUsers);

      const res = caller.teams.joinTeam({ joinCode: teamId.code });
      await expect(res).rejects.toThrow();

      await db.delete(users).where(
        inArray(
          users.id,
          newUsers.map((u) => u.id),
        ),
      );
      await removeTeam(teamId.id);
    });
  });
  describe.sequential("leaveTeam Tests", () => {
    let teamId: { code: string; id: string };
    beforeAll(async () => {
      teamId = await insertTeam();
    });

    test("leaveTeam success", async () => {
      await db
        .update(users)
        .set({ teamId: teamId.id })
        .where(eq(users.id, ctx.session!.user.id));
      const res = caller.teams.leaveTeam();

      await expect(res).resolves.toEqual({ success: true });
      const deletedTeam = await db.query.teams.findFirst({
        where: eq(teams.id, teamId.id),
      });
      expect(deletedTeam).toBeUndefined();
    });
    test("leaveTeam fail because not in team", async () => {
      const res = caller.teams.leaveTeam();

      await expect(res).rejects.toThrow();
    });
  });
  describe.sequential("deleteTeam Tests", () => {
    let teamId: { code: string; id: string };
    beforeAll(async () => {
      teamId = await insertTeam();
    });
    afterAll(async () => {
      await removeTeam(teamId.id);
    });

    test("deleteTeam success", async () => {
      await db
        .update(users)
        .set({ teamId: teamId.id })
        .where(eq(users.id, ctx.session!.user.id));

      const res = caller.teams.deleteTeam();
      await expect(res).resolves.toEqual({ success: true });

      expect(
        await db.query.teams.findFirst({ where: eq(teams.id, teamId.id) }),
      ).toBeUndefined();
    });
    test("deleteTeam fail because not in team", async () => {
      const res = caller.teams.deleteTeam();
      await expect(res).rejects.toThrow();
    });
  });
  describe.sequential("submitProject Tests", () => {
    test("submitProject fails with no project saved", async () => {
      const teamId = await insertTeam();
      const join = caller.teams.joinTeam({ joinCode: teamId.code });
      await expect(join).resolves.toEqual({ success: true });

      const res = caller.teams.submitProject();
      await expect(res).rejects.toThrow();
      await removeTeam(teamId.id);
    });
    test("submitProject success", async () => {
      const teamId = await insertTeam();
      const join = caller.teams.joinTeam({ joinCode: teamId.code });
      await expect(join).resolves.toEqual({ success: true });

      const save = await caller.teams.saveProject({
        devpostUrl: "this is a url",
        githubUrl: "this is a url",
      });
      expect(save).toEqual({ success: true });

      const submit1 = caller.teams.submitProject();
      await expect(submit1).rejects.toThrow();

      const save2 = caller.teams.saveProject({
        memberGithubUsernames: ["url 1"],
        memberDevpostUsernames: ["url 2"],
      });
      await expect(save2).resolves.toEqual({ success: true });

      const submit = caller.teams.submitProject();
      await expect(submit).resolves.toEqual({ success: true });
      await removeTeam(teamId.id);
    });
    test("submitProject fails when member usernames missing", async () => {
      const teamId = await insertTeam();
      const join = caller.teams.joinTeam({ joinCode: teamId.code });
      await expect(join).resolves.toEqual({ success: true });

      const save = caller.teams.saveProject({
        devpostUrl: "this is a url",
        githubUrl: "this is a url",
      });

      await expect(save).resolves.toEqual({ success: true });

      const submit = caller.teams.submitProject();
      await expect(submit).rejects.toThrow();
      await removeTeam(teamId.id);
    });
  });
  describe("saveProject Tests", () => {
    test("saveProject", async () => {
      const teamId = await insertTeam();
      const join = caller.teams.joinTeam({ joinCode: teamId.code });
      await expect(join).resolves.toEqual({ success: true });

      const res = caller.teams.saveProject({ devpostUrl: "Url" });
      await expect(res).resolves.toEqual({ success: true });

      const res1 = caller.teams.saveProject({ tracks: ["General"] });
      await expect(res1).resolves.toEqual({ success: true });

      const team = await db.query.teams.findFirst({
        where: eq(teams.id, teamId.id),
      });

      const tracks = (team?.tracks ?? [""])[0];

      assert(team?.devpostUrl == "Url");
      assert(tracks == "General");
    });
  });
  describe.sequential("getTeam Tests", () => {
    test("getTeam success", async () => {
      const get = caller.teams.getTeam();
      expect(get).resolves;
    });
    test("getTeam fail because not in team", async () => {
      const leave = caller.teams.leaveTeam();

      await expect(leave).resolves.toEqual({ success: true });
      const get = caller.teams.getTeam();

      await expect(get).rejects.toThrow();
    });
  });
});
