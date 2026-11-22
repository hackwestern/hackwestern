import { type GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { liveAccessRedirect } from "~/lib/live-access";

/**
 * getServerSideProps for the pages inside the live shell (sidebar + top bar):
 * organizers and admitted hackers only, everyone else is sent away. Passes
 * `isOrganizer` to the page.
 */
export async function liveServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);
  const user = session
    ? await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, session.user.id),
        columns: { type: true },
      })
    : undefined;
  const application =
    session && user?.type === "hacker"
      ? await db.query.applications.findFirst({
          where: (applications, { eq }) =>
            eq(applications.userId, session.user.id),
          columns: { status: true },
        })
      : undefined;

  const destination = liveAccessRedirect(
    session ? { type: user?.type ?? null, status: application?.status } : null,
  );
  if (destination) return { redirect: { destination, permanent: false } };

  return { props: { isOrganizer: user?.type === "organizer" } };
}
