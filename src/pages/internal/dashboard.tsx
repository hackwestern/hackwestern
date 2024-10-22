import type { GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { db } from "~/server/db";
import { authOptions } from "~/server/auth";
import { api } from "~/utils/api";
import { DataTable } from "~/components/ui/data-table";
import { reviewDashboardColumns } from "~/components/columns";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import CloudBackground from "~/components/cloud-background";
import { Input } from "~/components/ui/input";
import { useState } from "react";

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
  const { data: reviewCount } = api.review.getReviewCounts.useQuery();
  const [search, setSearch] = useState("");

  const filteredData = reviewData?.filter((review) => {
    return (
      review.applicant.email.toLowerCase().includes(search.toLowerCase()) ||
      review.application.firstName
        ?.toLowerCase()
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        .includes(search.toLowerCase()) ||
      review.application.lastName?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="flex flex-col items-center justify-center bg-primary-100 bg-hw-linear-gradient-day py-4">
      <CloudBackground />
      <h1 className="z-10 mb-5 text-3xl">Internal Dashboard</h1>
      <Accordion type="multiple" className="z-10">
        <AccordionItem key="leaderboard" value="leaderboard">
          <AccordionTrigger className="text-left">Leaderboard</AccordionTrigger>
          <AccordionContent className="text-left">
            <table className="table-auto">
              <thead>
                <tr>
                  <th className="pr-2">Rank</th>
                  <th>Reviewer</th>
                  <th>Reviews</th>
                </tr>
              </thead>
              <tbody>
                {reviewCount?.map((reviewer, index) => (
                  <tr key={index}>
                    <td className="text-center">{index + 1}</td>
                    <td className="text-center">{reviewer.reviewerName}</td>
                    <td className="text-center">{reviewer.reviewCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <div className="z-10 pt-2">
        {reviewData?.length} applications reviewed!
      </div>
      <Button asChild className="z-10 my-2" variant="primary">
        <Link href={`/internal/review?applicant=${nextReviewId}`}>
          Review Next
        </Link>
      </Button>
      <Input
        className="z-10 w-96"
        placeholder="Search by name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="z-10 mt-4">
        {reviewData && filteredData ? (
          <DataTable columns={reviewDashboardColumns} data={filteredData} />
        ) : (
          <h2>Loading...</h2>
        )}
      </div>
    </div>
  );
};

export default Internal;
