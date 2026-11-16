import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { HelpSheet } from "~/components/sponsors/help-sheet";
import { HelpStatus } from "~/components/sponsors/help-status";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import { isActiveHelpStatus, SPONSOR_HELP_POLL_MS } from "~/lib/sponsor-help";
import { api } from "~/utils/api";

const copy = sponsorHelpCopy;

// "Need help?" for a sponsor page: the button and sheet when there's no
// request, otherwise the status card. Polls every 15s while a request is
// open or claimed (each poll also lets the server send a due Slack re-ping).
export function SponsorHelp({ sponsor }: { sponsor: string }) {
  const utils = api.useUtils();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

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
    },
    onError: (err) => {
      // Someone on the team already asked from another phone.
      if (err.data?.code === "CONFLICT") {
        setSheetOpen(false);
        void status.refetch();
      }
    },
  });

  const cancel = api.sponsorHelp.cancel.useMutation({
    onSuccess: () => utils.sponsorHelp.status.setData({ sponsor }, null),
  });

  const current = status.data;
  if (current && current.id !== dismissedId) {
    return (
      <HelpStatus
        request={current}
        onCancel={() => cancel.mutate({ sponsor, id: current.id })}
        cancelling={cancel.isPending}
        cancelError={cancel.isError}
        onDismiss={() => setDismissedId(current.id)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <DashboardButton
        className="md:h-11 md:w-full"
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
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        sending={request.isPending}
        error={request.isError ? copy.sheet.error : null}
        onSubmit={(reason, note) =>
          request.mutate({ sponsor, reason, note: note || undefined })
        }
      />
    </div>
  );
}
