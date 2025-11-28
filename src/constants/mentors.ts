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
  linkedin?: string;
};

export const MentorsList: Mentor[] = [
  {
    // 1. Arsalaan Ali
    name: "Arsalaan Ali",
    desc: "Incoming Software Engineer Intern @ Tesla, Ex - Hack Western, Twilio",
    image: "/images/mentors/arsalaan_ali.webp",
    tags: ["Front-End", "Back-End"],
    linkedin: "https://www.linkedin.com/in/arsalaanalics/",
  },
  {
    // 2. Bonnie Qiu
    name: "Bonnie Qiu",
    desc: "Product Manager, UI/UX Design",
    image: "/images/mentors/bonnie_qiu.webp",
    tags: ["UI/UX", "Product Management"],
    linkedin: "https://www.linkedin.com/in/bonnie-qiu-413931268/",
  },
  {
    // 3. Cedric Leung
    name: "Cedric Leung",
    desc: "Full stack/ Generalist",
    image: "/images/mentors/cedric_leung.webp",
    tags: [
      "Front-End",
      "Back-End",
      "UI/UX",
      "Mobile Development",
      "DevOps & Cloud",
      "Data & AI",
    ],
    linkedin: "https://www.linkedin.com/in/cedric-leung-93273a255/",
  },
  {
    // 4. David George
    name: "David George",
    desc: "iOS Software Engineer @ Mark43",
    image: "/images/mentors/david_george.webp",
    tags: ["Mobile Development", "Front-End", "Back-End"],
    linkedin: "https://www.linkedin.com/in/davidgeorge0/",
  },
  {
    // 5. Edwin Ngui
    name: "Edwin Ngui",
    desc: "SWE Intern @ NRC, Prev. RBC",
    image: "/images/mentors/edwin_ngui.webp",
    tags: ["Front-End", "UI/UX", "Product Management"],
    linkedin: "https://www.linkedin.com/in/edwin-ngui/",
  },
  {
    // 6. Hammed Afenifere
    name: "Hammed Afenifere",
    desc: "CEO of Oneremit",
    image: "/images/mentors/afenifere_hammed_adewumi.webp",
    tags: ["Product Management"],
    linkedin: "https://www.linkedin.com/in/hammed-adewumi-afenifere-2169a5116/",
  },
  {
    // 7. Jack Branston
    name: "Jack Branston",
    desc: "Software Engineering Intern @ Scotiabank",
    image: "/images/mentors/jack_branston.webp",
    tags: ["Front-End", "Back-End", "DevOps & Cloud", "Data & AI"],
    linkedin: "https://www.linkedin.com/in/jack-branston/",
  },
  {
    // 8. Janik
    name: "Janik",
    desc: "Software + Hardware Engineer",
    image: "/images/mentors/janik.webp",
    tags: ["Hardware", "Data & AI"],
    linkedin: "https://www.linkedin.com/in/thejanik/",
  },
  {
    // 9. Jasleen Bakshi
    name: "Jasleen Bakshi",
    desc: "Hack Western Mentor | Full-Stack & AI/ML",
    image: "/images/mentors/jasleen_bakshi.webp",
    tags: ["Front-End", "Back-End", "UI/UX", "Data & AI"],
    linkedin: "https://www.linkedin.com/in/jasleen-bakshi-927a83231/",
  },
  {
    // 10. Lecia Cheng
    name: "Lecia Cheng",
    desc: "Solutions Engineer Intern @ AWS",
    image: "/images/mentors/lecia_cheng.webp",
    tags: ["Front-End", "UI/UX", "DevOps & Cloud"],
    linkedin: "https://www.linkedin.com/in/lecia-cheng/",
  },
  {
    // 11. Leon Zhu
    name: "Leon Zhu",
    desc: "Software Engineer @ Veris",
    image: "/images/mentors/leon_zhu.webp",
    tags: ["Front-End", "UI/UX", "Product Management", "Data & AI"],
    linkedin: "https://www.linkedin.com/in/leon-zhu/",
  },
  {
    // 12. Nicholas Lam
    name: "Nicholas Lam",
    desc: "SWE @ Gather AI",
    image: "/images/mentors/nicholas_lam.webp",
    tags: [
      "Front-End",
      "Back-End",
      "Mobile Development",
      "DevOps & Cloud",
      "Data & AI",
    ],
    linkedin: "https://www.linkedin.com/in/n-a-lam/",
  },
  {
    // 13. Oscar Yu
    name: "Oscar Yu",
    desc: "SWE @ Clearpool Group",
    image: "/images/mentors/oscar_yu.webp",
    tags: ["Front-End", "Back-End"],
    linkedin: "https://www.linkedin.com/in/oscaryyu/",
  },
];
