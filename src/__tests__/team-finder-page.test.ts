// What /team-finder renders for a given session, user type and time.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { GetServerSidePropsContext } from "next";
import type * as NextAuth from "next-auth";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import { applications, users } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { RSVP_DEADLINE } from "~/lib/date";
import { RETENTION_DATE } from "~/lib/team-finder";

type Session = Awaited<ReturnType<typeof mockSession>>;
const signedIn: { current: Session | null } = { current: null };

vi.mock("next-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof NextAuth>()),
  getServerSession: vi.fn(async () => signedIn.current),
}));

const { getServerSideProps } = await import("~/pages/team-finder");

const ctx = () =>
  ({
    req: {},
    res: {},
    query: {},
    resolvedUrl: "/team-finder",
  }) as unknown as GetServerSidePropsContext;

const BEFORE = RSVP_DEADLINE.getTime() - 60 * 1000;
const AFTER = RSVP_DEADLINE.getTime() + 60 * 1000;

let session: Session;
const apply = (status: "ACCEPTED" | "CONFIRMED") =>
  db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status,
  });
const setType = (type: "organizer" | "sponsor") =>
  db.update(users).set({ type }).where(eq(users.id, session.user.id));
const access = async () => (await getServerSideProps(ctx())).props?.access;

beforeEach(async () => {
  session = await mockSession(db);
  signedIn.current = session;
});

afterEach(async () => {
  vi.restoreAllMocks();
  signedIn.current = null;
  await db.delete(applications).where(eq(applications.userId, session.user.id));
});

describe("/team-finder", () => {
  test("signed out: login, then back here", async () => {
    signedIn.current = null;
    expect(await getServerSideProps(ctx())).toEqual({
      redirect: {
        destination: "/login?callbackUrl=%2Fteam-finder",
        permanent: false,
      },
    });
  });

  test("confirmed hacker before RSVP closes: not open yet", async () => {
    vi.spyOn(Date, "now").mockReturnValue(BEFORE);
    await apply("CONFIRMED");
    expect(await access()).toBe("not-open");
  });

  test("confirmed hacker after RSVP closes: the board", async () => {
    vi.spyOn(Date, "now").mockReturnValue(AFTER);
    await apply("CONFIRMED");
    expect(await access()).toBe("hacker");
  });

  test("accepted but never confirmed: for confirmed hackers only", async () => {
    vi.spyOn(Date, "now").mockReturnValue(AFTER);
    await apply("ACCEPTED");
    expect(await access()).toBe("not-confirmed");
  });

  test("sponsor: for confirmed hackers only", async () => {
    vi.spyOn(Date, "now").mockReturnValue(AFTER);
    await setType("sponsor");
    expect(await access()).toBe("not-confirmed");
  });

  test("turned away: shown their own email, to spot a wrong account", async () => {
    vi.spyOn(Date, "now").mockReturnValue(AFTER);
    await apply("ACCEPTED");
    const props = (await getServerSideProps(ctx())).props;
    expect(props?.email).toBe(session.user.email);
  });

  test("let in: no email in the props", async () => {
    vi.spyOn(Date, "now").mockReturnValue(AFTER);
    await apply("CONFIRMED");
    const props = (await getServerSideProps(ctx())).props;
    expect(props?.email).toBeNull();
  });

  test("once the cards are deleted: closed, even for organizers", async () => {
    vi.spyOn(Date, "now").mockReturnValue(RETENTION_DATE.getTime());
    await apply("CONFIRMED");
    expect(await access()).toBe("closed");
    await setType("organizer");
    expect(await access()).toBe("closed");
  });

  test("organizer before RSVP closes: the board", async () => {
    vi.spyOn(Date, "now").mockReturnValue(BEFORE);
    await setType("organizer");
    expect(await access()).toBe("organizer");
  });
});
