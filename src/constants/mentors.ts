export const MentorTagsList = [
  "Front-End",
  "Back-End",
  "Hardware",
  "Data & AI",
  "Product Design",
  "Product Management",
];

export type MentorTags = (typeof MentorTagsList)[number];

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
    tags: ["Product Management", "Data & AI", "Front-End", "Hardware"],
  },
  {
    name: "Dennis 2",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End", "Back-End"],
  },
  {
    name: "Cynthia 2",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Hardware", "Product Design"],
  },
  {
    name: "Not Dennis 2",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End"],
  },
  {
    name: "Not Cynthia 2",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Product Management", "Data & AI"],
  },
  {
    name: "Dennis 24",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End", "Back-End"],
  },
  {
    name: "Cynthia 22",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Hardware", "Product Design"],
  },
  {
    name: "Not Dennis 3",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End"],
  },
  {
    name: "Not Cynthia 4",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Product Management", "Data & AI"],
  },
  {
    name: "Dennis 5",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End", "Back-End"],
  },
  {
    name: "Cynthia 6",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Hardware", "Product Design"],
  },
  {
    name: "Not Dennis 7 ",
    desc: "dennis @ dennis",
    image: "/images/organizers/dennis.png",
    tags: ["Front-End"],
  },
  {
    name: "Not Cynthia 8",
    desc: "cynthia @ cynthia",
    image: "/images/organizers/cynthia.png",
    tags: ["Product Management", "Data & AI"],
  },
];
