import { disabledRedirect } from "~/utils/redirect";
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
import { Input } from "~/components/ui/input";
import { useState } from "react";

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
    <div className="bg-hw-linear-gradient-day flex flex-col items-center justify-center bg-primary-100 py-4">
      <h1 className="z-10 mb-4 text-3xl">Internal Dashboard</h1>
      <Accordion type="multiple" className="z-10 mb-3">
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
      <div className="z-10 mb-3 text-sm">
        {reviewData?.length} applications reviewed!
      </div>
      <div className="z-10 mb-3 flex gap-3">
        {nextReviewId ? (
          <Button asChild variant="primary">
            <Link href={`/internal/review?applicant=${nextReviewId}`}>
              Review Next
            </Link>
          </Button>
        ) : (
          <div>All reviews completed! 🎉</div>
        )}
        <Button asChild variant="primary">
          <Link href="/internal/adjust-status">Adjust Status</Link>
        </Button>
      </div>
      <Input
        className="z-10 mb-4 mt-3 w-96"
        placeholder="Search by name or email"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="z-10 font-figtree text-medium">
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

export const getServerSideProps = disabledRedirect;
