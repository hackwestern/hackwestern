import { isAdmittedStatus } from "~/lib/admission";
import { RSVP_DEADLINE } from "~/lib/date";

// The hacker checklist on the live site home page. Two kinds of step:
//  - derived: worked out from the application, never stored (accepted, RSVP)
//  - recorded: the hacker did it somewhere we can't see, so we save a row in
//    `onboarding_step` when they click through (Slack, Devpost, wallet pass)
// "hide-checklist" is stored the same way, once everything is done.
// Pure (no DB) so the server router and the UI share it.

const ALL_STEPS = ["accepted", "rsvp", "slack", "devpost", "wallet"] as const;
export type StepId = (typeof ALL_STEPS)[number];

// TODO: the wallet step is hidden for now (the UI, copy and server support
// are all still here). Set this to true to bring it back.
const WALLET_STEP_ENABLED = false;

// The steps hackers see, in order. Everything (progress bar, "N steps left",
// the Home badge, all done) counts only these.
export const STEP_ORDER: readonly StepId[] = ALL_STEPS.filter(
  (id) => id !== "wallet" || WALLET_STEP_ENABLED,
);

export const RECORDED_STEPS = ["slack", "devpost", "wallet"] as const;
export type RecordedStepId = (typeof RECORDED_STEPS)[number];

export const HIDE_CHECKLIST = "hide-checklist";

export type ChecklistStep = { id: StepId; done: boolean };

export type Checklist = {
  steps: ChecklistStep[];
  stepsLeft: number;
  allDone: boolean;
  /** First step still to do, or null once everything is done */
  currentId: StepId | null;
  /** Whole days until RSVP closes while it's still open, else null */
  rsvpDueInDays: number | null;
  /** Hacker closed the finished checklist */
  hidden: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Checklist state for an admitted hacker. `recorded` is the set of step ids
 * stored in `onboarding_step` for them. Returns null for anyone who isn't
 * admitted (see ~/lib/admission), since they don't get the checklist.
 */
export function buildChecklist({
  status,
  recorded,
  now = Date.now(),
}: {
  status: string | null | undefined;
  recorded: Iterable<string>;
  now?: number;
}): Checklist | null {
  if (!isAdmittedStatus(status, now)) return null;

  const stored = new Set(recorded);
  const rsvpDone = status === "CONFIRMED";

  const done: Record<StepId, boolean> = {
    accepted: true,
    rsvp: rsvpDone,
    slack: stored.has("slack"),
    devpost: stored.has("devpost"),
    wallet: stored.has("wallet"),
  };

  const steps: ChecklistStep[] = STEP_ORDER.map((id) => ({
    id,
    done: done[id],
  }));
  const stepsLeft = steps.filter((s) => !s.done).length;
  const msLeft = RSVP_DEADLINE.getTime() - now;

  return {
    steps,
    stepsLeft,
    allDone: stepsLeft === 0,
    currentId: steps.find((s) => !s.done)?.id ?? null,
    rsvpDueInDays:
      !rsvpDone && msLeft > 0 ? Math.max(1, Math.ceil(msLeft / DAY_MS)) : null,
    hidden: stored.has(HIDE_CHECKLIST),
  };
}
