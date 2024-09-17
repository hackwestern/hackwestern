type Step = {
  step: string;
  label: string;
};

export const applySteps = [
  {
    step: "persona",
    label: "Persona",
  },
  {
    step: "basics",
    label: "Basics",
  },
  {
    step: "info",
    label: "Info",
  },
  {
    step: "application",
    label: "Application",
  },
  {
    step: "links",
    label: "Links",
  },
  {
    step: "agreements",
    label: "Agreements",
  },
  {
    step: "optional",
    label: "Optional Questions",
  },
  {
    step: "review",
    label: "Review",
  },
] as const satisfies Step[];

export type ApplyStep = (typeof applySteps)[number]["step"];
