import { createContext, useContext, useEffect, useRef, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { cn } from "~/lib/utils";
import {
  hoverTint,
  pressable,
} from "~/components/sponsors/sponsor-shell-styles";
import { HelpSheet } from "~/components/sponsors/help-sheet";
import { HelpStatus, helpStatusText } from "~/components/sponsors/help-status";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import { isActiveHelpStatus, SPONSOR_HELP_POLL_MS } from "~/lib/sponsor-help";
import type { SponsorHelpView } from "~/server/api/routers/sponsor-help";
import { api } from "~/utils/api";

const copy = sponsorHelpCopy;

type FocusTo = "status" | "trigger" | null;

type HelpState = {
  current: SponsorHelpView | null;
  openSheet: () => void;
  cancel: () => void;
  cancelling: boolean;
  cancelError: boolean;
  dismiss: () => void;
  /** Where focus goes once the button/card swap has rendered. */
  focusTo: FocusTo;
  focusDone: () => void;
};

const HelpContext = createContext<HelpState | null>(null);

/**
 * One "Need help?" request per page: the status query (and its polling),
 * the request and cancel mutations, the dismissed card and the sheet live
 * here, once. The shell mounts this; `SponsorHelp` views (the side nav's,
 * the page card on phones) only read it. Polls every 15s while a request is
 * open or claimed, and each poll also lets the server send a due Slack
 * re-ping, so there must only ever be one poller.
 */
export function SponsorHelpProvider({
  sponsor,
  boothLocation,
  children,
}: {
  sponsor: string;
  /** Booth from the sponsor sheet; the sheet shows it as a placeholder. */
  boothLocation?: string | null;
  children: React.ReactNode;
}) {
  const utils = api.useUtils();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const [focusTo, setFocusTo] = useState<FocusTo>(null);

  const status = api.sponsorHelp.status.useQuery(
    { sponsor },
    {
      refetchInterval: (q) =>
        q.state.data && isActiveHelpStatus(q.state.data.status)
          ? SPONSOR_HELP_POLL_MS
          : false,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  );

  const request = api.sponsorHelp.request.useMutation({
    onSuccess: (data) => {
      utils.sponsorHelp.status.setData({ sponsor }, data);
      setSheetOpen(false);
      setFocusTo("status");
    },
    onError: (err) => {
      // Someone on the team already asked from another phone.
      if (err.data?.code === "CONFLICT") {
        setSheetOpen(false);
        setFocusTo("status");
        void status.refetch();
      }
    },
  });

  const cancel = api.sponsorHelp.cancel.useMutation({
    onSuccess: () => {
      utils.sponsorHelp.status.setData({ sponsor }, null);
      setFocusTo("trigger");
    },
  });

  const current =
    status.data && status.data.id !== dismissedId ? status.data : null;
  const text = current ? helpStatusText(current) : null;

  const value: HelpState = {
    current,
    openSheet: () => {
      request.reset();
      setSheetOpen(true);
    },
    cancel: () => current && cancel.mutate({ sponsor, id: current.id }),
    cancelling: cancel.isPending,
    cancelError: cancel.isError,
    dismiss: () => {
      if (!current) return;
      setDismissedId(current.id);
      setFocusTo("trigger");
    },
    focusTo,
    focusDone: () => setFocusTo(null),
  };

  return (
    <HelpContext.Provider value={value}>
      {/* Always mounted, once, so screen readers announce each change. */}
      <p role="status" className="sr-only">
        {text ? `${text.title}. ${text.body}` : ""}
      </p>
      {children}
      <HelpSheet
        sponsor={sponsor}
        boothLocation={boothLocation}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        sending={request.isPending}
        error={request.isError ? copy.sheet.error : null}
        onSubmit={(v) =>
          request.mutate({
            sponsor,
            reason: v.reason,
            note: v.note || undefined,
            repName: v.repName,
            phone: v.phone,
            locationNote: v.locationNote || undefined,
          })
        }
      />
    </HelpContext.Provider>
  );
}

/** Rendered with no box (display: none, or a hidden breakpoint)? */
const isHidden = (el: HTMLElement | null) =>
  !el || el.getClientRects().length === 0;

// "Need help?" on a sponsor page: the button when there's no request,
// otherwise the status card. `variant="nav"` is the side nav's quiet
// version: a nav-row button and a compact status card. Several views can
// show at once across breakpoints; they all share SponsorHelpProvider's one
// request, and only the visible one takes focus.
export function SponsorHelp({
  variant = "card",
}: {
  variant?: "card" | "nav";
}) {
  const help = useContext(HelpContext);
  const nav = variant === "nav";
  const triggerRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const current = help?.current ?? null;
  const focusTo = help?.focusTo ?? null;
  const focusDone = help?.focusDone;
  useEffect(() => {
    if (focusTo === "status" && current && !isHidden(statusRef.current)) {
      statusRef.current?.focus();
      focusDone?.();
    } else if (
      focusTo === "trigger" &&
      !current &&
      !isHidden(triggerRef.current)
    ) {
      triggerRef.current?.focus();
      focusDone?.();
    }
  }, [focusTo, current, focusDone]);

  if (!help) return null;

  return (
    <div data-tour="need-help" className="flex flex-col gap-2">
      {current ? (
        <HelpStatus
          ref={statusRef}
          request={current}
          compact={nav}
          onCancel={help.cancel}
          cancelling={help.cancelling}
          cancelError={help.cancelError}
          onDismiss={help.dismiss}
        />
      ) : nav ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          onClick={help.openSheet}
          className={cn(
            "flex min-h-11 w-full items-center gap-2.5 rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-left text-sm font-semibold text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
            hoverTint,
            pressable,
          )}
        >
          <LifeBuoy
            aria-hidden
            className="size-4 shrink-0 text-dashboard-action-primary"
          />
          {copy.button}
        </button>
      ) : (
        <>
          <DashboardButton
            ref={triggerRef}
            variant="outline"
            // Secondary to each page's main action, but full width and
            // always in the same place, so it's easy to find in a hurry.
            className={cn(
              "h-12 w-full rounded-dashboard-lg text-base font-semibold [&_svg]:size-5 [&_svg]:text-dashboard-action-primary",
              pressable,
            )}
            onClick={help.openSheet}
            aria-haspopup="dialog"
          >
            <LifeBuoy aria-hidden />
            {copy.button}
          </DashboardButton>
          <p className="m-0 text-center text-sm text-dashboard-text-light">
            {copy.buttonHint}
          </p>
        </>
      )}
    </div>
  );
}
