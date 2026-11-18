import { useEffect, useState } from "react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { dashboardFieldClass } from "~/components/sponsors/coffee-chat-rooms";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { formatClock } from "~/lib/run-of-show";
import type { OrganizerHackerMatch } from "~/server/api/routers/coffee-chat-requests";
import { api } from "~/utils/api";

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

// Organizers book a chat by hand: sponsor, hacker (search), a free start
// time, optional rep. The server applies the sponsor offer's rules and
// leaves it pending for the hacker to accept.
export function AddCoffeeChat() {
  const utils = api.useUtils();
  const sponsors = api.coffeeChatRequests.organizerRooms.useQuery(undefined, {
    retry: 1,
  });
  const [sponsorId, setSponsorId] = useState("");
  const [query, setQuery] = useState("");
  const [hacker, setHacker] = useState<OrganizerHackerMatch | null>(null);
  const [slotTime, setSlotTime] = useState("");
  const [repName, setRepName] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  const search = useDebounced(query.trim(), 250);
  const matches = api.coffeeChatRequests.searchHackers.useQuery(
    { query: search },
    { enabled: !hacker && search.length >= 2, retry: false },
  );
  const times = api.coffeeChatRequests.freeTimes.useQuery(
    { sponsor: sponsorId, userId: hacker?.userId },
    { enabled: Boolean(sponsorId && hacker), retry: false },
  );
  const offer = api.coffeeChatRequests.organizerOffer.useMutation({
    onSuccess: async (chat) => {
      const sponsor = sponsors.data?.sponsors.find(
        (s) => s.sponsorId === sponsorId,
      );
      setAdded(
        copy.added(
          hacker?.name ?? chat.firstName,
          sponsor?.sponsor ?? "",
          formatClock(chat.slotTime),
        ),
      );
      setHacker(null);
      setQuery("");
      setSlotTime("");
      setRepName("");
      await Promise.all([
        utils.coffeeChatRequests.organizerChats.invalidate(),
        utils.coffeeChatRequests.freeTimes.invalidate(),
      ]);
    },
  });

  const registered = (sponsors.data?.sponsors ?? []).filter(
    (s): s is typeof s & { sponsorId: string } => s.sponsorId !== null,
  );
  const openTimes = times.data?.times ?? [];
  const canSubmit =
    Boolean(sponsorId && hacker && slotTime) && !offer.isPending;

  return (
    <section
      aria-labelledby="add-chat"
      className="flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card"
    >
      <div className="flex flex-col gap-1">
        <h2 id="add-chat" className="m-0 text-lg font-semibold">
          {copy.heading}
        </h2>
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.intro}</p>
      </div>
      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit || !hacker) return;
          setAdded(null);
          offer.mutate({
            sponsorId,
            userId: hacker.userId,
            slotTime,
            repName: repName.trim() || undefined,
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-dashboard-text-light">{copy.sponsor}</span>
          <select
            value={sponsorId}
            onChange={(e) => {
              setSponsorId(e.target.value);
              setSlotTime("");
            }}
            className={dashboardFieldClass}
          >
            <option value="">{copy.pickSponsor}</option>
            {registered.map((s) => (
              <option key={s.sponsorId} value={s.sponsorId}>
                {s.sponsor}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-sm">
          {hacker ? (
            <>
              <span className="text-dashboard-text-light">{copy.hacker}</span>
              <div className="flex min-h-10 items-center justify-between gap-2 rounded-dashboard-md bg-dashboard-bg-inset px-3 py-2">
                <span className="min-w-0 break-words">
                  <span className="font-semibold">{hacker.name}</span>
                  <span className="block text-dashboard-text-light">
                    {copy.code(hacker.hackerId)} · {hacker.email}
                  </span>
                </span>
                <DashboardButton
                  type="button"
                  variant="tertiary"
                  onClick={() => {
                    setHacker(null);
                    setSlotTime("");
                  }}
                >
                  {copy.change}
                </DashboardButton>
              </div>
            </>
          ) : (
            <>
              <label
                htmlFor="add-chat-hacker"
                className="text-dashboard-text-light"
              >
                {copy.hacker}
              </label>
              <input
                id="add-chat-hacker"
                type="search"
                autoComplete="off"
                value={query}
                placeholder={copy.hackerPlaceholder}
                onChange={(e) => setQuery(e.target.value)}
                aria-describedby="add-chat-hacker-status"
                className={dashboardFieldClass}
              />
              <HackerMatches
                query={query.trim()}
                settled={search}
                loading={matches.isFetching}
                matches={matches.data}
                onPick={(m) => {
                  setHacker(m);
                  setSlotTime("");
                }}
              />
            </>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-dashboard-text-light">{copy.time}</span>
          <select
            value={slotTime}
            disabled={!sponsorId || !hacker || times.isLoading}
            onChange={(e) => setSlotTime(e.target.value)}
            className={dashboardFieldClass}
          >
            <option value="">{copy.pickTime}</option>
            {openTimes.map((t) => (
              <option key={t.slotTime} value={t.slotTime}>
                {copy.timeOption(formatClock(t.slotTime), t.seatsLeft, t.room)}
              </option>
            ))}
          </select>
          {sponsorId && hacker && times.data && openTimes.length === 0 && (
            <span className="text-dashboard-text-light">{copy.noTimes}</span>
          )}
          {times.error && (
            <span className="text-dashboard-text-warning">
              {times.error.message}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-dashboard-text-light">{copy.rep}</span>
          <input
            value={repName}
            maxLength={255}
            onChange={(e) => setRepName(e.target.value)}
            className={dashboardFieldClass}
          />
        </label>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <DashboardButton
            type="submit"
            disabled={!canSubmit}
            className="w-fit"
          >
            {copy.submit}
          </DashboardButton>
          <p aria-live="polite" className="m-0 text-sm empty:hidden">
            {offer.error ? (
              <span className="text-dashboard-text-warning">
                {offer.error.message || copy.addError}
              </span>
            ) : added ? (
              <span className="text-dashboard-text-medium">{added}</span>
            ) : null}
          </p>
        </div>
      </form>
    </section>
  );
}

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
                  className="flex min-h-11 w-full flex-col items-start rounded-dashboard-md px-3 py-2 text-left [@media(hover:hover)]:hover:bg-dashboard-bg-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
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
