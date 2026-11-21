import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { hoverTint } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import { cn } from "~/lib/utils";

const copy = sponsorJudgingCopy.rubric;

/**
 * Holia's rubric (the newest four criteria) as a modal: a sheet from the
 * bottom on phones, centered from sm up. Optional: it helps a rep
 * calibrate one overall score. On close, Esc or a scrim tap, focus goes
 * back to `returnFocus` (the Rubric button that opened it): there's no
 * Radix Trigger, so Radix can't find it by itself.
 */
export function RubricDialog({
  open,
  onOpenChange,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus?: HTMLElement | null;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <Dialog.Content
          onCloseAutoFocus={(e) => {
            if (!returnFocus?.isConnected) return;
            e.preventDefault();
            returnFocus.focus();
          }}
          className={cn(
            "fixed z-50 flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto bg-dashboard-bg-surface p-6 font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-dashboard-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            "sm:inset-0 sm:m-auto sm:h-fit sm:max-w-[560px] sm:rounded-dashboard-2xl sm:pb-6",
            "data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:[animation-timing-function:cubic-bezier(0.32,0.72,0,1)]",
            "data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full",
            "sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:slide-out-to-bottom-2 sm:data-[state=open]:slide-in-from-bottom-2",
            "motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="m-0 text-xl font-semibold">
              {copy.title}
            </Dialog.Title>
            <Dialog.Close
              aria-label={copy.close}
              className={cn(
                "-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                hoverTint,
              )}
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="m-0 text-sm text-dashboard-text-medium">
            {copy.intro}
          </Dialog.Description>
          {copy.criteria.map((c) => (
            <section key={c.name} className="flex flex-col gap-2">
              <h3 className="m-0 text-base font-semibold">{c.name}</h3>
              <p className="m-0 text-sm text-dashboard-text-medium">
                {c.description}
              </p>
              <dl className="m-0 grid grid-cols-3 gap-1.5">
                {(
                  [
                    [copy.bands.low, c.low],
                    [copy.bands.mid, c.mid],
                    [copy.bands.high, c.high],
                  ] as const
                ).map(([band, text]) => (
                  <div
                    key={band}
                    className="flex flex-col gap-0.5 rounded-dashboard-md bg-dashboard-bg-inset px-2.5 py-2"
                  >
                    <dt className="text-xs font-bold tabular-nums text-dashboard-text-heavy">
                      {band}
                    </dt>
                    <dd className="m-0 text-xs leading-snug text-dashboard-text-medium">
                      {text}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
