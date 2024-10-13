import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { db } from "~/server/db";
import { authOptions } from "~/server/auth";
import { api } from "~/utils/api";

function Stats() {
  const { data: statsData } = api.application.getAppStats.useQuery();
  console.log(statsData);

  return (
    <div className="flex w-screen flex-col items-center">
      <div>Apps Stats:</div>
      {statsData && statsData.length > 0 ? (
        statsData.map((stat, index) => (
          <div key={index}>
            <span>
              {stat.status}: {stat.count}
            </span>
          </div>
        ))
      ) : (
        <div>No stats available</div>
      )}
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: "internal/login",
        permanent: false,
      },
    };
  }
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
  });

  if (user?.type !== "organizer") {
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
}

export default Stats;
