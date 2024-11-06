export type MentorTags =
  | "Front-End"
  | "Back-End"
  | "Hardware"
  | "Data & AI"
  | "Product Design"
  | "Product Management";

export type Mentor = {
  name: string;
  desc: string;
  image: string;
  tags: MentorTags[];
};

export const MentorsList: Mentor[] = [
  {
    name: "Dennis",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End", "Back-End"],
  },
  {
    name: "Cynthia",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Hardware", "Product Design"],
  },
  {
    name: "Not Dennis",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End"],
  },
  {
    name: "Not Cynthia",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Product Management", "Data & AI"],
  },
  {
    name: "Dennis",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End", "Back-End"],
  },
  {
    name: "Cynthia",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Hardware", "Product Design"],
  },
  {
    name: "Not Dennis",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End"],
  },
  {
    name: "Not Cynthia",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Product Management", "Data & AI"],
  },
  {
    name: "Dennis",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End", "Back-End"],
  },
  {
    name: "Cynthia",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Hardware", "Product Design"],
  },
  {
    name: "Not Dennis",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End"],
  },
  {
    name: "Not Cynthia",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Product Management", "Data & AI"],
  },
  {
    name: "Dennis",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End", "Back-End"],
  },
  {
    name: "Cynthia",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Hardware", "Product Design"],
  },
  {
    name: "Not Dennis",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End"],
  },
  {
    name: "Not Cynthia",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Product Management", "Data & AI"],
  },
];
