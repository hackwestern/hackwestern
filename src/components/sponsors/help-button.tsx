import { useEffect, useRef, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { cn } from "~/lib/utils";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { HelpSheet } from "~/components/sponsors/help-sheet";
import { HelpStatus, helpStatusText } from "~/components/sponsors/help-status";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import { isActiveHelpStatus, SPONSOR_HELP_POLL_MS } from "~/lib/sponsor-help";
import { api } from "~/utils/api";

const copy = sponsorHelpCopy;

// "Need help?" for a sponsor page: the button and sheet when there's no
// request, otherwise the status card. Polls every 15s while a request is
// open or claimed (each poll also lets the server send a due Slack re-ping).
export function SponsorHelp({
  sponsor,
  boothLocation,
}: {
  sponsor: string;
  /** Booth from the sponsor sheet; the sheet shows it as a placeholder. */
  boothLocation?: string | null;
}) {
  const utils = api.useUtils();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  // Where focus goes once the swap between button and card has rendered, so
  // it never drops to <body> when the focused control unmounts.
  const [focusTo, setFocusTo] = useState<"status" | "trigger" | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (focusTo === "status" && current) {
      statusRef.current?.focus();
      setFocusTo(null);
    } else if (focusTo === "trigger" && !current) {
      triggerRef.current?.focus();
      setFocusTo(null);
    }
  }, [focusTo, current]);

  return (
    <div data-tour="need-help" className="flex flex-col gap-2">
      {/* Always mounted so screen readers announce each change. */}
      <p role="status" className="sr-only">
        {text ? `${text.title}. ${text.body}` : ""}
      </p>
      {current ? (
        <HelpStatus
          ref={statusRef}
          request={current}
          onCancel={() => cancel.mutate({ sponsor, id: current.id })}
          cancelling={cancel.isPending}
          cancelError={cancel.isError}
          onDismiss={() => {
            setDismissedId(current.id);
            setFocusTo("trigger");
          }}
        />
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
            onClick={() => {
              request.reset();
              setSheetOpen(true);
            }}
            aria-haspopup="dialog"
          >
            <LifeBuoy aria-hidden />
            {copy.button}
          </DashboardButton>
          <p className="m-0 text-center text-sm text-dashboard-text-light">
            {copy.buttonHint}
          </p>
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
        </>
      )}
    </div>
  );
}
