import { type GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";

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
  });

  const emailIsVerified = !!user?.emailVerified;
  const userHasPassword = !!user?.password;

  // redirect to not-verified page if email is not verified AND they're not using oauth
  // oauth users don't have passwords, so redirect if not verified and they have password
  if (!emailIsVerified && userHasPassword) {
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
    with: {
      accounts: true,
    },
  });

  // redirect to dashboard if user is verified, or they don't have a password (oauth user)
  if (!!user?.emailVerified || !user?.password) {
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
