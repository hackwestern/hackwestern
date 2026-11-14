import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock, ExternalLink } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardCheckbox } from "~/components/internals/dashboard-checkbox";
import AddToWallet from "~/components/wallet/add-to-wallet";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";
import type { RecordedStepId, StepId } from "~/lib/onboarding";

export type ChecklistData = Extract<
  RouterOutputs["onboarding"]["get"],
  { eligible: true }
>;

// Copy and layout follow Figma "Onboarding v2" (live-site, node 58:2)
const COPY: Record<StepId, { title: string; description?: string }> = {
  accepted: { title: "Get accepted to Hack Western 13" },
  rsvp: {
    title: "RSVP to the event",
    description: "You must fill this out to attend as a hacker!",
  },
  slack: {
    title: "Join the Slack",
    description: "This is where all event communications will take place.",
  },
  devpost: {
    title: "Join the Devpost",
    description: "This is where you'll submit your project!",
  },
  wallet: {
    title: "Add your Hacker Pass to your wallet",
    description:
      "The QR code is your “ID” at Hack Western, so keep it easy to get to.",
  },
};

const HIDE_ANIMATION_MS = 500;

export function HackerChecklist({ data }: { data: ChecklistData }) {
  const utils = api.useUtils();
  const refresh = () => utils.onboarding.get.invalidate();

  const complete = api.onboarding.complete.useMutation({ onSuccess: refresh });
  const hide = api.onboarding.hide.useMutation({ onSuccess: refresh });
  const markDone = (step: RecordedStepId) => complete.mutate({ step });

  // "Hide checklist" shrinks the card into the top left, then saves it. The
  // save has to wait: it refetches and unmounts this card right away.
  const [leaving, setLeaving] = useState(false);
  const hideWithAnimation = () => {
    setLeaving(true);
    setTimeout(() => hide.mutate(), HIDE_ANIMATION_MS);
  };

  return (
    // The grid row collapses to 0 so what's below slides up; the negative
    // margin cancels the parent's gap once it has
    <div
      className={cn(
        "grid grid-rows-[1fr] transition-[grid-template-rows,margin] duration-500 ease-out motion-reduce:transition-none",
        leaving && "-mb-6 grid-rows-[0fr]",
      )}
    >
      <div className={cn("min-h-0", leaving && "overflow-hidden")}>
        <section
          className={cn(
            "origin-top-left transition-[transform,opacity] duration-500 ease-out motion-reduce:transition-none",
            leaving && "pointer-events-none scale-[0.1] opacity-0",
            "flex flex-col gap-1 rounded-[12px] border border-dashboard-border-card bg-dashboard-bg-surface p-5 font-figtree shadow-dashboard-card sm:p-8",
          )}
        >
          <div className="flex items-center justify-between gap-3 pb-3 font-semibold text-dashboard-text-heavy">
            <h2 className="text-2xl">Hacker Checklist</h2>
            <p className="text-base" aria-live="polite">
              {data.allDone
                ? "All done"
                : `${data.stepsLeft} step${data.stepsLeft === 1 ? "" : "s"} left`}
            </p>
          </div>

          <div className="flex gap-1.5 pb-2" aria-hidden="true">
            {data.steps.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "h-1.5 flex-1 rounded-[3px]",
                  s.done
                    ? "bg-dashboard-action-primary"
                    : "bg-dashboard-bg-nav",
                )}
              />
            ))}
          </div>

          {data.allDone ? (
            <>
              <div className="flex items-center gap-4 px-2 pb-2 pt-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-dashboard-action-primary text-dashboard-text-inverse">
                  <Check aria-hidden="true" className="size-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xl font-semibold text-dashboard-text-heavy">
                    You&apos;re all set for Hack Western 13
                  </p>
                  <p className="text-base text-dashboard-text-light">
                    See you on Nov 20.
                  </p>
                </div>
              </div>
              <div className="pl-[72px] pt-1">
                <button
                  type="button"
                  disabled={leaving}
                  onClick={hideWithAnimation}
                  className="cursor-pixel-hover text-base font-medium text-dashboard-action-primary hover:underline disabled:opacity-dashboard-disabled"
                >
                  Hide checklist
                </button>
              </div>
            </>
          ) : (
            <ul className="flex flex-col">
              {data.steps.map((step) => {
                const { title, description } = COPY[step.id];
                const isCurrent = step.id === data.currentId;

                // Done and later steps share one row layout, so every checkbox
                // lines up with the one in the current step's card.
                if (!isCurrent) {
                  return (
                    <li
                      key={step.id}
                      className={cn(
                        "flex items-center gap-3 py-[14px] pl-6 pr-5",
                        !step.done && "opacity-45",
                      )}
                    >
                      <DashboardCheckbox
                        checked={step.done}
                        tabIndex={-1}
                        aria-hidden="true"
                        className="pointer-events-none"
                      />
                      <span className="sr-only">
                        {step.done ? "Completed: " : "To do: "}
                      </span>
                      <span
                        className={cn(
                          "flex-1 text-base font-medium",
                          step.done
                            ? "text-dashboard-text-light"
                            : "text-dashboard-text-medium",
                        )}
                      >
                        {title}
                      </span>
                    </li>
                  );
                }

                return (
                  <li
                    key={step.id}
                    className="flex items-start gap-3 rounded-lg bg-dashboard-bg-checklistCurrent p-6"
                  >
                    <DashboardCheckbox
                      checked={false}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="pointer-events-none"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="sr-only">To do: </span>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-xl font-semibold text-dashboard-text-heavy">
                          {title}
                        </p>
                        {step.id === "rsvp" && data.rsvpDueInDays !== null && (
                          <p className="flex items-center gap-1.5 text-sm font-medium text-dashboard-text-warning">
                            <Clock aria-hidden="true" className="size-[15px]" />
                            Due in {data.rsvpDueInDays} day
                            {data.rsvpDueInDays === 1 ? "" : "s"}
                          </p>
                        )}
                      </div>
                      {description && (
                        <p className="text-base text-dashboard-text-medium">
                          {description}
                        </p>
                      )}
                      <div className="pt-[14px]">
                        <StepAction
                          id={step.id}
                          links={data.links}
                          onDone={markDone}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StepAction({
  id,
  links,
  onDone,
}: {
  id: StepId;
  links: ChecklistData["links"];
  onDone: (step: RecordedStepId) => void;
}) {
  if (id === "rsvp") {
    return (
      <DashboardButton asChild className="md:self-start">
        <Link href="/rsvp">
          Open RSVP form
          <ArrowRight aria-hidden="true" />
        </Link>
      </DashboardButton>
    );
  }

  if (id === "slack" || id === "devpost") {
    const href = links[id];
    if (!href) return null;
    return (
      <DashboardButton asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onDone(id)}
        >
          {id === "slack" ? "Join HW13 Slack" : "Join HW13 Devpost"}
          <ExternalLink aria-hidden="true" />
        </a>
      </DashboardButton>
    );
  }

  if (id === "wallet") {
    return (
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-3">
        <AddToWallet walletType="APPLE" onAdded={() => onDone("wallet")} />
        <AddToWallet walletType="GOOGLE" onAdded={() => onDone("wallet")} />
      </div>
    );
  }

  return null;
}
