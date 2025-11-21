export const MentorTagsList = [
  "Back-End",
  "Data & AI",
  "DevOps & Cloud",
  "Front-End",
  "Hardware",
  "Mobile Development",
  "Product Design",
  "Product Management",
  "UI/UX",
] as const;

export type MentorTags = (typeof MentorTagsList)[number];

export type Mentor = {
  name: string;
  desc: string;
  image?: string;
  tags: MentorTags[];
};

export const MentorsList: Mentor[] = [
  {
    name: "Afenifere Hammed Adewumi",
    desc: "CEO of Oneremit",
    image: "/images/mentors/afenifere_hammed_adewumi.webp",
    tags: ["Product Management"],
  },
  {
    name: "Arsalaan Ali",
    desc: "Incoming Software Engineer Intern @ Tesla, Ex - Hack Western, Twilio",
    image: "/images/mentors/arsalaan_ali.webp",
    tags: ["Front-End", "Back-End"],
  },
  {
    name: "Bonnie Qiu",
    desc: "Product Manager, UI/UX Design",
    image: "/images/mentors/bonnie_qiu.webp",
    tags: ["UI/UX", "Product Management"],
  },
  {
    name: "Cedric Leung",
    desc: "Full stack/ Generalist",
    image: "/images/mentors/cedric_leung.webp",
    tags: [
      "Front-End",
      "Back-End",
      "UI/UX",
      "Mobile Development",
      "DevOps & Cloud",
      "Data & AI"
    ],
  },
  {
    name: "David George",
    desc: "iOS Software Engineer @ Mark43",
    image: "/images/mentors/david_george.webp",
    tags: ["Mobile Development", "Front-End", "Back-End"],
  },
  {
    name: "Edwin Ngui",
    desc: "SWE Intern @ NRC, Prev. RBC",
    image: "/images/mentors/edwin_ngui.webp",
    tags: ["Front-End", "UI/UX", "Product Management"],
  },
  {
    name: "Hugo Ngo",
    desc: "Computer Systems Intern @ Veralto - Trojan Technologies",
    image: "/images/mentors/hugo_ngo.webp",
    tags: ["Back-End", "Hardware", "Data & AI"],
  },
  {
    name: "Jacob Ender",
    desc: "Quantitative Analyst @ Generation",
    image: "/images/mentors/jacob_ender.webp",
    tags: ["Back-End", "Data & AI"],
  },
  {
    name: "Jack Branston",
    desc: "Software Engineering Intern @ Scotiabank",
    image: "/images/mentors/jack_branston.webp",
    tags: ["Front-End", "Back-End", "DevOps & Cloud", "Data & AI"],
  },
  {
    name: "Janik",
    desc: "Software + Hardware Engineer",
    image: "/images/mentors/janik.webp",
    tags: ["Hardware", "Data & AI"],
  },
  {
    name: "Jasleen Bakshi",
    desc: "Hack Western Mentor | Full-Stack & AI/ML",
    image: "/images/mentors/jasleen_bakshi.webp",
    tags: ["Front-End", "Back-End", "UI/UX", "Data & AI"],
  },
  {
    name: "Jimmy Liu",
    desc: "Software Engineering @ UWaterloo",
    image: "/images/mentors/jimmy_liu.webp",
    tags: ["Front-End", "Back-End", "DevOps & Cloud"],
  },
  {
    name: "Lecia Cheng",
    desc: "Solutions Engineer Intern @ AWS",
    image: "/images/mentors/lecia_cheng.webp",
    tags: ["Front-End", "UI/UX", "DevOps & Cloud"],
  },
  {
    name: "Leon Zhu",
    desc: "Software Engineer @ Veris",
    image: "/images/mentors/leon_zhu.webp",
    tags: ["Front-End", "UI/UX", "Product Management", "Data & AI"],
  },
  {
    name: "Nicholas Lam",
    desc: "SWE @ Gather AI",
    image: "/images/mentors/nicholas_lam.webp",
    tags: [
      "Front-End",
      "Back-End",
      "Mobile Development",
      "DevOps & Cloud",
      "Data & AI"
    ],
  },
  {
    name: "Oscar Yu",
    desc: "SWE @ Clearpool Group",
    image: "/images/mentors/oscar_yu.webp",
    tags: ["Front-End", "Back-End"],
  },
];
