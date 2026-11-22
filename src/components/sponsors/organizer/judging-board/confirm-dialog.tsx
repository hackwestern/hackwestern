import { useRef } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { dangerButton } from "~/components/sponsors/organizer/coffee-sessions/parts";
import { cn } from "~/lib/utils";

/*
 * The coffee chat board's ConfirmDialog look (Radix AlertDialog, 448px),
 * for judging board actions that can't be undone. Esc cancels, Tab stays
 * inside, Cancel has focus, and the primary button is red.
 */
const overlay = "fixed inset-0 z-[62] bg-dashboard-text-heavy/30";
const box =
  "fixed left-1/2 top-1/2 z-[63] flex max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-dashboard-lg bg-dashboard-bg-surface p-6 font-figtree text-dashboard-text-heavy shadow-dashboard-card focus:outline-none";

export function ConfirmDialog({
  open,
  heading,
  body,
  warnings,
  ok,
  okDisabled = false,
  cancel,
  onOk,
  onClose,
}: {
  open: boolean;
  heading: string;
  body: string;
  warnings?: readonly string[];
  ok: string;
  okDisabled?: boolean;
  cancel: string;
  onOk: () => void;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content
          className={box}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            cancelRef.current?.focus();
          }}
        >
          <AlertDialog.Title className="m-0 text-xl font-bold leading-snug">
            {heading}
          </AlertDialog.Title>
          <AlertDialog.Description className="m-0 text-base text-dashboard-text-medium">
            {body}
          </AlertDialog.Description>
          {!!warnings?.length && (
            <div className="rounded-dashboard-md border-l-4 border-dashboard-text-warning bg-dashboard-status-iconBadge p-3 text-sm text-dashboard-text-heavy">
              <p className="m-0 font-semibold">Schedule warnings</p>
              <ul className="mb-0 mt-2 list-disc space-y-1 pl-5">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <AlertDialog.Action asChild>
              <DashboardButton
                variant="primary"
                disabled={okDisabled}
                className={cn("min-h-11 sm:w-auto sm:px-5", dangerButton)}
                onClick={onOk}
              >
                {ok}
              </DashboardButton>
            </AlertDialog.Action>
            <AlertDialog.Cancel asChild>
              <DashboardButton
                ref={cancelRef}
                variant="outline"
                className="h-11 sm:w-auto sm:px-5"
              >
                {cancel}
              </DashboardButton>
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
