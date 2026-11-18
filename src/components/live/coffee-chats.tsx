import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Check, Clock, Copy, MapPin, UserRound } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { useNow } from "~/components/sponsors/use-now";
import { coffeeChatCopy } from "~/content/coffee-chat";
import {
  clockOf,
  groupChats,
  timeLeft,
  viewStatus,
  weekdayOf,
  type ViewStatus,
} from "~/lib/coffee-chat-view";
import { cn } from "~/lib/utils";
import type { MyCoffeeChat } from "~/server/api/routers/coffee-chat-requests";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.page;

type Answer = "accept" | "decline";
type GroupKey = "pending" | "upcoming" | "past";

/** Toast id for a chat's "new request" toast (coffee-chat-requests.tsx). */
export const coffeeChatToastId = (chatId: string) => `coffee-chat-${chatId}`;

// /live?tab=coffee-chats: the hacker's coffee chats, grouped, with Accept /
// Decline for open requests and their hacker code for sponsors to type in.
export default function CoffeeChats() {
  const { data: session } = useSession();
  const signedIn = !!session?.user?.id;
  const utils = api.useUtils();
  const chats = api.coffeeChatRequests.mine.useQuery(undefined, {
    enabled: signedIn,
    refetchInterval: 30_000,
  });
  const now = useNow(15_000);
  const groups = groupChats(chats.data ?? [], now);

  // One persistent live region. Clear, then set, so a repeat is re-read.
  const [announcement, setAnnouncement] = useState("");
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (announceTimer.current) clearTimeout(announceTimer.current);
    },
    [],
  );
  const announce = (message: string) => {
    if (announceTimer.current) clearTimeout(announceTimer.current);
    setAnnouncement("");
    announceTimer.current = setTimeout(() => setAnnouncement(message), 100);
  };

  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<{ chatId: string; message: string }>();

  // Focus targets: chat headings by id, group headings by key.
  const chatHeadings = useRef(new Map<string, HTMLHeadingElement>());
  const groupHeadings = useRef(new Map<GroupKey, HTMLHeadingElement>());
  // Set once the list has refetched; focused after that render.
  const [focusTarget, setFocusTarget] = useState<
    { chatId: string } | { group: GroupKey } | null
  >(null);
  useEffect(() => {
    if (!focusTarget) return;
    if ("chatId" in focusTarget) {
      chatHeadings.current.get(focusTarget.chatId)?.focus();
    } else {
      groupHeadings.current.get(focusTarget.group)?.focus();
    }
    setFocusTarget(null);
  }, [focusTarget]);

  // The toast's "View" opens this tab with ?chat=<id>: focus that chat.
  const searchParams = useSearchParams();
  const wanted = searchParams.get("chat");
  const focusedWanted = useRef<string | null>(null);
  useEffect(() => {
    if (!wanted || focusedWanted.current === wanted || !chats.data) return;
    if (!chatHeadings.current.has(wanted)) return;
    focusedWanted.current = wanted;
    chatHeadings.current.get(wanted)?.focus();
  }, [wanted, chats.data]);

  const respond = api.coffeeChatRequests.respond.useMutation({
    onSuccess: async (_result, { chatId, answer }) => {
      setError(undefined);
      setConfirming(null);
      toast.dismiss(coffeeChatToastId(chatId));
      const chat = chats.data?.find((c) => c.chatId === chatId);
      // Where focus goes once the chat leaves its group: accepted, to the
      // chat itself (now under Upcoming); declined, to the next request
      // waiting, else the group heading.
      const pendingIds = groups.pending.map((c) => c.chatId);
      const nextPending =
        pendingIds[pendingIds.indexOf(chatId) + 1] ??
        pendingIds.find((id) => id !== chatId);
      await utils.coffeeChatRequests.mine.invalidate();
      setFocusTarget(
        answer === "accept"
          ? { chatId }
          : nextPending
            ? { chatId: nextPending }
            : { group: chat?.status === "accepted" ? "upcoming" : "pending" },
      );
      if (chat) {
        announce(
          answer === "accept"
            ? copy.accepted(chat.sponsorName, clockOf(chat.startsAt))
            : copy.declined(chat.sponsorName),
        );
      }
    },
    onError: async (e, { chatId }) => {
      const closed =
        e.data?.code === "CONFLICT" || e.data?.code === "NOT_FOUND";
      const message = closed ? copy.closedError : copy.error;
      setError({ chatId, message });
      setConfirming(null);
      announce(message);
      if (closed) {
        await utils.coffeeChatRequests.mine.invalidate();
        // The chat may have moved to Past: keep focus on it.
        setFocusTarget({ chatId });
      }
    },
  });

  const answer = (chatId: string, value: Answer) => {
    if (respond.isPending) return;
    respond.mutate({ chatId, answer: value });
  };

  const total = chats.data?.length ?? 0;

  const renderChat = (chat: MyCoffeeChat) => (
    <ChatCard
      key={chat.chatId}
      chat={chat}
      status={viewStatus(chat, now)}
      now={now}
      headingRef={(el) => {
        if (el) chatHeadings.current.set(chat.chatId, el);
        else chatHeadings.current.delete(chat.chatId);
      }}
      busy={respond.isPending && respond.variables?.chatId === chat.chatId}
      error={error?.chatId === chat.chatId ? error.message : undefined}
      confirming={confirming === chat.chatId}
      onConfirm={(open) => setConfirming(open ? chat.chatId : null)}
      onAnswer={(value) => answer(chat.chatId, value)}
    />
  );

  const groupHeadingRef =
    (key: GroupKey) => (el: HTMLHeadingElement | null) => {
      if (el) groupHeadings.current.set(key, el);
      else groupHeadings.current.delete(key);
    };

  return (
    <div className="flex flex-col gap-8 font-figtree">
      <p role="status" className="sr-only">
        {announcement}
      </p>
      <p className="m-0 max-w-2xl text-base text-dashboard-text-medium">
        {copy.intro}
      </p>

      {/* The code card only shows once a sponsor has offered a chat. */}
      {total > 0 && <HackerCode signedIn={signedIn} announce={announce} />}

      {chats.isError ? (
        <DashboardPanel className="items-start">
          <p className="m-0 text-base font-semibold text-dashboard-text-warning">
            {copy.loadError}
          </p>
          <DashboardButton
            variant="outline"
            className={cn("h-11", pressable)}
            onClick={() => void chats.refetch()}
          >
            {copy.retry}
          </DashboardButton>
        </DashboardPanel>
      ) : !chats.data ? (
        <p className="m-0 text-base text-dashboard-text-light">
          {copy.loading}
        </p>
      ) : total === 0 ? (
        <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-inset p-6 text-base text-dashboard-text-medium">
          {copy.empty}
        </p>
      ) : (
        <>
          <ChatGroup
            title={copy.groups.pending}
            count={groups.pending.length}
            headingRef={groupHeadingRef("pending")}
            empty={copy.pendingEmpty}
          >
            {groups.pending.map(renderChat)}
          </ChatGroup>
          <ChatGroup
            title={copy.groups.upcoming}
            count={groups.upcoming.length}
            headingRef={groupHeadingRef("upcoming")}
            empty={copy.upcomingEmpty}
          >
            {groups.upcoming.map(renderChat)}
          </ChatGroup>
          {groups.past.length > 0 && (
            <ChatGroup
              title={copy.groups.past}
              count={groups.past.length}
              headingRef={groupHeadingRef("past")}
            >
              {groups.past.map(renderChat)}
            </ChatGroup>
          )}
        </>
      )}
    </div>
  );
}

function ChatGroup({
  title,
  count,
  headingRef,
  empty,
  children,
}: {
  title: string;
  count: number;
  headingRef: (el: HTMLHeadingElement | null) => void;
  empty?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="m-0 flex items-center gap-2 text-lg font-semibold text-dashboard-text-heavy focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
      >
        {title}
        <span className="text-base font-medium text-dashboard-text-light">
          ({count})
        </span>
      </h2>
      {count === 0 ? (
        <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-inset px-4 py-3 text-sm text-dashboard-text-light">
          {empty}
        </p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 lg:grid-cols-2">
          {children}
        </ul>
      )}
    </section>
  );
}

const chipClass: Record<ViewStatus, string> = {
  pending: "bg-dashboard-action-primary text-dashboard-text-inverse",
  accepted: "bg-dashboard-status-live text-dashboard-text-inverse",
  declined: "bg-dashboard-bg-nav text-dashboard-text-medium",
  expired: "bg-dashboard-bg-nav text-dashboard-text-medium",
  cancelled: "bg-dashboard-bg-nav text-dashboard-text-medium",
  finished: "bg-dashboard-bg-nav text-dashboard-text-medium",
};

function ChatCard({
  chat,
  status,
  now,
  headingRef,
  busy,
  error,
  confirming,
  onConfirm,
  onAnswer,
}: {
  chat: MyCoffeeChat;
  status: ViewStatus;
  now: Date;
  headingRef: (el: HTMLHeadingElement | null) => void;
  busy: boolean;
  error?: string;
  confirming: boolean;
  onConfirm: (open: boolean) => void;
  onAnswer: (answer: Answer) => void;
}) {
  const pending = status === "pending";
  const accepted = status === "accepted";
  const closed = !pending && !accepted;
  const time = clockOf(chat.startsAt);
  const left = pending ? timeLeft(chat.expiresAt, now) : null;
  // An accepted chat can still be dropped until it starts.
  const canDrop = accepted && now.getTime() < Date.parse(chat.startsAt);
  const confirmYes = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirming) confirmYes.current?.focus();
  }, [confirming]);
  const closeConfirm = () => {
    onConfirm(false);
    requestAnimationFrame(() => opener.current?.focus());
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-dashboard-2xl border p-4 motion-safe:duration-200 motion-safe:animate-in motion-safe:fade-in sm:p-5",
        pending
          ? "border-dashboard-action-primary bg-dashboard-bg-surface shadow-dashboard-card"
          : accepted
            ? "border-dashboard-border-card bg-dashboard-bg-surface"
            : "border-dashboard-border-subtle bg-dashboard-bg-highlightSubtle",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="m-0 min-w-0 break-words text-lg font-semibold text-dashboard-text-heavy focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
        >
          {chat.sponsorName}
        </h3>
        <span
          className={cn(
            "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
            chipClass[status],
          )}
        >
          {copy.status[status]}
        </span>
      </div>

      <ul
        className={cn(
          "m-0 flex list-none flex-col gap-1.5 p-0 text-sm",
          closed ? "text-dashboard-text-light" : "text-dashboard-text-medium",
        )}
      >
        <li className="flex items-center gap-2">
          <Clock
            aria-hidden
            className="size-4 shrink-0 text-dashboard-text-light"
          />
          {copy.when(weekdayOf(chat.startsAt), time, chat.durationMinutes)}
        </li>
        <li className="flex items-center gap-2">
          <MapPin
            aria-hidden
            className="size-4 shrink-0 text-dashboard-text-light"
          />
          {chat.room ?? copy.roomTbd}
        </li>
        {chat.repName && (
          <li className="flex items-center gap-2">
            <UserRound
              aria-hidden
              className="size-4 shrink-0 text-dashboard-text-light"
            />
            {copy.rep(chat.repName)}
          </li>
        )}
      </ul>

      {pending && (
        <p className="m-0 flex flex-wrap gap-x-2 text-sm font-semibold text-dashboard-text-warning">
          <span>{copy.replyBy(clockOf(chat.expiresAt))}</span>
          {left && (
            <span className="font-medium text-dashboard-text-light">
              · {copy.timeLeft(left)}
            </span>
          )}
        </p>
      )}

      {accepted && (
        <div className="flex flex-col gap-1 rounded-dashboard-md bg-dashboard-bg-highlight px-3 py-2.5">
          <p className="m-0 text-base font-semibold text-dashboard-text-heavy">
            {chat.room ? copy.beAt(chat.room, time) : copy.beAtNoRoom(time)}
          </p>
          {chat.room && (
            <Link
              href="/live?tab=map"
              shallow
              className="inline-flex min-h-11 w-fit cursor-pixel-hover items-center text-sm font-semibold text-dashboard-text-link underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
            >
              {copy.mapLink}
            </Link>
          )}
        </div>
      )}

      {error && (
        <p className="m-0 text-sm font-semibold text-dashboard-text-warning">
          {error}
        </p>
      )}

      {confirming && (pending || canDrop) ? (
        <div className="flex flex-col gap-2 rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-highlightSubtle p-3 motion-safe:duration-150 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
          <p className="m-0 text-sm font-semibold text-dashboard-text-heavy">
            {pending
              ? copy.confirmDecline(chat.sponsorName)
              : copy.confirmCantMake(chat.sponsorName)}
          </p>
          <div className="flex gap-2">
            <DashboardButton
              ref={confirmYes}
              variant="outline"
              className={cn("h-11 flex-1", pressable)}
              aria-label={
                busy
                  ? undefined
                  : pending
                    ? copy.confirmYesLabel(chat.sponsorName)
                    : copy.confirmCantMakeYesLabel(chat.sponsorName)
              }
              aria-disabled={busy || undefined}
              onClick={() => onAnswer("decline")}
            >
              {busy
                ? copy.saving
                : pending
                  ? copy.confirmYes
                  : copy.confirmCantMakeYes}
            </DashboardButton>
            <DashboardButton
              variant="outline"
              className={cn("h-11 flex-1", pressable)}
              aria-label={copy.keepLabel(chat.sponsorName)}
              onClick={closeConfirm}
            >
              {copy.keep}
            </DashboardButton>
          </div>
        </div>
      ) : pending ? (
        <div className="flex gap-2">
          <DashboardButton
            className={cn("h-11 flex-1 md:h-11", pressable)}
            aria-label={busy ? undefined : copy.acceptLabel(chat.sponsorName)}
            aria-disabled={busy || undefined}
            onClick={() => onAnswer("accept")}
          >
            {busy ? copy.saving : copy.accept}
          </DashboardButton>
          <DashboardButton
            ref={opener}
            variant="outline"
            className={cn("h-11 flex-1", pressable)}
            aria-label={copy.declineLabel(chat.sponsorName)}
            aria-disabled={busy || undefined}
            onClick={() => onConfirm(true)}
          >
            {copy.decline}
          </DashboardButton>
        </div>
      ) : canDrop ? (
        <DashboardButton
          ref={opener}
          variant="outline"
          className={cn("h-11 w-fit", pressable)}
          aria-label={copy.cantMakeLabel(chat.sponsorName)}
          aria-disabled={busy || undefined}
          onClick={() => onConfirm(true)}
        >
          {copy.cantMake}
        </DashboardButton>
      ) : null}
    </li>
  );
}

function HackerCode({
  signedIn,
  announce,
}: {
  signedIn: boolean;
  announce: (message: string) => void;
}) {
  const q = api.coffeeChatRequests.myHackerId.useQuery(undefined, {
    enabled: signedIn,
    staleTime: Infinity,
  });
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const code = q.data?.hackerId;
  if (!q.data) return null;

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      announce(copy.codeCopied);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      announce(copy.copyFailed);
    }
  };

  return (
    <DashboardPanel title={copy.codeHeading} className="gap-2">
      {code ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <code className="select-all break-all rounded-dashboard-md bg-dashboard-bg-inset px-3 py-2 font-mono text-xl font-semibold text-dashboard-text-heavy md:text-2xl">
              {code}
            </code>
            <DashboardButton
              variant="outline"
              className={cn("h-11", pressable)}
              aria-label={copy.copyLabel}
              onClick={() => void copyCode()}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? copy.copied : copy.copy}
            </DashboardButton>
          </div>
          <p className="m-0 text-sm text-dashboard-text-light">
            {copy.codeHint}
          </p>
        </>
      ) : (
        <p className="m-0 text-sm text-dashboard-text-light">{copy.noCode}</p>
      )}
    </DashboardPanel>
  );
}
