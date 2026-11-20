import * as Dialog from "@radix-ui/react-dialog";
import { Check, CircleHelp, X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import { cn } from "~/lib/utils";
import { focusRing } from "./parts";

const h = coffeeSessionsCopy.help;

/**
 * "How coffee chats work": a right-hand panel on desktop, a bottom sheet on
 * phones. Radix keeps focus inside it and closes it on Esc.
 */
export function HelpSheet() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <DashboardButton variant="small" className="min-h-11 px-3.5 text-base md:min-h-11">
          <CircleHelp aria-hidden />
          {h.button}
        </DashboardButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-dashboard-text-heavy/30" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-[61] flex flex-col bg-dashboard-bg-surface font-figtree text-dashboard-text-heavy shadow-dashboard-card focus:outline-none",
            "inset-x-0 bottom-0 h-[calc(100dvh-24px)] rounded-t-dashboard-lg",
            "sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-auto sm:w-[min(460px,100%)] sm:rounded-none",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-dashboard-border-subtle py-3 pl-6 pr-3">
            <Dialog.Title className="m-0 text-xl font-bold">{h.title}</Dialog.Title>
            <Dialog.Close
              aria-label={h.close}
              className={cn("inline-flex size-11 cursor-pixel-hover items-center justify-center rounded-dashboard-lg text-dashboard-text-light [@media(hover:hover)]:hover:bg-dashboard-bg-highlight", focusRing)}
            >
              <X aria-hidden className="size-[18px]" />
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-4 text-[15px] text-dashboard-text-medium [&_b]:font-bold [&_b]:text-dashboard-text-heavy">
            <p className="m-0"><b>{h.give.lead}</b>{h.give.rest}</p>
            <p className="m-0">{h.cellNote}</p>
            <p className="m-0"><b>{h.checksTitle}</b></p>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {h.checks.map((c) => (
                <li key={c} className="grid grid-cols-[20px_minmax(0,1fr)] items-start gap-1.5">
                  <Check aria-hidden className="mt-0.5 size-[18px] text-dashboard-status-live" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
            <p className="m-0">{h.fixes.before}<b>{h.fixes.bold}</b>{h.fixes.after}</p>
            <p className="m-0"><b>{h.send.lead}</b>{h.send.before}<b>{h.send.bold}</b>{h.send.after}</p>
            <p className="m-0">{h.sameWord}</p>
            <p className="m-0"><b>{h.after.lead}</b>{h.after.rest}</p>
            <h3 className="m-0 mt-1 text-base font-bold text-dashboard-text-heavy">{h.dataTitle}</h3>
            <p className="m-0">{h.data}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
