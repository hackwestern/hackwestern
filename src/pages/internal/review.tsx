import { type FC, useState } from "react";
import { Slider } from "~/components/ui/slider";

import { authRedirect } from "~/utils/redirect";

const Review = () => {
  // load previous review data from db
  const reviewData = {
    question1Rating: 8,
    question2Rating: 6,
    question3Rating: 7,
    resumeBonus: 2,
    githubBonus: 1,
    linkedinBonus: 3,
    otherlinkBonus: 0,
  };

  const [question1Rating, setQuestion1Rating] = useState(
    reviewData.question1Rating,
  );
  const [question2Rating, setQuestion2Rating] = useState(
    reviewData.question2Rating,
  );
  const [question3Rating, setQuestion3Rating] = useState(
    reviewData.question3Rating,
  );
  const [resumeBonus, setResumeBonus] = useState(reviewData.resumeBonus);
  const [githubBonus, setGithubBonus] = useState(reviewData.githubBonus);
  const [linkedinBonus, setLinkedinBonus] = useState(reviewData.linkedinBonus);
  const [otherlinkBonus, setOtherlinkBonus] = useState(
    reviewData.otherlinkBonus,
  );

  // replace this with Oscar's get next application thing
  // const applicationData = api.reviews.get.useMutation({});
  const applicationData = tempApplicationData();

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#160524] py-4 text-white">
      <h1 className="text-4xl text-white">Review Application</h1>

      {applicationData ? (
        <div className="flex w-[97vw] flex-col gap-3 p-8 sm:w-[94vw] md:w-[85vw] lg:w-[77vw] xl:w-[72vw] 2xl:w-[66vw] 3xl:w-[60vw] 4xl:w-[52vw]">
          <RateQuestion
            section="Question 1"
            question={applicationData.question1}
            rating={question1Rating}
            setRating={setQuestion1Rating}
            maxRating={10}
          />
          <RateQuestion
            section="Question 2"
            question={applicationData.question2}
            rating={question2Rating}
            setRating={setQuestion2Rating}
            maxRating={10}
          />
          <RateQuestion
            section="Question 3"
            question={applicationData.question3}
            rating={question3Rating}
            setRating={setQuestion3Rating}
            maxRating={10}
          />
          {applicationData.resumeLink && (
            <RateQuestion
              section="Resume"
              url={applicationData.resumeLink}
              rating={resumeBonus}
              setRating={setResumeBonus}
              maxRating={3}
            />
          )}
          {applicationData.githubLink && (
            <RateQuestion
              section="Github"
              url={applicationData.githubLink}
              rating={githubBonus}
              setRating={setGithubBonus}
              maxRating={3}
            />
          )}
          {applicationData.linkedInLink && (
            <RateQuestion
              section="LinkedIn"
              url={applicationData.linkedInLink}
              rating={linkedinBonus}
              setRating={setLinkedinBonus}
              maxRating={3}
            />
          )}
          {applicationData.otherLink && (
            <RateQuestion
              section="Other"
              url={applicationData.otherLink}
              rating={otherlinkBonus}
              setRating={setOtherlinkBonus}
              maxRating={3}
            />
          )}
          <div className="flex justify-center">
            <button
              className="btn-primary rounded-lg border p-3 text-2xl font-bold transition-all hover:bg-gray-600"
              onClick={() => console.log("submit reivew")}
            >
              Submit Review
            </button>
          </div>
        </div>
      ) : (
        <div>Loading...</div>
      )}
    </main>
  );
};

const RateQuestion: FC<{
  question?: string;
  url?: string;
  rating: number;
  setRating: (rating: number) => void;
  maxRating?: number;
  section: string;
}> = ({ question, setRating, maxRating, rating, url, section }) => {
  return (
    <div className="flex w-full flex-col rounded-xl bg-gray-600 p-4 md:flex-row">
      <div className="mr-3 w-full">
        <div className="pb-2 text-center text-xl font-semibold">{section}</div>
        {question ? (
          <div className="max-h-40 w-full overflow-auto pr-2 text-center">
            {question}
          </div>
        ) : (
          <div className="text-center">
            <a
              className="w-full pr-2 text-blue-400 transition-colors duration-75 hover:text-blue-600"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {url}
            </a>
          </div>
        )}
      </div>
      <Slider
        className="w-full p-3"
        max={maxRating ?? 10}
        defaultValue={[rating]}
        onValueChange={(e) => setRating(e[0] ?? 1)}
      />
    </div>
  );
};

const tempApplicationData = () => {
  return {
    question1:
      "The café was bustling with energy. People chatted over steaming cups of coffee, while the barista worked tirelessly behind the counter. The aroma of freshly baked pastries filled the air, blending with the rich scent of espresso, creating a cozy, inviting atmosphere.",
    question2:
      "The mountains stood tall and imposing against the clear blue sky, their peaks dusted with snow. The air was crisp, biting at the exposed skin, but the view was worth the chill. Below, a river wound its way through the valley, its waters sparkling in the sunlight. The sound of rushing water echoed off the cliffs, a soothing backdrop to the rugged landscape. As she stood there, breathing in the clean, fresh air, she felt a deep sense of peace. The world seemed to slow down, and for a moment, all the worries and stresses of daily life faded away.",
    question3:
      "The old house on the hill had always been a subject of fascination for the townsfolk. Built over a century ago, it had weathered countless storms, both literal and metaphorical. Its once-grand façade was now worn, the paint peeling, and the windows dusty and cracked. But despite its dilapidated state, there was an undeniable charm about it. Some said it was haunted, that the spirits of the original owners still roamed the halls at night. Others believed it was just a relic of the past, holding onto memories long forgotten. On quiet evenings, when the wind howled through the trees, the house seemed almost alive, creaking and groaning as if it had stories to tell. For those brave enough to venture inside, the experience was unforgettable—a journey through time, steeped in history, mystery, and a touch of the supernatural.",
    resumeLink:
      "https://www.overleaf.com/latex/templates/jakes-resume/syzfjbzwjncs",
    githubLink: "https://github.com/torvalds",
    linkedInLink: "https://www.linkedin.com/in/linustorvalds/",
    otherLink: "https://kernel.org/",
  };
};

export default Review;
export const getServerSideProps = authRedirect;
