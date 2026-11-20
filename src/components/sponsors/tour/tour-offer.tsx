import { DashboardButton } from "~/components/internals/dashboard-button";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { cn } from "~/lib/utils";

/** The offer's words, from the audience's content file. */
export interface TourOfferText {
  title: string;
  body: string;
  start: string;
  dismiss: string;
}

/**
 * "New here? Take the tour?" card in the corner, for a first visit. Never
 * takes focus, so it never interrupts. `className` adjusts the position
 * (the sponsor portal keeps it above its phone tab bar).
 */
export function TourOffer({
  text,
  onStart,
  onDismiss,
  className,
}: {
  text: TourOfferText;
  onStart: () => void;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <section
      aria-label={text.title}
      className={cn(
        "fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex flex-col gap-3 rounded-dashboard-2xl bg-dashboard-bg-surface p-4 font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card duration-300 ease-out animate-in fade-in-0 slide-in-from-bottom-4 motion-reduce:animate-none sm:inset-x-auto sm:right-6 sm:w-[340px] md:bottom-6",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-base font-semibold">{text.title}</h2>
        <p className="m-0 text-sm text-dashboard-text-medium">{text.body}</p>
      </div>
      <div className="flex items-center justify-end gap-2">
        <DashboardButton
          variant="link"
          onClick={onDismiss}
          className="min-h-11"
        >
          {text.dismiss}
        </DashboardButton>
        <DashboardButton
          onClick={onStart}
          className={cn("h-auto min-h-11 w-auto py-2", pressable)}
        >
          {text.start}
        </DashboardButton>
      </div>
    </section>
  );
}
