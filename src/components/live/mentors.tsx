import Image from "next/image";
import { type Mentor, MentorsList } from "~/constants/mentors";

const Mentors = () => {
  return (
    <div className="">
      <div>Tags</div>
      <div className="grid grid-cols-2 gap-4 overflow-auto xl:grid-cols-3 3xl:grid-cols-4">
        {MentorsList.map((mentor) => (
          <MentorCard {...mentor} />
        ))}
      </div>
    </div>
  );
};

const MentorCard = (mentor: Mentor) => {
  return (
    <div className="flex flex-col items-center">
      <Image src={mentor.image} alt={mentor.name} width={150} height={150} />
      <h2>{mentor.name}</h2>
      <p>{mentor.desc}</p>
      <div>
        {mentor.tags.map((tag) => (
          <span>{tag}</span>
        ))}
      </div>
    </div>
  );
};

export default Mentors;
