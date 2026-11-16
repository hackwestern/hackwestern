import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Clock, Coffee, MapPin, UserRound } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { useNow } from "~/components/sponsors/use-now";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { formatClock } from "~/lib/run-of-show";
import { cn } from "~/lib/utils";
import type { MyCoffeeChat } from "~/server/api/routers/coffee-chat-requests";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.live;

/**
 * Chat ids already toasted, per signed-in user, so a reload doesn't toast
 * them again (and a shared device doesn't hide another hacker's toasts).
 */
const toastedKey = (userId: string) => `hw-coffee-chat-toasted:${userId}`;

function readToasted(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(toastedKey(userId));
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveToasted(userId: string, ids: Set<string>) {
  try {
    window.localStorage.setItem(toastedKey(userId), JSON.stringify([...ids]));
  } catch {
    // Private mode or blocked storage: the in-memory set still dedupes.
  }
}

/** "10:40 AM" from an ISO time, in Eastern (where the event is). */
function clockOf(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  });
}

// Coffee chat requests on /live: a toast once per new request (on any tab)
// and, on the home tab, a card per open request with Accept / Decline.
export default function CoffeeChatRequests({
  showCards,
}: {
  showCards: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const utils = api.useUtils();
  const q = api.coffeeChatRequests.mine.useQuery(undefined, {
    enabled: !!session?.user?.id,
    refetchInterval: 30_000,
  });
  const [announcement, setAnnouncement] = useState("");
  const [errorFor, setErrorFor] = useState<string | null>(null);
  const headings = useRef(new Map<string, HTMLHeadingElement>());
  const toasted = useRef<{ userId: string; ids: Set<string> } | null>(null);
  const userId = session?.user?.id;
  // Clear, then set, so the same message twice is read out twice.
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

  // Toast each pending request once, ever (remembered across reloads).
  useEffect(() => {
    if (!q.data || !userId) return;
    if (toasted.current?.userId !== userId) {
      toasted.current = { userId, ids: readToasted(userId) };
    }
    const seen = toasted.current.ids;
    let changed = false;
    for (const chat of q.data) {
      if (chat.status !== "pending" || seen.has(chat.chatId)) continue;
      seen.add(chat.chatId);
      changed = true;
      toast(copy.toast(chat.sponsorName), {
        id: `coffee-chat-${chat.chatId}`,
        description: copy.when(
          formatClock(chat.slotTime),
          chat.durationMinutes,
        ),
        duration: 8000,
        action: {
          label: copy.toastAction,
          onClick: () => {
            const focusCard = () => headings.current.get(chat.chatId)?.focus();
            if (showCards) focusCard();
            else
              void router
                .push("/live?tab=home", undefined, { shallow: true })
                .then(() => setTimeout(focusCard, 50));
          },
        },
      });
    }
    if (changed) saveToasted(userId, seen);
  }, [q.data, userId, router, showCards]);

  const respond = api.coffeeChatRequests.respond.useMutation({
    onSuccess: async (result, { answer }) => {
      setErrorFor(null);
      const chat = q.data?.find((c) => c.chatId === result.chatId);
      await utils.coffeeChatRequests.mine.invalidate();
      if (chat) {
        announce(
          answer === "accept"
            ? copy.accepted(chat.sponsorName, formatClock(chat.slotTime))
            : copy.declined(chat.sponsorName),
        );
      }
      // The card changes under the button: keep focus on its heading.
      headings.current.get(result.chatId)?.focus();
    },
    onError: async (_error, { chatId }) => {
      setErrorFor(chatId);
      announce(copy.error);
      await utils.coffeeChatRequests.mine.invalidate();
    },
  });

  const open = (q.data ?? []).filter(
    (c) => c.status === "pending" || c.status === "accepted",
  );

  return (
    <>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {showCards && open.length > 0 && (
        <DashboardPanel className="gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-dashboard-text-heavy">
              <Coffee
                aria-hidden
                className="size-5 text-dashboard-action-primary"
              />
              {copy.heading}
            </h2>
            <p className="m-0 text-sm text-dashboard-text-light">
              {copy.intro}
            </p>
          </div>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 lg:grid-cols-2">
            {open.map((chat) => (
              <ChatCard
                key={chat.chatId}
                chat={chat}
                headingRef={(el) => {
                  if (el) headings.current.set(chat.chatId, el);
                  else headings.current.delete(chat.chatId);
                }}
                busy={
                  respond.isPending && respond.variables?.chatId === chat.chatId
                }
                error={errorFor === chat.chatId}
                onAnswer={(answer) =>
                  respond.mutate({ chatId: chat.chatId, answer })
                }
              />
            ))}
          </ul>
        </DashboardPanel>
      )}
    </>
  );
}

function ChatCard({
  chat,
  headingRef,
  busy,
  error,
  onAnswer,
}: {
  chat: MyCoffeeChat;
  headingRef: (el: HTMLHeadingElement | null) => void;
  busy: boolean;
  error: boolean;
  onAnswer: (answer: "accept" | "decline") => void;
}) {
  const pending = chat.status === "pending";
  // Declining an accepted chat works until it starts.
  const now = useNow(30_000);
  const started = now.getTime() >= Date.parse(chat.startsAt);
  const answer = (value: "accept" | "decline") => {
    if (!busy) onAnswer(value);
  };
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-dashboard-lg border p-4 motion-safe:duration-200 motion-safe:animate-in motion-safe:fade-in",
        pending
          ? "border-dashboard-action-primary bg-dashboard-bg-highlightSubtle"
          : "border-dashboard-border-subtle bg-dashboard-bg-surface",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="m-0 min-w-0 break-words text-lg font-semibold text-dashboard-text-heavy focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
        >
          {copy.from(chat.sponsorName)}
        </h3>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold",
            pending
              ? "bg-dashboard-action-primary text-dashboard-text-inverse"
              : "bg-dashboard-status-live text-dashboard-text-inverse",
          )}
        >
          {copy.status[chat.status]}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm text-dashboard-text-medium">
        <li className="flex items-center gap-2">
          <Clock
            aria-hidden
            className="size-4 shrink-0 text-dashboard-text-light"
          />
          {copy.when(formatClock(chat.slotTime), chat.durationMinutes)}
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
        <p className="m-0 text-sm font-semibold text-dashboard-text-warning">
          {copy.answerBy(clockOf(chat.expiresAt))}
        </p>
      )}
      {error && (
        <p className="m-0 text-sm font-semibold text-dashboard-text-warning">
          {copy.error}
        </p>
      )}
      <div className="flex gap-2">
        {pending ? (
          <>
            <DashboardButton
              className="h-11 flex-1 md:h-11"
              aria-disabled={busy || undefined}
              onClick={() => answer("accept")}
            >
              {busy ? copy.saving : copy.accept}
            </DashboardButton>
            <DashboardButton
              variant="outline"
              className="h-11 flex-1"
              aria-disabled={busy || undefined}
              onClick={() => answer("decline")}
            >
              {copy.decline}
            </DashboardButton>
          </>
        ) : started ? null : (
          <DashboardButton
            variant="outline"
            className="h-11"
            aria-disabled={busy || undefined}
            onClick={() => answer("decline")}
          >
            {busy ? copy.saving : copy.declineAccepted}
          </DashboardButton>
        )}
      </div>
    </li>
  );
}
