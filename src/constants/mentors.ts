// Mentor focus areas, taken from the sign-up sheet's "areas you can help with".
export const MentorTagsList = [
  "Software Engineering",
  "AI",
  "Design",
  "Product Management",
  "Hardware",
  "Embedded & Systems",
] as const;

export type MentorTags = (typeof MentorTagsList)[number];

export type Mentor = {
  name: string;
  // A few things they're strongest at (shown on the card).
  // UNVERIFIED: shortened by hand from each mentor's "skills" answer.
  skills: string[];
  tags: MentorTags[];
  // Last year's mentors have these. We'll collect them for everyone else later.
  image?: string;
  linkedin?: string; // clicking the card opens this
  // Link for "Message on Slack" (e.g. a Slack profile/DM link). The button
  // stays disabled until this is set.
  slack?: string;
};

export const MentorsList: Mentor[] = [
  // Carried over from last year's group (keep their photo + LinkedIn)
  {
    name: "Edwin Ngui",
    skills: ["React", "TypeScript", "Generative AI", "AI agents", "Demos"],
    tags: ["Software Engineering", "Product Management", "Design", "AI"],
    image: "/landing/mentors/edwin_ngui.webp",
    linkedin: "https://www.linkedin.com/in/edwin-ngui/",
    slack:
      "https://slack.com/app_redirect?channel=U0CJHMNQ0RK&team=T0CD393939Q",
  },
  {
    // UNVERIFIED: not in this year's sheet, tags/skills are from last year
    name: "Lecia Cheng",
    skills: ["Front-End", "Cloud"],
    tags: ["Software Engineering", "Design"],
    image: "/landing/mentors/lecia_cheng.webp",
    linkedin: "https://www.linkedin.com/in/lecia-cheng/",
    slack:
      "https://slack.com/app_redirect?channel=U0CJVAVFW3F&team=T0CD393939Q",
  },
  // New this year
  {
    name: "Aiden (Arman) Alaei",
    skills: ["Python", "Machine learning", "C#", "REST APIs"],
    tags: ["Software Engineering", "Product Management", "AI"],
    image: "/landing/mentors/aidena.webp",
    slack:
      "https://slack.com/app_redirect?channel=U0CJNQWPZQS&team=T0CD393939Q",
  },
  {
    name: "Shivansh Kushwaha",
    skills: ["Java", "TypeScript", "React", "Startups"],
    tags: ["Software Engineering", "Product Management", "Design", "AI"],
    image: "/landing/mentors/shivanshk.webp",
    linkedin: "https://www.linkedin.com/in/shivkushwaha/",
    slack:
      "https://slack.com/app_redirect?channel=U0CJDU8AWEQ&team=T0CD393939Q",
  },
  {
    name: "Mohamed Toman",
    skills: ["Full-stack", "React", "Python", "Cloud", "Databases"],
    tags: ["Software Engineering"],
    linkedin: "https://www.linkedin.com/in/hadytoman/",
    slack:
      "https://slack.com/app_redirect?channel=U0CJQT97ATT&team=T0CD393939Q",
  },
  {
    name: "Aleks Bursac",
    skills: ["Product sense", "Next.js", "React Native", "Figma", "Demos"],
    tags: ["Software Engineering", "Product Management", "Design"],
    image: "/landing/mentors/aleksb.webp",
    linkedin: "https://www.linkedin.com/in/aleksbrsc/",
    slack:
      "https://slack.com/app_redirect?channel=U0CHUR8TSDD&team=T0CD393939Q",
  },
  {
    name: "William Liu",
    skills: ["Project scoping", "Debugging", "Design", "Figma"],
    tags: ["Software Engineering", "Product Management", "Design"],
    image: "/landing/mentors/williaml.webp",
    linkedin: "https://www.linkedin.com/in/liuwllm/",
    slack:
      "https://slack.com/app_redirect?channel=U0CJSMGJ3EY&team=T0CD393939Q",
  },
  {
    name: "Jaemin Han",
    skills: ["ML engineering", "Python", "PyTorch", "Pitching"],
    tags: ["Software Engineering", "AI"],
    linkedin: "https://www.linkedin.com/in/hanjaemin/",
    image: "/landing/mentors/jaeminh.webp",
    slack:
      "https://slack.com/app_redirect?channel=U0CHUSENRF1&team=T0CD393939Q",
  },
  {
    name: "Rafay Kashif",
    skills: ["C++", "Linux & QNX", "Vulkan", "Rust"],
    tags: ["Software Engineering", "Embedded & Systems"],
    image: "/landing/mentors/rafayk.webp",
    linkedin: "https://www.linkedin.com/in/rafaykashif/",
    slack:
      "https://slack.com/app_redirect?channel=U0CJE5UCQ6Q&team=T0CD393939Q",
  },
  {
    name: "David Liu",
    skills: ["Next.js", "TypeScript", "Python", "AI & RAG", "ESP32"],
    tags: ["Software Engineering", "Design", "AI"],
    image: "/landing/mentors/davidliu.webp",
    linkedin: "https://www.linkedin.com/in/davidmakesmoves/",
    slack:
      "https://slack.com/app_redirect?channel=U0CKC7ZB22U&team=T0CD393939Q",
  },
  {
    name: "Ali Mohammed-Ali",
    skills: ["C++", "Python", "Swift", "OpenCV", "Arduino"],
    tags: ["Software Engineering", "Design", "Hardware", "AI"],
    image: "/landing/mentors/alim.webp",
    linkedin: "https://www.linkedin.com/in/am-uwo/",
    slack:
      "https://slack.com/app_redirect?channel=U0CJGPV815H&team=T0CD393939Q",
  },
  {
    name: "Ian Korovinsky",
    skills: ["Backend", "ML infrastructure", "Product", "Hackathon strategy"],
    tags: ["Software Engineering", "AI", "Product Management"],
    image: "/landing/mentors/iank.webp",
    linkedin: "https://www.linkedin.com/in/ian-korovinsky/",
    slack:
      "https://slack.com/app_redirect?channel=U0CJ72GK8V7&team=T0CD393939Q",
  },
  {
    name: "Luke Blommesteyn",
    skills: ["Machine learning", "Computer vision", "LLMs", "Data"],
    tags: ["Software Engineering", "AI"],
    image: "/landing/mentors/lukeb.webp",
    linkedin: "https://www.linkedin.com/in/lblommesteyn/",
    slack:
      "https://slack.com/app_redirect?channel=U0CKHGRGLP2&team=T0CD393939Q",
  },
  {
    name: "Lukas Bozinov",
    skills: ["AI agents", "Python", "CI/CD", "Hardware testing"],
    tags: ["Software Engineering", "AI", "Embedded & Systems"],
    image: "/landing/mentors/lukasb.webp",
    linkedin: "https://www.linkedin.com/in/lukasbozinov/",
    slack:
      "https://slack.com/app_redirect?channel=U0CJSMLB1PE&team=T0CD393939Q",
  },
  {
    name: "Shaun Ahuja",
    skills: ["Backend", "Infrastructure", "Full-stack", "Startups"],
    tags: ["Software Engineering"],
    image: "/landing/mentors/shauna.webp",
    linkedin: "https://www.linkedin.com/in/shaun-ahuja/",
    slack:
      "https://slack.com/app_redirect?channel=U0CHPJ2QWMD&team=T0CD393939Q",
  },
  {
    name: "Viraj Patel",
    skills: ["Product management", "AI products", "Startups", "Pitching"],
    tags: ["Product Management", "AI"],
    image: "/landing/mentors/virajp.webp",
    linkedin: "https://www.linkedin.com/in/virajpatell/",
    slack:
      "https://slack.com/app_redirect?channel=U0CJ41J2LLT&team=T0CD393939Q",
  },
];
