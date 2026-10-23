// Server-side routing around RSVP: what /rsvp, /dashboard (production) and
// /login decide for a given session and application status.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { GetServerSidePropsContext } from "next";
import type * as NextAuth from "next-auth";
import type * as NextAuthJwt from "next-auth/jwt";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import { applications } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { RSVP_DEADLINE } from "~/lib/date";

type Session = Awaited<ReturnType<typeof mockSession>>;
const signedIn: { current: Session | null } = { current: null };

vi.mock("next-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof NextAuth>()),
  getServerSession: vi.fn(async () => signedIn.current),
}));
vi.mock("next-auth/jwt", async (importOriginal) => ({
  ...(await importOriginal<typeof NextAuthJwt>()),
  getToken: vi.fn(async () =>
    signedIn.current ? { sub: signedIn.current.user.id } : null,
  ),
}));

const { getServerSideProps: rsvpProps } = await import("~/pages/rsvp");
const { getServerSideProps: dashboardProps } = await import(
  "~/pages/dashboard"
);
const { hackerLoginRedirect } = await import("~/utils/redirect");

const ctx = (resolvedUrl: string, query: Record<string, string> = {}) =>
  ({
    req: {},
    res: {},
    query,
    resolvedUrl,
  }) as unknown as GetServerSidePropsContext;

const WHILE_OPEN = RSVP_DEADLINE.getTime() - 7 * 24 * 60 * 60 * 1000;

let session: Session;
const apply = (status: (typeof applications.$inferInsert)["status"]) =>
  db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status,
    realm: "desert",
  });

beforeEach(async () => {
  vi.spyOn(Date, "now").mockReturnValue(WHILE_OPEN);
  session = await mockSession(db);
  signedIn.current = session;
});

afterEach(async () => {
  vi.restoreAllMocks();
  signedIn.current = null;
  await db.delete(applications).where(eq(applications.userId, session.user.id));
});

describe("/rsvp", () => {
  test("signed out: login, then back to the same link", async () => {
    signedIn.current = null;
    expect(
      await rsvpProps(ctx("/rsvp?celebrate=1", { celebrate: "1" })),
    ).toEqual({
      redirect: {
        destination: "/login?callbackUrl=%2Frsvp%3Fcelebrate%3D1",
        permanent: false,
      },
    });
  });

  test("accepted, from the email: the invitation with confetti", async () => {
    await apply("ACCEPTED");
    expect(
      await rsvpProps(ctx("/rsvp?celebrate=1", { celebrate: "1" })),
    ).toEqual({
      props: {
        status: "ACCEPTED",
        email: null,
        realm: "desert",
        celebrate: true,
        closed: false,
        deadlineText: "Friday, November 6 at 11:59 p.m. ET",
      },
    });
  });

  test("declined: no confetti, even from the email link", async () => {
    await apply("DECLINED");
    const result = await rsvpProps(
      ctx("/rsvp?celebrate=1", { celebrate: "1" }),
    );
    expect(result).toMatchObject({
      props: { status: "DECLINED", celebrate: false },
    });
  });

  test.each(["PENDING_REVIEW", "REJECTED", "WAITLISTED"] as const)(
    "%s: 'no RSVP on this account' with the signed-in email, never why",
    async (status) => {
      await apply(status);
      expect(await rsvpProps(ctx("/rsvp"))).toMatchObject({
        props: { status: "NONE", email: session.user.email, celebrate: false },
      });
    },
  );

  test("no application at all (e.g. a different Google account)", async () => {
    expect(await rsvpProps(ctx("/rsvp"))).toMatchObject({
      props: { status: "NONE", email: session.user.email, realm: null },
    });
  });

  test("the server decides when RSVP is closed", async () => {
    await apply("ACCEPTED");
    vi.spyOn(Date, "now").mockReturnValue(RSVP_DEADLINE.getTime());
    expect(await rsvpProps(ctx("/rsvp"))).toMatchObject({
      props: { status: "ACCEPTED", closed: true },
    });
  });
});

describe("/dashboard on production", () => {
  const env = process.env.VERCEL_ENV;
  beforeEach(() => {
    process.env.VERCEL_ENV = "production";
  });
  afterEach(() => {
    process.env.VERCEL_ENV = env;
  });

  test.each(["ACCEPTED", "CONFIRMED", "DECLINED"] as const)(
    "%s hackers are sent to /rsvp",
    async (status) => {
      await apply(status);
      expect(await dashboardProps(ctx("/dashboard"))).toEqual({
        redirect: { destination: "/rsvp", permanent: false },
      });
    },
  );

  test("anyone else keeps the current behaviour (not /rsvp)", async () => {
    await apply("PENDING_REVIEW");
    const result = await dashboardProps(ctx("/dashboard"));
    expect(result).not.toEqual({
      redirect: { destination: "/rsvp", permanent: false },
    });
  });
});

describe("/login when already signed in", () => {
  test("follows a callback that's a path on this site", async () => {
    expect(
      await hackerLoginRedirect(
        ctx("/login", { callbackUrl: "/rsvp?celebrate=1" }),
      ),
    ).toEqual({
      redirect: { destination: "/rsvp?celebrate=1", permanent: false },
    });
  });

  test.each(["https://evil.com", "//evil.com", "/\\evil.com"])(
    "ignores %s and goes to /dashboard",
    async (callbackUrl) => {
      expect(await hackerLoginRedirect(ctx("/login", { callbackUrl }))).toEqual(
        { redirect: { destination: "/dashboard", permanent: false } },
      );
    },
  );

  test("signed out: shows the login page", async () => {
    signedIn.current = null;
    expect(await hackerLoginRedirect(ctx("/login"))).toEqual({ props: {} });
  });
});
