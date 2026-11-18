import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { coffeeChatCopy } from "~/content/coffee-chat";
import {
  CHAT_STYLES,
  MAX_PER_SLOT,
  MIN_PER_SLOT,
  type ChatStyle,
} from "~/lib/coffee-chat-request";
import { cn } from "~/lib/utils";

const copy = coffeeChatCopy.request;

export type ChatRequestValue = { style: ChatStyle; perSlot: number };

/** "1-on-1 · 3 reps", "Group · 4 hackers" or "No chat request yet". */
export function requestSummary(request: {
  style: ChatStyle;
  perSlot: number;
  source: string;
}): string {
  return request.source === "none"
    ? copy.none
    : copy.summary(request.style, request.perSlot);
}

// A number with - and + buttons (reps, group size, hackers then).
export function Stepper({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <StepButton
        label={copy.decrease}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden />
      </StepButton>
      <output
        aria-label={label}
        className="min-w-10 text-center text-xl font-semibold tabular-nums text-dashboard-text-heavy"
      >
        {value}
      </output>
      <StepButton
        label={copy.increase}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden />
      </StepButton>
    </div>
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2 md:size-10",
        "disabled:cursor-not-allowed disabled:opacity-dashboard-disabled",
        "[&_svg]:size-4",
      )}
    >
      {children}
    </button>
  );
}

// Pick 1-on-1 (N reps) or one group (M hackers), then Save. Used by the
// sponsor's "Your chat setup" card and by organizers for a sponsor.
export function ChatRequestForm({
  initial,
  saving,
  saved,
  error,
  onSave,
}: {
  initial: ChatRequestValue;
  saving: boolean;
  saved: boolean;
  error: boolean;
  onSave: (value: ChatRequestValue) => void;
}) {
  const [value, setValue] = useState(initial);
  const changed =
    value.style !== initial.style || value.perSlot !== initial.perSlot;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!saving) onSave(value);
      }}
    >
      <div
        role="group"
        aria-label={copy.styleLabel}
        className="flex flex-wrap gap-1.5"
      >
        {CHAT_STYLES.map((style) => (
          <DashboardChip
            key={style}
            selected={value.style === style}
            onClick={() => setValue((v) => ({ ...v, style }))}
          >
            {copy.styles[style]}
          </DashboardChip>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-dashboard-text-light">
          {copy.perSlotLabel[value.style]}
        </span>
        <Stepper
          value={value.perSlot}
          min={MIN_PER_SLOT}
          max={MAX_PER_SLOT}
          label={copy.perSlotLabel[value.style]}
          onChange={(perSlot) => setValue((v) => ({ ...v, perSlot }))}
        />
        <span className="text-dashboard-text-medium">
          {copy.perSlotLine(value.style, value.perSlot)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <DashboardButton
          type="submit"
          variant="small"
          disabled={saving || (!changed && saved)}
        >
          {saving ? copy.saving : copy.save}
        </DashboardButton>
        <span
          aria-live="polite"
          className={cn(
            "text-sm",
            error ? "text-dashboard-text-warning" : "text-dashboard-text-light",
          )}
        >
          {error ? copy.error : saved && !changed ? copy.saved : ""}
        </span>
      </div>
    </form>
  );
}
