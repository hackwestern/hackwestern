import { useEffect, useState } from "react";
import { hover } from "~/components/internals/interaction";
import { cn } from "~/lib/utils";
import { coffeeChatCopy } from "~/content/coffee-chat";
import type { OrganizerHackerMatch } from "~/server/api/routers/coffee-chat-requests";

const copy = coffeeChatCopy.organizer.add;

/** `value`, once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

// Search results for an organizer adding a hacker by hand.
export function HackerMatches({
  query,
  settled,
  loading,
  matches,
  onPick,
}: {
  query: string;
  settled: string;
  loading: boolean;
  matches: OrganizerHackerMatch[] | undefined;
  onPick: (m: OrganizerHackerMatch) => void;
}) {
  const status =
    query.length === 0
      ? null
      : query.length < 2
        ? copy.typeMore
        : loading || query !== settled
          ? copy.searching
          : matches && matches.length === 0
            ? copy.noMatches
            : null;
  return (
    <>
      <span
        id="add-chat-hacker-status"
        aria-live="polite"
        className="text-dashboard-text-light empty:hidden"
      >
        {status}
      </span>
      {query.length >= 2 &&
        query === settled &&
        matches &&
        matches.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {matches.map((m) => (
              <li key={m.userId}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-start rounded-dashboard-md px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                    hover.highlight,
                  )}
                >
                  <span className="font-semibold">{m.name}</span>
                  <span className="break-all text-dashboard-text-light">
                    {copy.code(m.hackerId)} · {m.email}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
    </>
  );
}
