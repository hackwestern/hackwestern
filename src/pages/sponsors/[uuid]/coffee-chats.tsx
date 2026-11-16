import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Ban,
  CircleCheck,
  CircleX,
  Clock,
  MapPin,
  RefreshCw,
  ScanLine,
  TimerOff,
  UserRound,
} from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import {
  InvalidLink,
  LoadError,
  PageIntro,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { SponsorShell } from "~/components/sponsors/sponsor-shell";
import { coffeeChatCopy } from "~/content/coffee-chat";
import type { CoffeeChatStatus } from "~/lib/coffee-chat-requests";
import { formatClock } from "~/lib/run-of-show";
import { cn } from "~/lib/utils";
import type { SponsorCoffeeChat } from "~/server/api/routers/coffee-chat-requests";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

const copy = coffeeChatCopy.sponsorList;

// Status chips: icon + word, so the status never rests on colour alone.
const STATUS_STYLE: Record<
  CoffeeChatStatus,
  { icon: typeof Clock; className: string }
> = {
  pending: {
    icon: Clock,
    className: "bg-dashboard-bg-highlight text-dashboard-text-active",
  },
  accepted: {
    icon: CircleCheck,
    className: "bg-dashboard-status-live text-dashboard-text-inverse",
  },
  declined: {
    icon: CircleX,
    className: "bg-dashboard-status-iconBadge text-dashboard-text-warning",
  },
  expired: {
    icon: TimerOff,
    className: "bg-dashboard-bg-inset text-dashboard-text-light",
  },
  cancelled: {
    icon: Ban,
    className:
      "border border-dashboard-border-muted bg-dashboard-bg-surface text-dashboard-text-light",
  },
};

// The sponsor's own coffee chats from badge-scan offers, grouped by start
// time, with each hacker's reply. Refreshes every 30 seconds.
export default function SponsorCoffeeChatsPage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const [announcement, setAnnouncement] = useState("");

  const q = api.coffeeChatRequests.sponsorChats.useQuery(
    { sponsor: id },
    { enabled: validUuid, refetchInterval: 30_000, retry: 1 },
  );

  const shell = (children: React.ReactNode) => (
    <SponsorShell
      title={copy.seoTitle}
      backHref={validUuid ? `/sponsors/${id}` : undefined}
    >
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {children}
    </SponsorShell>
  );

  if (!router.isReady || (validUuid && q.isLoading)) {
    return shell(<ScheduleSkeleton />);
  }
  if (!validUuid || q.error?.data?.code === "NOT_FOUND") {
    return shell(<InvalidLink />);
  }
  if (!q.data) return shell(<LoadError onRetry={() => void q.refetch()} />);

  const { sponsorName, chats } = q.data;
  const groups = groupByTime(chats);
  const accepted = chats.filter((c) => c.status === "accepted").length;
  const pending = chats.filter((c) => c.status === "pending").length;

  const refresh = async () => {
    setAnnouncement("");
    await q.refetch();
    setAnnouncement(copy.updated);
  };

  return shell(
    <>
      <PageIntro
        eyebrow={copy.eyebrow}
        title={copy.title(sponsorName)}
        intro={copy.intro}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DashboardButton asChild className="md:h-11 md:w-full">
          <Link href={`/sponsors/${id}/scan`}>
            <ScanLine aria-hidden />
            {copy.scan}
          </Link>
        </DashboardButton>
        <DashboardButton
          variant="outline"
          className="h-11 w-full"
          aria-disabled={q.isFetching || undefined}
          onClick={() => {
            if (!q.isFetching) void refresh();
          }}
        >
          <RefreshCw
            aria-hidden
            className={cn(q.isFetching && "motion-safe:animate-spin")}
          />
          {q.isFetching ? copy.refreshing : copy.refresh}
        </DashboardButton>
      </div>

      {chats.length === 0 ? (
        <DashboardPanel className="text-center">
          <p className="m-0 text-base text-dashboard-text-medium">
            {copy.empty}
          </p>
        </DashboardPanel>
      ) : (
        <>
          <p className="m-0 text-sm font-semibold text-dashboard-text-medium">
            {copy.summary(accepted, pending)}
          </p>
          <div className="flex flex-col gap-5">
            {groups.map(([slotTime, group]) => (
              <section
                key={slotTime}
                aria-labelledby={`time-${slotTime}`}
                className="flex flex-col gap-2"
              >
                <h2
                  id={`time-${slotTime}`}
                  className="m-0 flex items-baseline gap-2 text-lg font-semibold text-dashboard-text-heavy"
                >
                  <span>{formatClock(slotTime)}</span>
                  <span className="text-sm font-medium text-dashboard-text-light">
                    <span className="sr-only">, </span>
                    {copy.minutes(group[0]!.durationMinutes)}
                  </span>
                </h2>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {group.map((chat) => (
                    <ChatRow key={chat.chatId} chat={chat} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </>,
  );
}

function ChatRow({ chat }: { chat: SponsorCoffeeChat }) {
  const style = STATUS_STYLE[chat.status];
  const Icon = style.icon;
  const over = chat.status !== "pending" && chat.status !== "accepted";
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card",
        over && "bg-dashboard-bg-highlightSubtle shadow-none",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "min-w-0 truncate text-lg font-semibold",
            over ? "text-dashboard-text-light" : "text-dashboard-text-heavy",
          )}
        >
          {chat.firstName}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold",
            style.className,
          )}
        >
          <Icon aria-hidden className="size-4" />
          {copy.status[chat.status]}
        </span>
      </div>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm text-dashboard-text-medium">
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden className="size-4 text-dashboard-text-light" />
          {chat.room ?? copy.roomTbd}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <UserRound aria-hidden className="size-4 text-dashboard-text-light" />
          {chat.repName ? copy.rep(chat.repName) : copy.noRep}
        </span>
      </p>
    </li>
  );
}

/** Chats by start time, earliest first (the server already sorts them). */
function groupByTime(
  chats: SponsorCoffeeChat[],
): [string, SponsorCoffeeChat[]][] {
  const groups = new Map<string, SponsorCoffeeChat[]>();
  for (const chat of chats) {
    const group = groups.get(chat.slotTime) ?? [];
    group.push(chat);
    groups.set(chat.slotTime, group);
  }
  return [...groups];
}
