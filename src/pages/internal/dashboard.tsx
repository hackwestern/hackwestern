import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { db } from "~/server/db";
import { authOptions } from "~/server/auth";
import { api } from "~/utils/api";
import { DataTable } from "~/components/ui/data-table";
import { reviewDashboardColumns } from "~/components/columns";
import { Button } from "~/components/ui/button";
import Link from "next/link";

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
  const { data: nextReviewId } = api.review.getNextId.useQuery({});

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-primary-100 py-4">
      <h1 className="mb-5 text-3xl">Internal Dashboard</h1>
      <div>{reviewData?.length} applications reviewed!</div>
      <Button asChild className="my-2" variant="primary">
        <Link href={`/internal/review?applicant=${nextReviewId}`}>
          Review Next
        </Link>
      </Button>
      <div className="overflow-y-auto">
        {reviewData ? (
          <DataTable columns={reviewDashboardColumns} data={reviewData} />
        ) : (
          <h2>Loading...</h2>
        )}
      </div>
    </div>
  );
};

export default Internal;
