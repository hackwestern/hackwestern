import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { db } from "~/server/db";
import { authOptions } from "~/server/auth";
import { api } from "~/utils/api";
import { DataTable } from "~/components/ui/data-table";
import { reviewDashboardColumns } from "~/components/columns";

export async function getServerSideProps(context: GetServerSidePropsContext) {
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

const Internal = () => {
  const { data: reviewData } = api.review.getByOrganizer.useQuery();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#160524]">
      <h1 className="mb-5 text-3xl text-white">Internal Dashboard</h1>
      {reviewData ? (
        <DataTable
          columns={reviewDashboardColumns}
          data={reviewData}
        ></DataTable>
      ) : (
        <h2>Loading...</h2>
      )}
    </div>
  );
};

export default Internal;
