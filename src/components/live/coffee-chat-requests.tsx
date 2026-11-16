import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Coffee } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { coffeeChatToastId } from "~/components/live/coffee-chats";
import { useNow } from "~/components/sponsors/use-now";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { clockOf, groupChats, weekdayOf } from "~/lib/coffee-chat-view";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.live;
const page = coffeeChatCopy.page;

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

// Coffee chat requests on /live: a toast once per new request (on any tab),
// up until the hacker answers,
// whose "View" opens the Coffee chats tab, and on the home tab a compact
// summary linking there. The full list and answering live in coffee-chats.tsx.
export default function CoffeeChatRequests({
  showSummary,
}: {
  showSummary: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const q = api.coffeeChatRequests.mine.useQuery(undefined, {
    enabled: !!session?.user?.id,
    refetchInterval: 30_000,
  });
  const now = useNow(30_000);
  const toasted = useRef<{ userId: string; ids: Set<string> } | null>(null);
  // Toasts open on this page load, so each closes once it's answered.
  const open = useRef(new Set<string>());
  const userId = session?.user?.id;

  // Toast each pending request once, ever (remembered across reloads). The
  // toast has no timeout: it stays until the request stops waiting for an
  // answer. Answering in the Coffee chats tab closes it right away; each
  // refetch closes toasts for chats answered elsewhere or expired.
  useEffect(() => {
    if (!q.data || !userId) return;
    if (toasted.current?.userId !== userId) {
      for (const id of open.current) toast.dismiss(coffeeChatToastId(id));
      open.current.clear();
      toasted.current = { userId, ids: readToasted(userId) };
    }
    const seen = toasted.current.ids;
    const waiting = new Set(
      q.data
        .filter(
          (chat) => chat.status === "pending" && now < new Date(chat.expiresAt),
        )
        .map((chat) => chat.chatId),
    );
    for (const id of open.current) {
      if (waiting.has(id)) continue;
      toast.dismiss(coffeeChatToastId(id));
      open.current.delete(id);
    }
    let changed = false;
    for (const chat of q.data) {
      if (!waiting.has(chat.chatId) || seen.has(chat.chatId)) continue;
      seen.add(chat.chatId);
      changed = true;
      open.current.add(chat.chatId);
      // One toast per chat (fixed id).
      toast(copy.toast(chat.sponsorName), {
        id: coffeeChatToastId(chat.chatId),
        description: page.when(
          weekdayOf(chat.startsAt),
          clockOf(chat.startsAt),
          chat.durationMinutes,
        ),
        duration: Infinity,
        action: {
          label: copy.toastAction,
          onClick: (event) => {
            // Opening the tab isn't an answer: keep the toast up.
            event.preventDefault();
            void router.push(
              `/live?tab=coffee-chats&chat=${encodeURIComponent(chat.chatId)}`,
              undefined,
              { shallow: true },
            );
          },
        },
      });
    }
    if (changed) saveToasted(userId, seen);
  }, [q.data, userId, router, now]);

  const groups = groupChats(q.data ?? [], now);
  const pending = groups.pending.length;
  const upcoming = groups.upcoming.length;
  if (!showSummary || pending + upcoming === 0) return null;

  return (
    <DashboardPanel className="gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-dashboard-text-heavy">
          <Coffee
            aria-hidden
            className="size-5 text-dashboard-action-primary"
          />
          {page.navName}
        </h2>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {copy.summary(pending, upcoming)}
        </p>
      </div>
      <DashboardButton
        asChild
        variant={pending > 0 ? "primary" : "outline"}
        className="h-11 w-full md:h-11 md:w-fit"
      >
        <Link href="/live?tab=coffee-chats" shallow>
          {copy.viewAll}
        </Link>
      </DashboardButton>
    </DashboardPanel>
  );
}
