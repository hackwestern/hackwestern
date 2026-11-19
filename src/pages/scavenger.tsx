import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import Scan from "~/components/scan";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";

export default Scan;

// Organizers only, same as the scanner page it links to.
export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: "/login?callbackUrl=/scavenger",
        permanent: false,
      },
    };
  }

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
  });

  if (user?.type !== "organizer") {
    return { redirect: { destination: "/live", permanent: false } };
  }

  return { props: {} };
};
