type Step = {
  step: string;
  label: string;
  heading: string;
  subheading: string;
};

export const applySteps = [
  {
    step: "persona",
    label: "Persona",
    heading: "What kind of traveller are you?",
    subheading: "We all approach our vacations a little bit differently.",
  },
  {
    step: "basics",
    label: "Basics",
    heading: "Let’s start with the basics",
    subheading: "Tell us a little about yourself.",
  },
  {
    step: "info",
    label: "Info",
    heading: "Tell us more!",
    subheading: "Tell us a little about yourself.",
  },
  {
    step: "application",
    label: "Application",
    heading: "Application Questions",
    subheading: "",
  },
  {
    step: "links",
    label: "Links",
    heading: "Link us to your digital spaces!",
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
    step: "review",
    label: "Review",
    heading: "Review Your Application",
    subheading:
      "Review your entire application here and make it the best it can be!",
  },
] as const satisfies Step[];

export type ApplyStepFull = (typeof applySteps)[number];
export type ApplyStep = (typeof applySteps)[number]["step"];
