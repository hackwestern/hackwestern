type Step = {
  step: string;
  label: string;
  heading: string;
  subheading: string | null;
};

const allSteps = [
  {
    step: "character",
    label: "Character",
    heading: "Choose your character",
    subheading: null,
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
      "This is optional! Show off your cool stuff if you want us to see it.",
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
    step: "canvas",
    label: "Canvas",
    heading: "Lastly, draw something!",
    subheading: "This won't impact your application. Or will it?",
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

// Mobile excludes canvas step
export const mobileApplySteps = allSteps.filter(step => step.step !== "canvas");

export type ApplyStepFull = (typeof applySteps)[number];
export type ApplyStep = (typeof applySteps)[number]["step"];
