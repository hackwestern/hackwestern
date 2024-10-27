import { api } from "~/utils/api";
import { DataTable } from "~/components/ui/data-table";
import { refferalColumns } from "~/components/columns";
import { Button } from "~/components/ui/button";
import CloudBackground from "~/components/cloud-background";
import { Input } from "~/components/ui/input";
import { useState } from "react";
import { authRedirectOrganizer } from "~/utils/redirect";
import { Textarea } from "~/components/ui/textarea";

const Refferals = () => {
  const { data: refferalData, refetch } = api.review.getAllRefferals.useQuery();
  const [refferalApplicant, setRefferalApplicant] = useState("");
  const mutation = api.review.referApplicantByEmail.useMutation({
    onSuccess: () => {
      refetch();
      setRefferalApplicant("");
    },
    onError: () => {},
  });

  const handleReferApplicants = async () => {
    const failedEmails = [];
    const emails = refferalApplicant
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email);

    for (const email of emails) {
      try {
        await mutation.mutateAsync({ email }); // Wait for the mutation to complete
      } catch (error) {
        console.log(email, error);
        failedEmails.push(email);
      }
    }
    console.log("Failed Emails: ", failedEmails);
  };

  return (
    <div className="flex flex-col items-center justify-center bg-primary-100 bg-hw-linear-gradient-day py-4">
      <CloudBackground />
      <h1 className="z-10 mb-5 text-3xl">Refferals Dashboard</h1>
      <Textarea
        className="z-10 h-20 w-96" // Increase height for better UX
        placeholder="Enter emails of applicants being referred, separated by commas"
        value={refferalApplicant}
        onChange={(e) => setRefferalApplicant(e.target.value)}
      />
      <Button
        variant="primary"
        className="z-10 m-3 p-5"
        onClick={() => handleReferApplicants()}
      >
        Create Refferals
      </Button>
      {refferalData ? <h2>{refferalData?.length} refferals</h2> : ""}
      <div className="z-10 mt-4">
        {refferalData ? (
          <DataTable columns={refferalColumns} data={refferalData} />
        ) : (
          <h2>Loading...</h2>
        )}
      </div>
    </div>
  );
};

export const getServerSideProps = authRedirectOrganizer;

export default Refferals;
