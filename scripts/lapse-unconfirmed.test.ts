import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { RSVP_DEADLINE } from "~/lib/date";
import { db } from "~/server/db";
import { applications, users } from "~/server/db/schema";
import {
  countUnconfirmed,
  lapseUnconfirmed,
  refuseBeforeDeadline,
  revertLapse,
} from "./lapse-unconfirmed";

describe("lapse unconfirmed (DB integration)", () => {
  const PREFIX = "zz-lapse-";
  const ids = (t: string) => `${PREFIX}${t}`;
  const cleanup = async () => {
    await db.delete(users).where(like(users.id, `${PREFIX}%`));
  };
  beforeEach(async () => {
    await cleanup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(RSVP_DEADLINE.getTime() + 60_000);
  });
  afterEach(async () => {
    vi.useRealTimers();
    await cleanup();
  });

  async function seed(
    tag: string,
    status: "ACCEPTED" | "CONFIRMED" | "DECLINED" | "IN_PROGRESS",
    updatedAt = new Date("2026-10-29T03:00:00Z"),
  ) {
    await db.insert(users).values({
      id: ids(tag),
      email: `${PREFIX}${tag}@gmail.com`,
      type: "hacker",
    });
    await db.insert(applications).values({
      userId: ids(tag),
      status,
      updatedAt,
      githubLink: "",
      linkedInLink: "",
      devpostLink: "",
    });
  }
  const statusOf = async (tag: string) =>
    (await db.query.applications.findFirst({
      columns: { status: true, updatedAt: true },
      where: eq(applications.userId, ids(tag)),
    }))!;

  test("refuses before RSVP closes", async () => {
    vi.setSystemTime(RSVP_DEADLINE.getTime() - 1);
    await seed("accepted", "ACCEPTED");
    expect(() => refuseBeforeDeadline()).toThrow("RSVP hasn't closed yet");
    await expect(lapseUnconfirmed(new Date())).rejects.toThrow(
      "RSVP hasn't closed yet",
    );
    expect((await statusOf("accepted")).status).toBe("ACCEPTED");
  });

  test("moves only ACCEPTED to DECLINED, all at the same time", async () => {
    await seed("a1", "ACCEPTED");
    await seed("a2", "ACCEPTED");
    await seed("confirmed", "CONFIRMED");
    await seed("inprogress", "IN_PROGRESS");
    expect(await countUnconfirmed()).toBeGreaterThanOrEqual(2);

    const at = new Date(RSVP_DEADLINE.getTime() + 9 * 3600_000 + 123);
    expect(await lapseUnconfirmed(at)).toBeGreaterThanOrEqual(2);

    for (const t of ["a1", "a2"]) {
      const row = await statusOf(t);
      expect(row.status).toBe("DECLINED");
      expect(row.updatedAt.getTime()).toBe(at.getTime());
    }
    expect((await statusOf("confirmed")).status).toBe("CONFIRMED");
    expect((await statusOf("inprogress")).status).toBe("IN_PROGRESS");
  });

  test("revert puts back only that batch, not real declines", async () => {
    await seed("lapsed", "ACCEPTED");
    await seed("said-no", "DECLINED", new Date("2026-11-02T15:00:00Z"));
    const at = new Date(RSVP_DEADLINE.getTime() + 9 * 3600_000 + 456);
    await lapseUnconfirmed(at);

    expect(await revertLapse(at, false)).toBeGreaterThanOrEqual(1);
    expect((await statusOf("lapsed")).status).toBe("DECLINED"); // dry run

    await revertLapse(at, true);
    expect((await statusOf("lapsed")).status).toBe("ACCEPTED");
    expect((await statusOf("said-no")).status).toBe("DECLINED");
  });
});
