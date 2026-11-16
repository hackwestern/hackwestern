import { useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import {
  SPONSOR_HELP_NOTE_MAX,
  SPONSOR_HELP_REASONS,
  type SponsorHelpReason,
} from "~/lib/sponsor-help";
import { cn } from "~/lib/utils";

const copy = sponsorHelpCopy.sheet;

// The "Need help" sheet: pick a quick reason, add an optional note, send.
// Bottom sheet on phones, centered dialog on wider screens. Radix Dialog
// traps focus, closes on Escape and returns focus to the trigger.
export function HelpSheet({
  open,
  onOpenChange,
  onSubmit,
  sending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: SponsorHelpReason, note: string) => void;
  sending: boolean;
  error: string | null;
}) {
  const [reason, setReason] = useState<SponsorHelpReason | null>(null);
  const [note, setNote] = useState("");
  const [triedEmpty, setTriedEmpty] = useState(false);
  const noteId = useId();
  const hintId = useId();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setTriedEmpty(true);
      return;
    }
    onSubmit(reason, note);
  };

  const message = error ?? (triedEmpty && !reason ? copy.pickReason : null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex max-h-[90dvh] w-full flex-col gap-5 overflow-y-auto bg-dashboard-bg-surface p-6 font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-dashboard-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-[480px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-dashboard-2xl",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="m-0 text-xl font-semibold">
                {copy.title}
              </Dialog.Title>
              <Dialog.Description className="m-0 text-base text-dashboard-text-medium">
                {copy.description}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={copy.close}
              className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium hover:bg-dashboard-bg-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-semibold text-dashboard-text-light">
                {copy.reasonLegend}
              </legend>
              {SPONSOR_HELP_REASONS.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex min-h-11 cursor-pixel-hover items-center gap-3 rounded-dashboard-lg border px-4 py-2.5 text-base transition-colors",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-dashboard-action-primary has-[:focus-visible]:ring-offset-2",
                    reason === r
                      ? "border-dashboard-action-primary bg-dashboard-bg-highlight"
                      : "border-dashboard-border-default bg-dashboard-bg-surface hover:bg-dashboard-bg-highlightSubtle",
                  )}
                >
                  <input
                    type="radio"
                    name="help-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="size-4 accent-dashboard-action-primary"
                  />
                  {sponsorHelpCopy.reasons[r]}
                </label>
              ))}
            </fieldset>

            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={noteId} className="text-sm font-semibold text-dashboard-text-light">
                  {copy.noteLabel}
                </label>
                <span id={hintId} className="text-xs text-dashboard-text-light">
                  {copy.noteCount(note.length, SPONSOR_HELP_NOTE_MAX)}
                </span>
              </div>
              <textarea
                id={noteId}
                aria-describedby={hintId}
                value={note}
                maxLength={SPONSOR_HELP_NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                placeholder={copy.notePlaceholder}
                rows={3}
                className="w-full resize-none rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface px-3 py-2.5 text-base text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
              />
            </div>

            {message && (
              <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
                {message}
              </p>
            )}

            <DashboardButton
              type="submit"
              disabled={sending}
              className="md:h-11 md:w-full"
            >
              {sending ? copy.sending : copy.submit}
            </DashboardButton>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
