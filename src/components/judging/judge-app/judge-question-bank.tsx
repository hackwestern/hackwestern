import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { card, focusRing } from "~/components/judging/shared/judge-ui";

interface QuestionGroup {
  title: string;
  questions: string[];
}

// Starter questions. Grouped to match the
// rubric criteria, plus a general group to open with.
const QUESTION_BANK: QuestionGroup[] = [
  {
    title: "Getting started",
    questions: [
      "What problem are you solving, and for whom?",
      "Walk me through a quick demo.",
    ],
  },
  {
    title: "Innovation + Impact",
    questions: [
      "What makes this different from what already exists?",
      "Who would use this, and how would it change things for them?",
    ],
  },
  {
    title: "Creativity",
    questions: [
      "Where did the idea come from?",
      "What's the most unexpected thing you did to make it work?",
    ],
  },
  {
    title: "Technical Complexity",
    questions: [
      "What was the hardest part to build?",
      "How does the data move through your system?",
    ],
  },
  {
    title: "Design/Polish",
    questions: [
      "Who did you design this for?",
      "What would you polish with one more day?",
    ],
  },
  {
    title: "Adventurous",
    questions: [
      "What did you try this weekend that you'd never done before?",
      "What was the biggest risk you took, and did it pay off?",
    ],
  },
];

/**
 * The Questions tab: things a judge can ask the team, grouped by criterion.
 * It has its own tab so a judge can flip between it and the rubric while
 * scoring without losing anything. Every group starts open, and each one
 * can be closed on its own.
 */
export function JudgeQuestionBank() {
  const [open, setOpen] = useState<string[]>(() =>
    QUESTION_BANK.map((g) => g.title),
  );
  const toggle = (title: string) =>
    setOpen((o) =>
      o.includes(title) ? o.filter((t) => t !== title) : [...o, title],
    );

  return (
    <>
      <p className="m-0 px-1 text-sm font-medium text-dashboard-text-light">
        Questions you can ask the team. Your scores stay as you left them on the
        Score tab.
      </p>
      {QUESTION_BANK.map((group, i) => {
        const isOpen = open.includes(group.title);
        const panelId = `questions-${i}`;
        return (
          <section key={group.title} className={`${card} overflow-hidden`}>
            <h2 className="m-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(group.title)}
                className={`flex min-h-12 w-full cursor-pixel-hover items-center justify-between gap-3 px-4 text-left text-base font-semibold text-dashboard-text-heavy ${focusRing}`}
              >
                {group.title}
                <ChevronDown
                  aria-hidden="true"
                  className={`size-5 shrink-0 text-dashboard-text-light transition-transform motion-reduce:transition-none ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </h2>
            {isOpen && (
              <ul
                id={panelId}
                className="m-0 flex list-disc flex-col gap-1.5 border-t border-dashboard-border-subtle py-3 pl-9 pr-4"
              >
                {group.questions.map((q) => (
                  <li
                    key={q}
                    className="text-base font-medium leading-snug text-dashboard-text-heavy"
                  >
                    {q}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
