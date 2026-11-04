import { focusRing } from "~/components/judging/judge-ui";

export const PUBLIC_JUDGE_TABS = [
  { id: "next", label: "Next" },
  { id: "score", label: "Score" },
  { id: "teams", label: "My teams" },
  { id: "map", label: "Map" },
] as const;

export type PublicJudgeTab = (typeof PUBLIC_JUDGE_TABS)[number]["id"];

interface PublicJudgeNavProps {
  active: PublicJudgeTab;
  onChange: (tab: PublicJudgeTab) => void;
}

/** Bottom tab bar. Sticks to the bottom of the phone screen. */
export function PublicJudgeNav({ active, onChange }: PublicJudgeNavProps) {
  return (
    <nav
      aria-label="Judging sections"
      className="sticky bottom-0 border-t border-[#d6dbe5] bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="m-0 grid list-none grid-cols-4 p-0">
        {PUBLIC_JUDGE_TABS.map((tab) => {
          const on = active === tab.id;
          return (
            <li key={tab.id}>
              <button
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => onChange(tab.id)}
                className={`flex min-h-[56px] w-full items-center justify-center border-t-[3px] text-[15px] ${
                  on
                    ? "border-[#5b3fa0] font-bold text-[#0b2238]"
                    : "border-transparent font-medium text-[#4a5d73]"
                } ${focusRing}`}
              >
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}