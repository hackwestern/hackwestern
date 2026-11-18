import { Coffee } from "lucide-react";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { ChatRequestForm } from "~/components/sponsors/chat-request-form";
import { coffeeChatCopy } from "~/content/coffee-chat";
import type { ChatRequest } from "~/lib/coffee-chat-request";
import { formatClock } from "~/lib/run-of-show";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.setup;

// "Your chat setup": the sponsor picks 1-on-1 (N reps) or one group (M
// hackers), saved to us. Shows the chat length and hours from the run of
// show. Until they save, the request is the sheet's default.
export function ChatSetupCard({
  sponsor,
  request,
  sheet,
}: {
  sponsor: string;
  request: ChatRequest;
  sheet: {
    windowStart: string | null;
    windowEnd: string | null;
    chattingHours: number | null;
  } | null;
}) {
  const utils = api.useUtils();
  const save = api.coffeeChatRequests.setChatRequest.useMutation({
    onSuccess: () => utils.coffeeChatRequests.invalidate(),
  });
  const facts = [
    copy.length(request.durationMinutes),
    sheet?.windowStart && sheet.windowEnd
      ? copy.hours(formatClock(sheet.windowStart), formatClock(sheet.windowEnd))
      : null,
    sheet?.chattingHours != null ? copy.chattingHours(sheet.chattingHours) : null,
  ].filter(Boolean);
  return (
    <DashboardPanel>
      <section aria-labelledby="chat-setup" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="chat-setup"
            className="m-0 flex items-center gap-2 text-lg font-semibold text-dashboard-text-heavy"
          >
            <Coffee aria-hidden className="size-4 text-dashboard-text-light" />
            {copy.heading}
          </h2>
          <p className="m-0 text-sm text-dashboard-text-medium">
            {request.source === "sheet"
              ? copy.fromSheet
              : request.source === "none"
                ? copy.none
                : copy.intro}
          </p>
          <p className="m-0 text-sm text-dashboard-text-light">
            {facts.join(" · ")}
          </p>
        </div>
        <ChatRequestForm
          key={`${request.style}-${request.perSlot}`}
          initial={request}
          saving={save.isPending}
          saved={request.source === "sponsor"}
          error={save.isError}
          onSave={(value) => save.mutate({ sponsor, ...value })}
        />
      </section>
    </DashboardPanel>
  );
}
