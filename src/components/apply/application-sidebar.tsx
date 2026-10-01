import * as React from "react";
import { cn } from "~/lib/utils";
import { HWLogo } from "./hw-logo";

export type SidebarStep = {
  key: string;
  label: string;
};

export interface ApplicationSidebarProps {
  steps: readonly SidebarStep[];
  activeStep?: string | null;
  lastSavedAt?: Date | null;
  onStepClick?: (key: string) => void;
  className?: string;
}

function formatSavedTime(date: Date) {
  return date
    .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
}

/**
 * Renders the formatted saved time only after mount. toLocaleTimeString varies
 * with the runtime's locale + timezone, so rendering it during SSR causes a
 * hydration mismatch when the client's locale differs from the server's.
 */
function useSavedTimeLabel(date: Date | null | undefined): string | null {
  const [label, setLabel] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!date) {
      setLabel(null);
      return;
    }
    setLabel(formatSavedTime(date));
  }, [date]);
  return label;
}

export function ApplicationSidebar({
  steps,
  activeStep,
  lastSavedAt,
  onStepClick,
  className,
}: ApplicationSidebarProps) {
  const savedLabel = useSavedTimeLabel(lastSavedAt);
  return (
    <aside
      className={cn(
        "flex h-full w-[267px] flex-col justify-between rounded-[12px] border border-white/25 bg-white/70 px-3 py-6 shadow-[0px_8.65px_10.81px_6.49px_rgba(0,0,0,0.05)] backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-9">
        <div className="px-3">
          <HWLogo className="h-[45px] w-[30px]" />
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1 px-[14px]">
            <p className="font-figtree text-md-p font-bold text-heavy">
              Application Portal
            </p>
            <p className="font-figtree text-sm-p font-medium text-medium">
              Hack Western 13
            </p>
          </div>

          <nav className="flex flex-col gap-1.5">
            {steps.map((step) => {
              const isActive = step.key === activeStep;
              const Element = onStepClick ? "button" : "div";
              return (
                <Element
                  key={step.key}
                  type={onStepClick ? "button" : undefined}
                  onClick={
                    onStepClick ? () => onStepClick(step.key) : undefined
                  }
                  className={cn(
                    "flex items-center justify-between overflow-hidden rounded-md px-[14px] py-3 text-left font-figtree text-md-p transition-colors",
                    isActive
                      ? "bg-highlight font-semibold text-heavy"
                      : "font-medium text-medium hover:bg-highlight/40",
                    onStepClick && "cursor-pointer",
                  )}
                >
                  <span className="whitespace-nowrap">{step.label}</span>
                </Element>
              );
            })}
          </nav>
        </div>
      </div>

      {lastSavedAt && (
        <div className="flex items-center justify-center px-[14px]">
          <p
            suppressHydrationWarning
            className="whitespace-nowrap font-figtree text-md-p font-medium italic text-medium"
          >
            {savedLabel ? `Last saved ${savedLabel}` : " "}
          </p>
        </div>
      )}
    </aside>
  );
}
