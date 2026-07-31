import Image from "next/image";
import { useState } from "react";
import {
  type Mentor,
  MentorsList,
  MentorTagsList,
  type MentorTags,
} from "~/constants/mentors";
import Construction from "./construction";

const Mentors = () => {
  const haveAllMentors = true;

  const [selectedMentorTags, setSelectedMentorTags] = useState<MentorTags[]>(
    [],
  );

  return (
    <>
      {haveAllMentors ? (
        <div className="mb-6 px-6">
          <div className="my-8 md:flex md:flex-col">
            <div className="py-1 font-figtree font-medium text-heavy">
              Filter by:
            </div>
            <div className="flex flex-wrap gap-3">
              {MentorTagsList.map((tag) => (
                <span
                  key={tag}
                  className={`cursor-pointer rounded-md px-3 py-1.5 ${
                    selectedMentorTags.includes(tag)
                      ? "bg-heavy font-medium text-[#ebdff7]"
                      : "bg-[#ebdff7] font-medium text-medium"
                  } font-figtree transition-all hover:bg-heavy hover:text-[#ebdff7]`}
                  onClick={() => {
                    setSelectedMentorTags((prev) =>
                      prev.includes(tag)
                        ? prev.filter((prevTag) => prevTag !== tag)
                        : [...prev, tag],
                    );
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="grid h-screen grid-cols-1 gap-6 overflow-auto pb-96 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5">
            {MentorsList.filter(
              (mentor) =>
                selectedMentorTags.length === 0 ||
                selectedMentorTags.every((tag) => mentor.tags.includes(tag)),
            ).map((mentor) => (
              <MentorCard {...mentor} key={mentor.name} />
            ))}
          </div>
        </div>
      ) : (
        <Construction />
      )}
    </>
  );
};

const MentorCard = (mentor: Mentor) => {
  const handleClick = () => {
    if (mentor.linkedin) {
      window.open(mentor.linkedin, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`flex flex-col rounded-lg border border-[#E2E8F0] bg-white p-4 transition-all duration-200 2xl:p-6 3xl:p-8 ${
        mentor.linkedin
          ? "cursor-pointer hover:border-heavy hover:shadow-lg hover:shadow-heavy/20"
          : ""
      }`}
    >
      <div className="relative my-4 h-24 w-24 overflow-clip rounded-lg border bg-[#E6E2F0] 2xl:h-32 2xl:w-32 3xl:h-40 3xl:w-40">
        {mentor.image && (
          <Image
            src={mentor.image}
            alt={mentor.name}
            layout="fill"
            objectFit="cover"
          />
        )}
      </div>
      <div className="my-2">
        <h2 className="font-figtree text-lg font-medium text-heavy">
          {mentor.name}
        </h2>
        <p className="font-figtree text-base text-[#64748B] text-medium">
          {mentor.desc}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {mentor.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-lg bg-primary-300 p-1 px-2 font-figtree font-medium text-medium"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Mentors;
