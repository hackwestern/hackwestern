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
  image: string;
  tags: MentorTags[];
};

export const MentorsList: Mentor[] = [
  {
    name: "Maaz Siddiqi",
    desc: "Software Engineering @ RBC",
    image: "/images/mentors/maaz_siddiqi.webp",
    tags: ["Front-End"],
  },
  {
    name: "John Edgar",
    desc: "Retired Founder - Happy to help!",
    image: "/images/mentors/john_edgar.webp",
    tags: ["DevOps & Cloud", "Product Management"],
  },
  {
    name: "Grace Gong",
    desc: "PM Intern @ Microsoft",
    image: "/images/mentors/grace_gong.webp",
    tags: ["Product Management", "UI/UX", "Front-End"],
  },
  {
    name: "David Tran",
    desc: "Quantitative Research Engineer @ Citadel",
    image: "/images/mentors/david_tran.webp",
    tags: ["Data & AI", "Back-End"],
  },
  {
    name: "Bilal Aamer",
    desc: "Sr ML Engineer @ BNY, Community Manager @ TensorFlow",
    image: "/images/mentors/bilal_aamer.webp",
    tags: ["Data & AI"],
  },
  {
    name: "Charlotte Lemon",
    desc: "Product Design Intern @ Intuit",
    image: "/images/mentors/charlotte_lemon.webp",
    tags: ["Product Design"],
  },
  {
    name: "Jerry Di",
    desc: "Creative Director @ Halation, ex-PM @Talent Protocol",
    image: "/images/mentors/jerry_di.webp",
    tags: ["Product Design", "UI/UX"],
  },
  {
    name: "Zohaib Adnan",
    desc: "Entrepreneur @ NEXT 36",
    image: "/images/mentors/zohaib_adnan.webp",
    tags: ["Product Management", "UI/UX"],
  },
  {
    name: "Ansel Zeng",
    desc: "Ex-SWE @ Hack Western",
    image: "/images/mentors/ansel_zeng.webp",
    tags: ["Front-End", "UI/UX"],
  },
  {
    name: "David George",
    desc: "iOS Software Engineer @ Mark43",
    image: "/images/mentors/david_george.webp",
    tags: ["Mobile Development", "Front-End", "Back-End"],
  },
  {
    name: "Isabelle Gan",
    desc: "Prev. Tech Consulting @ SAP and VC @ Ripple Ventures",
    image: "/images/mentors/isabelle_gan.webp",
    tags: ["UI/UX", "Product Management"],
  },
  {
    name: "Jarod Schmidt",
    desc: "Integrations Engineer @ Geotab",
    image: "/images/mentors/jarod_schmidt.webp",
    tags: ["Back-End", "DevOps & Cloud"],
  },
  {
    name: "Zaeem Ajwad",
    desc: "Software Engineer Intern @ Unilever",
    image: "/images/mentors/zaeem_ajwad.webp",
    tags: ["Data & AI"],
  },
  {
    name: "Abdul Alsherazi",
    desc: "Embedded Developer @ Geotab",
    image: "/images/mentors/abdul_alsherazi.webp",
    tags: ["Hardware"],
  },
  {
    name: "Victor Awogbemi",
    desc: "Ex Software Engineer Intern @ Stripe",
    image: "/images/mentors/victor_awogbemi.webp",
    tags: ["Front-End", "Back-End"],
  },
  {
    name: "Justin Tsang",
    desc: "SDE Intern @ Amazon",
    image: "/images/mentors/justin_tsang_2.webp",
    tags: ["Front-End", "Back-End"],
  },
  {
    name: "Rena Li",
    desc: "Software Engineer Intern at Intuit",
    image: "/images/mentors/rena_li.webp",
    tags: ["Front-End", "UI/UX"],
  },
  {
    name: "Jason Li",
    desc: "Software Engineer Intern @ StackAdapt",
    image: "/images/mentors/jason_li.webp",
    tags: ["Back-End", "Front-End"],
  },
  {
    name: "Waqas Rana",
    desc: "Event Coordinator Lead @ GDSC / (Google Developer Student Club)",
    image: "/images/mentors/waqas_rana.webp",
    tags: ["Back-End", "DevOps & Cloud"],
  },
  {
    name: "Josh Fernando",
    desc: "23x Hackathon Winner",
    image: "/images/mentors/josh_fernando.webp",
    tags: ["Back-End", "Data & AI", "DevOps & Cloud", "Front-End"],
  },
];
