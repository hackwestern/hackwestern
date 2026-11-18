import { focusRing } from "~/components/judging/shared/judge-ui";

export const JUDGE_TABS = [
  { id: "next", label: "Next" },
  { id: "questions", label: "Questions" },
  // Score sits in the middle, the easiest tab to reach with a thumb.
  { id: "score", label: "Score" },
  { id: "teams", label: "My teams" },
  { id: "map", label: "Map" },
] as const;

export type JudgeTab = (typeof JUDGE_TABS)[number]["id"];

interface JudgeNavProps {
  active: JudgeTab;
  onChange: (tab: JudgeTab) => void;
  /** Tabs that can't be opened yet, with why (read out to screen readers). */
  disabled?: Partial<Record<JudgeTab, string>>;
  /** Tab names that change with the stage, e.g. My teams becomes Submit. */
  labels?: Partial<Record<JudgeTab, string>>;
}

/** Bottom tab bar. Sticks to the bottom of the phone screen. */
export function JudgeNav({
  active,
  onChange,
  disabled = {},
  labels = {},
}: JudgeNavProps) {
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
          className="pointer-events-none absolute inset-y-0 left-0 border-t-[3px] border-dashboard-action-primary bg-dashboard-bg-navSelected transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: `${100 / JUDGE_TABS.length}%`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
        <ul
          className="relative m-0 grid list-none p-0"
          style={{
            gridTemplateColumns: `repeat(${JUDGE_TABS.length}, minmax(0, 1fr))`,
          }}
        >
          {JUDGE_TABS.map((tab) => {
            const on = active === tab.id;
            const reason = disabled[tab.id];
            const locked = reason !== undefined;
            return (
              <li key={tab.id}>
                <button
                  type="button"
                  disabled={locked}
                  aria-current={on ? "page" : undefined}
                  onClick={() => onChange(tab.id)}
                  className={`flex min-h-14 w-full items-center justify-center border-t-[3px] border-transparent px-0.5 text-center text-[13px] font-semibold leading-tight transition-colors duration-200 motion-reduce:transition-none min-[400px]:text-sm ${
                    locked
                      ? "cursor-not-allowed text-dashboard-text-disabled"
                      : on
                        ? "cursor-pixel-hover text-dashboard-text-active"
                        : "cursor-pixel-hover text-dashboard-text-light hover:bg-dashboard-bg-navSelected/40"
                  } ${focusRing}`}
                >
                  {labels[tab.id] ?? tab.label}
                  {locked && <span className="sr-only"> ({reason})</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
