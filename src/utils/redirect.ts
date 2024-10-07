import { type GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";

const authRedirect = async (
  context: GetServerSidePropsContext,
  destination: string,
  userTypeTarget?: "hacker" | "organizer" | "sponsor",
) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    console.log("no session found");
    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  }

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
  });

  const userType = user?.type;

  if (userTypeTarget && userType !== userTypeTarget) {
    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export const authRedirectOrganizer = async (
  context: GetServerSidePropsContext,
) => authRedirect(context, "/internal/login", "organizer");

export const authRedirectHacker = async (context: GetServerSidePropsContext) =>
  authRedirect(context, "/login");

export const hackerLoginRedirect = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (session) {
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export const notVerifiedRedirect = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session?.user.id),
    with: {
      accounts: true,
    },
  });

  const isOAuthUser = !!user?.accounts.some((ac) => ac.type === "oauth");
  const now = new Date();

  if (isOAuthUser && !user?.emailVerified) {
    await db
      .update(users)
      .set({
        emailVerified: now,
      })
      .where(eq(users.id, session.user.id));
  }

  if (!user?.emailVerified && !isOAuthUser) {
    return {
      redirect: {
        destination: "/not-verified",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export const isVerifiedRedirect = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session?.user.id),
  });

  if (user?.emailVerified) {
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};
