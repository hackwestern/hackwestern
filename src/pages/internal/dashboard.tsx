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
import Image from "next/image";

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

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-primary-100 bg-hw-linear-gradient-day py-4">
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
      <div className="z-0">
        {/* Clouds */}
        <div className="absolute bottom-0 left-0 h-full w-full md:h-full md:w-[80%]">
          <Image
            src="/images/cloud5.svg"
            alt="hack western cloud"
            className="object-contain object-left-bottom"
            fill
          />
        </div>
        <div className="absolute bottom-0 right-0 h-full w-full md:h-[90%] md:w-[70%] lg:h-[100%]">
          <Image
            src="/images/cloud6.svg"
            alt="hack western cloud"
            className="object-contain object-right-bottom"
            fill
          />
        </div>
        <div className="absolute bottom-0 left-0 h-full w-[50%] md:h-full md:w-[30%]">
          <Image
            src="/images/cloud7.svg"
            alt="hack western cloud"
            className="object-contain object-left-bottom"
            fill
          />
        </div>
        <div className="absolute bottom-0 right-0 h-full w-[50%] md:h-full md:w-[40%] lg:h-[50%] lg:w-[30%]">
          <Image
            src="/images/cloud8.svg"
            alt="hack western cloud"
            className="object-contain object-right-bottom"
            fill
          />
        </div>
        {/* Stars */}
        <div className="absolute bottom-[20%] left-[20%] h-full w-[20%] md:w-[10%] lg:w-[5%]">
          <Image
            src="/images/star.svg"
            alt="hack western star"
            className="object-contain"
            fill
          />
        </div>
        <div className="absolute bottom-[40%] right-[10%] h-full w-[15%] md:w-[7%] lg:w-[3%]">
          <Image
            src="/images/star.svg"
            alt="hack western star"
            className="object-contain"
            fill
          />
        </div>
        <div className="absolute bottom-[25%] right-[15%] h-full w-[20%] md:w-[10%] lg:w-[5%] ">
          <Image
            src="/images/star2.svg"
            alt="hack western star"
            className="object-contain"
            fill
          />
        </div>
        {/* Grain Filter */}
        <Image
          className="absolute left-0 top-0 select-none opacity-20"
          src="/images/hwfilter.png"
          alt="Hack Western Main Page"
          layout="fill"
          objectFit="cover"
        />
      </div>

      <div className="z-10 pt-2">
        {reviewData?.length} applications reviewed!
      </div>
      <Button asChild className="z-10 my-2" variant="primary">
        <Link href={`/internal/review?applicant=${nextReviewId}`}>
          Review Next
        </Link>
      </Button>
      <div className="z-10 mt-4">
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
