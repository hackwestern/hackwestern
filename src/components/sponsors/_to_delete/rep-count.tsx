import { useEffect, useState } from "react";
import { Minus, Plus, UserRound } from "lucide-react";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { chatsPerSlot } from "~/lib/coffee-chat-holds";
import {
  MAX_COFFEE_CHAT_REPS,
  MIN_COFFEE_CHAT_REPS,
} from "~/lib/coffee-chat-requests";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.reps;

// The sponsor's coffee chat rep count (1 to 10), saved as they tap. Chats
// at once: one per rep for 1-on-1s, one for a group (chatsPerSlot).
export function RepCount({
  sponsor,
  groupSize,
}: {
  sponsor: string;
  groupSize: number;
}) {
  const utils = api.useUtils();
  const q = api.sponsorPortal.getCoffeeChatReps.useQuery({ sponsor });
  const save = api.sponsorPortal.setCoffeeChatReps.useMutation({
    onSuccess: (data) => {
      utils.sponsorPortal.getCoffeeChatReps.setData({ sponsor }, data);
    },
  });
  const [reps, setReps] = useState<number | null>(null);
  useEffect(() => {
    if (q.data && reps === null) setReps(q.data.reps);
  }, [q.data, reps]);

  if (reps === null) {
    return (
      <div
        aria-busy="true"
        className="h-40 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card"
      />
    );
  }

  const change = (next: number) => {
    if (next < MIN_COFFEE_CHAT_REPS || next > MAX_COFFEE_CHAT_REPS) return;
    setReps(next);
    save.mutate({ sponsor, reps: next });
  };
  const chats = chatsPerSlot({ durationMinutes: 15, groupSize, reps });

  return (
    <DashboardPanel>
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
        <UserRound aria-hidden className="size-4" strokeWidth={1.67} />
        {copy.heading}
      </span>
      <p className="m-0 text-base text-dashboard-text-medium">{copy.intro}</p>
      <div className="flex items-center gap-3">
        <StepButton
          label={copy.decrease}
          disabled={reps <= MIN_COFFEE_CHAT_REPS}
          onClick={() => change(reps - 1)}
        >
          <Minus aria-hidden />
        </StepButton>
        <output
          aria-label={copy.label}
          className="min-w-12 text-center text-2xl font-semibold text-dashboard-text-heavy"
        >
          {reps}
        </output>
        <StepButton
          label={copy.increase}
          disabled={reps >= MAX_COFFEE_CHAT_REPS}
          onClick={() => change(reps + 1)}
        >
          <Plus aria-hidden />
        </StepButton>
        <span
          aria-live="polite"
          className={cn(
            "ml-auto text-sm",
            save.isError
              ? "text-dashboard-text-warning"
              : "text-dashboard-text-light",
          )}
        >
          {save.isPending
            ? copy.saving
            : save.isError
              ? copy.error
              : save.isSuccess
                ? copy.saved
                : ""}
        </span>
      </div>
      <p className="m-0 text-sm text-dashboard-text-medium">
        {copy.parallel(chats, groupSize)}
      </p>
    </DashboardPanel>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-11 cursor-pixel-hover items-center justify-center rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-heavy transition-colors hover:bg-dashboard-bg-highlight",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-dashboard-disabled",
        "[&_svg]:size-5",
      )}
    >
      {children}
    </button>
  );
}
