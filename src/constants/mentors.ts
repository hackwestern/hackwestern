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
  },
  {
    // UNVERIFIED: not in this year's sheet, tags/skills are from last year
    name: "Lecia Cheng",
    skills: ["Front-End", "Cloud"],
    tags: ["Software Engineering", "Design"],
    image: "/landing/mentors/lecia_cheng.webp",
    linkedin: "https://www.linkedin.com/in/lecia-cheng/",
  },
  // New this year
  {
    name: "Ariston Michael",
    skills: ["C#", "Python", "Cloud", ".NET", "Unity"],
    tags: ["Software Engineering", "Design", "AI", "Hardware"],
    image: "/landing/mentors/aristonm.webp",
    linkedin: "https://www.linkedin.com/in/ariston-michael/",
  },
  {
    name: "Aiden (Arman) Alaei",
    skills: ["Python", "Machine learning", "C#", "REST APIs"],
    tags: ["Software Engineering", "Product Management", "AI"],
  },
  {
    name: "Isteyak Isteyak",
    skills: ["Computer vision", "C++", "CUDA", "FastAPI", "MERN"],
    tags: ["Software Engineering", "Product Management", "AI"],
    image: "/landing/mentors/isteyak.webp",
    linkedin: "https://www.linkedin.com/in/isteyak/",
  },
  {
    name: "Ramus Hu",
    skills: ["Python", "TypeScript", "Flutter", "Pitching", "CTF"],
    tags: ["Software Engineering", "Product Management", "AI"],
  },
  {
    name: "Keerthana Bhukya",
    skills: ["LLMs & RAG", "Python", "Next.js", "FastAPI", "AWS"],
    tags: ["Software Engineering", "Product Management", "AI"],
  },
  {
    name: "Shivansh Kushwaha",
    skills: ["Java", "TypeScript", "React", "Startups"],
    tags: ["Software Engineering", "Product Management", "Design", "AI"],
    image: "/landing/mentors/shivanshk.webp",
    linkedin: "https://www.linkedin.com/in/shivkushwaha/",
  },
  {
    name: "Eric Liu",
    skills: ["Real-time backends", "TypeScript", "AI agents", "WebSockets"],
    tags: ["Software Engineering", "AI"],
  },
  {
    // UNVERIFIED: very short answers
    name: "Nelson Zhou",
    skills: ["Python", "Customer discovery"],
    tags: ["Design"],
    image: "/landing/mentors/nelsonz.webp",
    linkedin: "https://www.linkedin.com/in/nelson-zhou/",
  },
  {
    // UNVERIFIED: every free-text answer was just "a", skills left empty
    name: "Evan Yang",
    skills: [],
    tags: ["Software Engineering", "Product Management", "Design", "AI"],
    image: "/landing/mentors/evany.webp",
    linkedin: "https://www.linkedin.com/in/evanzyang/",
  },
  {
    name: "Mohamed Toman",
    skills: ["Full-stack", "React", "Python", "Cloud", "Databases"],
    tags: ["Software Engineering"],
    linkedin: "https://www.linkedin.com/in/hadytoman/",
  },
  {
    name: "Aleks Bursac",
    skills: ["Product sense", "Next.js", "React Native", "Figma", "Demos"],
    tags: ["Software Engineering", "Product Management", "Design"],
    image: "/landing/mentors/aleksb.webp",
    linkedin: "https://www.linkedin.com/in/aleksbrsc/",
  },
  {
    name: "Khushal Mehta",
    skills: ["AI & LLMs", "Python", "Project management", "Startups"],
    tags: ["Software Engineering", "Product Management", "Design", "AI"],
    image: "/landing/mentors/khushalm.webp",
    linkedin: "https://www.linkedin.com/in/khushal-mehta/",
  },
  {
    name: "William Liu",
    skills: ["Project scoping", "Debugging", "Design", "Figma"],
    tags: ["Software Engineering", "Product Management", "Design"],
    image: "/landing/mentors/williaml.webp",
    linkedin: "https://www.linkedin.com/in/liuwllm/",
  },
  {
    name: "Jaemin Han",
    skills: ["ML engineering", "Python", "PyTorch", "Pitching"],
    tags: ["Software Engineering", "AI"],
    image: "/landing/mentors/jaeminh.webp",
  },
  {
    name: "Anmol Kumari",
    skills: ["Python", "Data & AI", "FastAPI", "Agents", "Azure"],
    tags: ["Software Engineering", "AI"],
  },
  {
    name: "Alan Lu",
    skills: ["Node.js", "React", "TypeScript", "MongoDB"],
    tags: ["Software Engineering"],
    image: "/landing/mentors/alanl.webp",
    linkedin: "https://www.linkedin.com/in/lu-alan/",
  },
  {
    name: "Rafay Kashif",
    skills: ["C++", "Linux & QNX", "Vulkan", "Rust"],
    tags: ["Software Engineering", "Embedded & Systems"],
    image: "/landing/mentors/rafayk.webp",
    linkedin: "https://www.linkedin.com/in/rafaykashif/",
  },
  {
    name: "David Liu",
    skills: ["Next.js", "TypeScript", "Python", "AI & RAG", "ESP32"],
    tags: ["Software Engineering", "Design", "AI"],
    image: "/landing/mentors/davidliu.webp",
    linkedin: "https://www.linkedin.com/in/davidmakesmoves/",
  },
  {
    name: "Ali",
    skills: ["C++", "Python", "Swift", "OpenCV", "Arduino"],
    tags: ["Software Engineering", "Design", "Hardware", "AI"],
  },
  {
    name: "Vidhi Kalal",
    skills: ["Python", "SQL", "Next.js", "Cloud", "Gen AI"],
    tags: ["Software Engineering", "AI"],
    image: "/landing/mentors/vidhik.webp",
    linkedin: "https://www.linkedin.com/in/vidhi-kalal/",
  },
  {
    name: "Mohammad Hammad",
    skills: ["Python", "Java", "JavaScript", "Unity"],
    tags: ["Software Engineering"],
    image: "/landing/mentors/mohammadh.webp",
    linkedin: "https://www.linkedin.com/in/mohammad-b-hammad/",
  },
  {
    name: "Maxim Skubitsky",
    skills: ["Product thinking", "Figma", "Case competitions", "Pitching"],
    tags: ["Product Management", "Design"],
    linkedin: "https://www.linkedin.com/in/maxim-skubitsky/",
  },
];
