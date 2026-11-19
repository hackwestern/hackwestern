import { useEffect, useRef, useState } from "react";
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
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { HackerLinks } from "~/components/sponsors/hacker-links";
import { InterestedHackers } from "~/components/sponsors/interested-hackers";
import { ChatSetupCard } from "~/components/sponsors/chat-setup-card";
import { SponsorHolds } from "~/components/sponsors/sponsor-holds";
import {
  InvalidLink,
  LoadError,
  PageIntro,
  ScheduleSkeleton,
} from "~/components/sponsors/schedule-states";
import { pressable, SponsorShell } from "~/components/sponsors/sponsor-shell";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { sponsorHackersCopy } from "~/content/sponsor-hackers";
import type { CoffeeChatStatus } from "~/lib/coffee-chat-requests";
import { formatClock } from "~/lib/run-of-show";
import { cn } from "~/lib/utils";
import type { SponsorCoffeeChat } from "~/server/api/routers/coffee-chat-requests";
import type { ChatPartner } from "~/server/api/routers/sponsor-shortlist";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";

const copy = coffeeChatCopy.sponsorList;
const tabsCopy = sponsorHackersCopy.tabs;

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

type Tab = "chats" | "candidates";
const TABS: Tab[] = ["chats", "candidates"];
/** Old /hackers links and the Candidates tab share this hash. */
const CANDIDATES_HASH = "#interested";

// The sponsor's coffee chats page, phone first: three numbers, Scan a badge,
// then a switch between Your chats (grouped by start time, with each
// hacker's reply and, when the hacker agreed to share, their photo and
// profile) and Candidates (the top-40 shortlist). Refreshes every 30s.
export default function SponsorCoffeeChatsPage() {
  const router = useRouter();
  const id = typeof router.query.uuid === "string" ? router.query.uuid : "";
  const validUuid = uuidRegex.test(id);
  const [announcement, setAnnouncement] = useState("");
  const [tab, setTab] = useState<Tab>("chats");
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());

  const q = api.coffeeChatRequests.sponsorChats.useQuery(
    { sponsor: id },
    { enabled: validUuid, refetchInterval: 30_000, retry: 1 },
  );
  const partnersQ = api.sponsorShortlist.chatPartners.useQuery(
    { sponsor: id },
    { enabled: validUuid, refetchInterval: 30_000, retry: 1 },
  );
  const interestedQ = api.sponsorShortlist.list.useQuery(
    { sponsor: id },
    { enabled: validUuid, refetchInterval: 60_000, retry: 1 },
  );

  // Old /hackers links land on #interested: open the Candidates tab.
  useEffect(() => {
    if (window.location.hash === CANDIDATES_HASH) setTab("candidates");
  }, []);

  const choose = (next: Tab, focus = false) => {
    setTab(next);
    if (focus) tabRefs.current.get(next)?.focus();
    // Keep the tab on reload and in shared links, without a history entry.
    const url = `${window.location.pathname}${window.location.search}${next === "candidates" ? CANDIDATES_HASH : ""}`;
    window.history.replaceState(window.history.state, "", url);
  };

  const shell = (children: React.ReactNode) => (
    <SponsorShell title={copy.seoTitle}>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {children}
    </SponsorShell>
  );

  if (
    !router.isReady ||
    (validUuid && (q.isLoading || interestedQ.isLoading))
  ) {
    return shell(<ScheduleSkeleton />);
  }
  if (!validUuid || q.error?.data?.code === "NOT_FOUND") {
    return shell(<InvalidLink />);
  }
  if (!q.data) return shell(<LoadError onRetry={() => void q.refetch()} />);

  const { sponsorName, watcherName, chats, holds, request, sheet, limits } =
    q.data;
  const groups = groupByTime(chats);
  const partners = new Map(
    (partnersQ.data ?? []).map((p) => [p.chatId, p] as const),
  );
  const accepted = chats.filter((c) => c.status === "accepted").length;
  const pending = chats.filter((c) => c.status === "pending").length;
  const interested = interestedQ.data;
  const shortlisted = interested?.hackers.filter((h) => h.shortlisted).length;
  const fetching = q.isFetching || interestedQ.isFetching;

  const refresh = async () => {
    setAnnouncement("");
    await Promise.all([
      q.refetch(),
      partnersQ.refetch(),
      interestedQ.refetch(),
    ]);
    setAnnouncement(copy.updated);
  };

  const announce = (message: string) => {
    setAnnouncement("");
    // Let the empty string land first so a repeated message is read again.
    requestAnimationFrame(() => setAnnouncement(message));
  };

  const counts: Record<Tab, number | undefined> = {
    chats: chats.length,
    candidates: interested?.hackers.length,
  };

  return shell(
    <>
      <PageIntro
        eyebrow={copy.eyebrow}
        title={copy.title(sponsorName)}
        intro={sponsorHackersCopy.pageIntro}
      />

      {/* The numbers a rep checks between chats. */}
      <dl
        aria-label={sponsorHackersCopy.stats.label}
        className="m-0 grid grid-cols-3 gap-2"
      >
        <Stat label={sponsorHackersCopy.stats.accepted} value={accepted} />
        <Stat label={sponsorHackersCopy.stats.waiting} value={pending} />
        {interested && shortlisted !== undefined && (
          <Stat
            label={sponsorHackersCopy.stats.shortlisted}
            value={shortlisted}
            of={sponsorHackersCopy.stats.of(interested.maxShortlist)}
          />
        )}
      </dl>
      <p className="sr-only">
        {copy.summary(accepted, pending)}
        {interested &&
          ` · ${sponsorHackersCopy.shortlistCount(shortlisted ?? 0, interested.hackers.length)}`}
      </p>

      {watcherName && (
        <p className="m-0 flex items-center gap-2 text-sm text-dashboard-text-medium">
          <UserRound
            aria-hidden
            className="size-4 shrink-0 text-dashboard-text-light"
          />
          {coffeeChatCopy.watcher.line(watcherName)}
        </p>
      )}

      <div className="flex gap-2">
        <Link
          href={`/sponsors/${id}/scan`}
          className={cn(
            "inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-dashboard-lg bg-dashboard-action-primary px-4 text-base font-semibold text-dashboard-text-inverse shadow-dashboard-primary-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2 [@media(hover:hover)]:hover:bg-dashboard-text-active",
            pressable,
          )}
        >
          <ScanLine aria-hidden className="size-5" />
          {copy.scan}
        </Link>
        <button
          type="button"
          aria-label={
            fetching ? copy.refreshing : sponsorHackersCopy.refreshLabel
          }
          aria-disabled={fetching || undefined}
          onClick={() => {
            if (!fetching) void refresh();
          }}
          className={cn(
            "inline-flex size-12 shrink-0 items-center justify-center rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
            pressable,
          )}
        >
          <RefreshCw
            aria-hidden
            className={cn("size-5", fetching && "motion-safe:animate-spin")}
          />
        </button>
      </div>

      {/* How they run chats (1-on-1 with N reps, or one group of M). */}
      <ChatSetupCard sponsor={id} request={request} sheet={sheet} />

      {/* This sponsor's own room blocks, with how full each is. */}
      <SponsorHolds
        sponsor={id}
        holds={holds}
        request={request}
        limits={limits}
        onPickCandidates={() => {
          choose("candidates", true);
          tabRefs.current
            .get("candidates")
            ?.scrollIntoView({ block: "nearest" });
        }}
      />

      {/* Your chats | Candidates. Sticks to the top so switching is always
          one tap away on a long list. */}
      <div className="sticky top-0 z-10 -mx-4 bg-dashboard-bg-page/95 px-4 py-2 backdrop-blur-sm sm:-mx-5 sm:px-5">
        <div
          role="tablist"
          aria-label={tabsCopy.label}
          className="grid grid-cols-2 gap-1 rounded-dashboard-lg bg-dashboard-bg-nav p-1"
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const at = TABS.indexOf(tab);
            const next =
              TABS[(at + (event.key === "ArrowRight" ? 1 : -1) + 2) % 2]!;
            choose(next, true);
          }}
        >
          {TABS.map((t) => {
            const on = tab === t;
            return (
              <button
                key={t}
                ref={(el) => {
                  if (el) tabRefs.current.set(t, el);
                  else tabRefs.current.delete(t);
                }}
                type="button"
                role="tab"
                id={`tab-${t}`}
                data-tour={
                  t === "candidates" ? "chats-candidates-tab" : "chats-tab"
                }
                aria-selected={on}
                aria-controls={`panel-${t}`}
                tabIndex={on ? 0 : -1}
                onClick={() => choose(t)}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-dashboard-md px-2 text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                  on
                    ? "bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card"
                    : "text-dashboard-text-medium [@media(hover:hover)]:hover:text-dashboard-text-heavy",
                  pressable,
                )}
              >
                {tabsCopy[t]}
                {counts[t] !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-2 text-xs tabular-nums leading-5",
                      on
                        ? "bg-dashboard-bg-highlight text-dashboard-text-active"
                        : "bg-dashboard-bg-navSelected text-dashboard-text-medium",
                    )}
                  >
                    {counts[t]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section
        id="panel-chats"
        role="tabpanel"
        aria-labelledby="tab-chats"
        hidden={tab !== "chats"}
        // .flex would beat the hidden attribute, so drop it when hidden.
        className={tab === "chats" ? "flex flex-col gap-4" : undefined}
      >
        <p className="m-0 text-base text-dashboard-text-medium">{copy.intro}</p>

        {chats.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-dashboard-2xl bg-dashboard-bg-inset p-8 text-center">
            <ScanLine
              aria-hidden
              className="size-6 text-dashboard-text-light"
              strokeWidth={1.67}
            />
            <p className="m-0 max-w-[360px] text-base text-dashboard-text-medium">
              {copy.empty}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map(([slotTime, group]) => (
              <section
                key={slotTime}
                aria-labelledby={`time-${slotTime}`}
                className="flex flex-col gap-2"
              >
                <h3
                  id={`time-${slotTime}`}
                  className="m-0 flex items-baseline gap-2 text-lg font-semibold tabular-nums text-dashboard-text-heavy"
                >
                  <span>{formatClock(slotTime)}</span>
                  <span className="text-sm font-medium text-dashboard-text-light">
                    <span className="sr-only">, </span>
                    {copy.minutes(group[0]!.durationMinutes)}
                  </span>
                </h3>
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {group.map((chat) => (
                    <ChatRow
                      key={chat.chatId}
                      chat={chat}
                      partner={partners.get(chat.chatId)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <div
        id="panel-candidates"
        data-tour="chats-candidates"
        role="tabpanel"
        aria-labelledby="tab-candidates"
        hidden={tab !== "candidates"}
      >
        {interested ? (
          <InterestedHackers
            sponsor={id}
            data={interested}
            announce={announce}
          />
        ) : (
          <LoadError onRetry={() => void interestedQ.refetch()} />
        )}
      </div>
    </>,
  );
}

function Stat({
  label,
  value,
  of,
}: {
  label: string;
  value: number;
  of?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-dashboard-2xl bg-dashboard-bg-surface px-3 py-3 shadow-dashboard-card">
      <dt className="truncate text-xs font-semibold text-dashboard-text-light">
        {label}
      </dt>
      <dd className="m-0 flex items-baseline gap-1 text-2xl font-bold tabular-nums leading-default text-dashboard-text-heavy">
        {value}
        {of && (
          <span className="truncate text-xs font-medium text-dashboard-text-light">
            {of}
          </span>
        )}
      </dd>
    </div>
  );
}

function ChatRow({
  chat,
  partner,
}: {
  chat: SponsorCoffeeChat;
  partner?: ChatPartner;
}) {
  const name = partner?.name ?? chat.firstName;
  const style = STATUS_STYLE[chat.status];
  const Icon = style.icon;
  const over = chat.status !== "pending" && chat.status !== "accepted";
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-dashboard-2xl bg-dashboard-bg-surface p-4 shadow-dashboard-card",
        over && "bg-dashboard-bg-highlightSubtle shadow-none",
      )}
    >
      <div className="flex items-start gap-3">
        {/* A photo only for hackers who shared their profile. */}
        <HackerAvatar
          name={name}
          github={partner?.shared ? partner.github : null}
          className={cn(over && "opacity-60")}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              "break-words text-base font-semibold leading-snug",
              over ? "text-dashboard-text-light" : "text-dashboard-text-heavy",
            )}
          >
            {name}
          </span>
          {partner?.shared && (
            <span className="break-words text-sm text-dashboard-text-light">
              {partner.team ?? sponsorHackersCopy.noTeam}
            </span>
          )}
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            style.className,
          )}
        >
          <Icon aria-hidden className="size-3.5" />
          {copy.status[chat.status]}
        </span>
      </div>
      <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 text-sm text-dashboard-text-medium">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin
            aria-hidden
            className="size-4 shrink-0 text-dashboard-text-light"
          />
          {chat.room ?? copy.roomTbd}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
          <UserRound
            aria-hidden
            className="size-4 shrink-0 text-dashboard-text-light"
          />
          {chat.repName ? copy.rep(chat.repName) : copy.noRep}
        </span>
      </p>
      {partner?.shared && <HackerLinks name={name} links={partner} />}
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
