import { focusRing } from "~/components/judging/shared/judge-ui";

export const JUDGE_TABS = [
  { id: "next", label: "Next" },
  { id: "score", label: "Score" },
  { id: "teams", label: "My teams" },
  { id: "map", label: "Map" },
] as const;

export type JudgeTab = (typeof JUDGE_TABS)[number]["id"];

interface JudgeNavProps {
  active: JudgeTab;
  onChange: (tab: JudgeTab) => void;
  /** Tabs that can't be opened yet, e.g. Score until a team is chosen. */
  disabled?: JudgeTab[];
}

/** Bottom tab bar. Sticks to the bottom of the phone screen. */
export function JudgeNav({ active, onChange, disabled = [] }: JudgeNavProps) {
  const activeIndex = JUDGE_TABS.findIndex((tab) => tab.id === active);

  return (
    <nav
      aria-label="Judging sections"
      className="sticky bottom-0 border-t border-dashboard-border-default bg-dashboard-bg-nav pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative">
        {/* One highlight that slides to whichever tab is open. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/4 border-t-[3px] border-dashboard-action-primary bg-dashboard-bg-navSelected transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        />
        <ul className="relative m-0 grid list-none grid-cols-4 p-0">
          {JUDGE_TABS.map((tab) => {
            const on = active === tab.id;
            const locked = disabled.includes(tab.id);
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  disabled={locked}
                  aria-current={on ? "page" : undefined}
                  onClick={() => onChange(tab.id)}
                  className={`flex min-h-14 w-full items-center justify-center border-t-[3px] border-transparent text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none ${
                    locked
                      ? "cursor-not-allowed text-dashboard-text-disabled"
                      : on
                        ? "cursor-pixel-hover text-dashboard-text-active"
                        : "cursor-pixel-hover text-dashboard-text-light hover:bg-dashboard-bg-navSelected/40"
                  } ${focusRing}`}
                >
                  {tab.label}
                  {locked && (
                    <span className="sr-only"> (choose a team to judge first)</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}