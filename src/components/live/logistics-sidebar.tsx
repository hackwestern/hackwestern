import { LogisticsLink } from "./navlinks";
import { logisticsSteps } from "~/constants/event-logistics";

// "Overview" card beside the event logistics pages (Figma 1:3589)
export const LogisticsSidebar = () => {
  return (
    <aside className="hidden h-fit w-[255px] shrink-0 flex-col gap-3 rounded-[20px] border border-dashboard-bg-surface bg-dashboard-bg-surface px-4 pb-3 pt-6 font-figtree shadow-dashboard-card md:flex">
      <h2 className="text-base font-semibold uppercase leading-default tracking-[-0.02em] text-dashboard-text-heavy">
        Overview
      </h2>
      <nav className="flex flex-col">
        {logisticsSteps.map((s, i) => (
          <LogisticsLink key={s.slug} step={i + 1} />
        ))}
      </nav>
    </aside>
  );
};
