import Image from "next/image";
import { useState } from "react";
import {
  type Mentor,
  MentorsList,
  MentorTagsList,
  type MentorTags,
} from "~/constants/mentors";

const Mentors = () => {
  const [selectedMentorTags, setSelectedMentorTags] = useState<MentorTags[]>(
    [],
  );

  return (
    <div className="mb-6 px-6">
      <div className="my-8 md:flex">
        <div className="py-1">Filter by:</div>
        <div className="flex flex-wrap">
          {MentorTagsList.map((tag) => (
            <span
              key={tag}
              className={`cursor-pointer rounded-md px-1.5 py-1 ${
                selectedMentorTags.includes(tag)
                  ? "bg-primary-600 text-primary-100"
                  : "bg-primary-200 text-violet-500"
              } mx-1.5 transition-all hover:bg-primary-500 hover:text-primary-100`}
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
      <div className="grid grid-cols-1 gap-6 overflow-auto md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5">
        {MentorsList.filter(
          (mentor) =>
            selectedMentorTags.length === 0 ||
            selectedMentorTags.every((tag) => mentor.tags.includes(tag)),
        ).map((mentor) => (
          <MentorCard {...mentor} key={mentor.name} />
        ))}
      </div>
    </div>
  );
};

const MentorCard = (mentor: Mentor) => {
  return (
    <div className="flex flex-col rounded-lg border border-[#E2E8F0] bg-white p-4 2xl:p-6 3xl:p-8">
      <div className="relative my-4 h-24 w-24 rounded-lg bg-[#E6E2F0] 2xl:h-32 2xl:w-32 3xl:h-40 3xl:w-40">
        <Image
          src={mentor.image}
          alt={mentor.name}
          layout="fill"
          objectFit="cover"
        />
      </div>
      <div className="my-2">
        <h2 className="text-lg font-medium">{mentor.name}</h2>
        <p className="text-base text-[#64748B]">{mentor.desc}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {mentor.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-lg bg-primary-200 p-1 px-1.5 text-primary-600 "
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Mentors;
