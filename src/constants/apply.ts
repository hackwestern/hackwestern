type Step = {
  step: string;
  label: string;
  heading: string;
  subheading: string | null;
};

const allSteps = [
  {
    step: "realm",
    label: "Realm",
    heading: "Click to choose your horse companion",
    subheading: "Who will accompany you along this adventure?",
  },
  {
    step: "companion",
    label: "Companion",
    heading: "Name your horse companion",
    subheading: "Give your new friend a first and last name.",
  },
  {
    step: "basics",
    label: "Basics",
    heading: "Let's start with the basics",
    subheading: null,
  },
  {
    step: "info",
    label: "Info",
    heading: "A little bit more info about you...",
    subheading: null,
  },
  {
    step: "application",
    label: "Application",
    heading: "Tell us your story",
    subheading: null,
  },
  {
    step: "links",
    label: "Links",
    heading: "Where can we find you?",
    subheading:
      "Devpost, GitHub, LinkedIn and your resume are required. A portfolio is optional, so show it off if you have one!",
  },
  {
    step: "agreements",
    label: "Agreements",
    heading: "Agreements",
    subheading: "Our hackers must agree to the following agreements:",
  },
  {
    step: "optional",
    label: "Optional Questions",
    heading: "Optional Questions",
    subheading:
      "The next few questions are completely optional and will not be used in any way during your application review process; it will not affect your candidacy positively or negatively. It will only be accessed as a pool to help focus our future outreach to ensure equal access to opportunities for everyone.",
  },
  {
    step: "logistics",
    label: "Logistics",
    heading: "Logistics & emergency contact",
    subheading: "We need these details for event day.",
  },
  {
    step: "review",
    label: "Review",
    heading: "Review Your Application",
    subheading: "You won't be able to change it after it's submitted!",
  },
] as const satisfies Step[];

// Desktop includes all steps
export const applySteps = allSteps;

export type ApplyStepFull = (typeof applySteps)[number];
export type ApplyStep = (typeof applySteps)[number]["step"];
