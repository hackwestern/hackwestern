import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { card, focusRing } from "~/components/judging/shared/judge-ui";

interface QuestionGroup {
  title: string;
  questions: string[];
}

// Placeholder questions until the real bank is written. Grouped to match the
// rubric criteria, plus a general group to open with.
const QUESTION_BANK: QuestionGroup[] = [
  {
    title: "Getting started",
    questions: [
      "Placeholder: What problem are you solving, and for whom?",
      "Placeholder: Walk me through a quick demo.",
    ],
  },
  {
    title: "Innovation & Creativity",
    questions: [
      "Placeholder: What makes this different from what already exists?",
      "Placeholder: Where did the idea come from?",
    ],
  },
  {
    title: "Technical Complexity",
    questions: [
      "Placeholder: What was the hardest part to build?",
      "Placeholder: How does the data move through your system?",
    ],
  },
  {
    title: "Completeness",
    questions: [
      "Placeholder: What works end to end right now?",
      "Placeholder: What would you finish with one more day?",
    ],
  },
  {
    title: "Design",
    questions: [
      "Placeholder: Who did you design this for?",
      "Placeholder: What would you change after watching someone use it?",
    ],
  },
];

/**
 * Questions a judge can ask the team, shown on the same page as the rubric.
 * Closed by default so the sliders stay near the top.
 */
export function JudgeQuestionBank() {
  const [open, setOpen] = useState(false);

  return (
    <section aria-label="Question bank" className={`${card} overflow-hidden`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="judge-question-bank"
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-12 w-full cursor-pixel-hover items-center justify-between gap-3 px-3.5 text-left text-base font-semibold text-dashboard-text-heavy ${focusRing}`}
      >
        Question bank
        <ChevronDown
          aria-hidden="true"
          className={`size-5 text-dashboard-text-light transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div
          id="judge-question-bank"
          className="flex flex-col gap-3 border-t border-dashboard-border-subtle px-3.5 py-3"
        >
          {QUESTION_BANK.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <h2 className="m-0 text-sm font-semibold text-dashboard-text-light">
                {group.title}
              </h2>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5">
                {group.questions.map((q) => (
                  <li
                    key={q}
                    className="text-sm font-medium leading-snug text-dashboard-text-heavy"
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
