import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { api } from "~/utils/api";

import { authRedirect } from "~/utils/redirect";

const Review = () => {
  const [question1Rating, setQuestion1Rating] = useState(0);
  const [question2Rating, setQuestion2Rating] = useState(0);
  // const [question3Rating, setQuestion3Rating] = useState(0);
  const [resumeBonus, setResumeBonus] = useState(0);
  const [githubBonus, setGithubBonus] = useState(0);
  const [linkedinBonus, setLinkedinBonus] = useState(0);
  const [otherlinkBonus, setOtherlinkBonus] = useState(0);

  // replace this with Oscar's get next application thing
  const data = api.reviews.get.useMutation({});

  const otherThing = api.reviews.getByOrganizer.useQuery();
  console.log('otherThing:', otherThing);

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#160524] py-4 text-white">
      <h1 className="text-4xl text-white">Review Application</h1>
      <Button onClick={
        () => {
          const realData = data.mutate({});
          console.log('data:', realData);
        }
      }>Click me</Button>
      {/*applicationData ? (
        [
          {

          }
        ].map((question, index) => (
          <div key={index}>{applicationData.question1}</div>
        ))
      ) : (
        <div>Loading...</div>
      )*/}
    </main>
  );
};

export default Review;
export const getServerSideProps = authRedirect;
