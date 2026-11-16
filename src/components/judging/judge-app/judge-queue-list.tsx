import { useEffect, useState } from "react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import { JudgeConfirm } from "~/components/judging/shared/judge-confirm";
import {
  card,
  fullWidth,
  infoBanner,
} from "~/components/judging/shared/judge-ui";
import { type QueueTeam } from "~/server/api/utils/judge-data";

/** How many teams a judge sees lined up. The rest wait as replacements. */
const LINEUP_SIZE = 6;

// PLACEHOLDER: the lineup and queue switches are only remembered on this
// device for now.
// TODO(backend): add the schema for a judge's queue and a judging.me
// .requestNewQueue mutation that records the request for organizers, gives
// the judge a fresh set of teams, and makes sure pickNextTeam only hands out
// teams from that set. Then load the lineup from the server instead.
interface Saved {
  /** Team ids in the judge's queue, in order. */
  lineup: string[];
  /** Team ids from queues the judge asked to switch away from. */
  switched: string[];
}

const storageKey = (judgeKey: string) => `hw13-judge-lineup-${judgeKey}`;

function readSaved(judgeKey: string): Saved {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(storageKey(judgeKey)) ?? "{}",
    ) as Partial<Saved>;
    const ids = (v: unknown) =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string")
        : [];
    return { lineup: ids(parsed.lineup), switched: ids(parsed.switched) };
  } catch {
    return { lineup: [], switched: [] };
  }
}

function writeSaved(judgeKey: string, saved: Saved) {
  try {
    localStorage.setItem(storageKey(judgeKey), JSON.stringify(saved));
  } catch {
    // Not remembered after a reload: storage is blocked.
  }
}

/**
 * Keeps the saved lineup where it can (teams still waiting, not switched
 * away), then tops it up from the queue in the order the server gave.
 */
function reconcile(candidates: QueueTeam[], saved: Saved): Saved {
  const available = new Set(candidates.map((t) => t.id));
  const switched = saved.switched.filter((id) => available.has(id));
  const lineup = saved.lineup.filter(
    (id) => available.has(id) && !switched.includes(id),
  );
  for (const t of candidates) {
    if (lineup.length >= LINEUP_SIZE) break;
    if (!lineup.includes(t.id) && !switched.includes(t.id)) lineup.push(t.id);
  }
  return { lineup, switched };
}

export interface QueueLineup {
  /** The teams in this judge's queue, in order. Empty until loaded. */
  teams: QueueTeam[];
  hydrated: boolean;
  /** Swaps the whole queue for the next teams waiting. */
  requestNewQueue: () => void;
  /** What the last switch did, for the judge. */
  notice: string | null;
}

/** This judge's queue, kept on the device. Shared by the list and the map. */
export function useQueueLineup(
  judgeKey: string,
  candidates: QueueTeam[],
): QueueLineup {
  const [saved, setSaved] = useState<Saved>({ lineup: [], switched: [] });
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const next = reconcile(candidates, readSaved(judgeKey));
    setSaved(next);
    writeSaved(judgeKey, next);
    setHydrated(true);
  }, [judgeKey, candidates]);

  const byId = new Map(candidates.map((t) => [t.id, t]));
  const teams = saved.lineup
    .map((id) => byId.get(id))
    .filter((t): t is QueueTeam => t !== undefined);

  const requestNewQueue = () => {
    const switched = [...saved.switched, ...saved.lineup];
    const next = reconcile(candidates, { lineup: [], switched });
    setSaved(next);
    writeSaved(judgeKey, next);
    setNotice(
      next.lineup.length > 0
        ? "Switch requested. Here is your new queue."
        : "Switch requested. No other teams are waiting right now, so an organizer will find you some.",
    );
  };

  return { teams, hydrated, requestNewQueue, notice };
}

interface JudgeQueueListProps {
  queue: QueueLineup;
  tableByTeam: Record<string, number>;
}

/**
 * The teams lined up for this judge, with their members, shown before Start
 * judging. A judge who knows someone in the queue (a friend, a conflict of
 * interest) can ask for a whole new queue.
 */
export function JudgeQueueList({ queue, tableByTeam }: JudgeQueueListProps) {
  const [asking, setAsking] = useState(false);

  if (!queue.hydrated) return null;

  return (
    <>
      <section aria-label="Teams in your queue" className="flex flex-col gap-2">
        <h2 className="m-0 px-1 text-base font-semibold text-dashboard-text-heavy">
          Teams in your queue
          <span className="ml-2 text-sm font-medium tabular-nums text-dashboard-text-light">
            {queue.teams.length}
          </span>
        </h2>
        {queue.notice && (
          <p role="status" className={infoBanner}>
            {queue.notice}
          </p>
        )}
        {queue.teams.length === 0 ? (
          <p className="m-0 px-1 text-sm font-medium text-dashboard-text-light">
            No teams are lined up yet. You&apos;ll get one when you start.
          </p>
        ) : (
          <>
            <ul className={`${card} m-0 list-none overflow-hidden p-0`}>
              {queue.teams.map((t, i) => {
                const table = tableByTeam[t.id];
                return (
                  <li
                    key={t.id}
                    className={`flex flex-col gap-0.5 px-4 py-3 ${
                      i > 0 ? "border-t border-dashboard-border-subtle" : ""
                    }`}
                  >
                    <span className="truncate text-base font-semibold text-dashboard-text-heavy">
                      {table !== undefined ? `${table} · ` : ""}
                      {t.name}
                    </span>
                    <span className="text-sm leading-snug text-dashboard-text-light">
                      {t.members.length > 0
                        ? t.members.join(", ")
                        : "No members listed"}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="m-0 px-1 text-sm text-dashboard-text-light">
              Know someone on any of these teams? Request a switch to get a
              whole new queue.
            </p>
            <DashboardButton
              type="button"
              variant="outline"
              onClick={() => setAsking(true)}
              className={fullWidth}
            >
              Request a switch
            </DashboardButton>
          </>
        )}
      </section>
      <JudgeConfirm
        open={asking}
        title="Request a new queue?"
        description="Use this if you know someone on one of these teams or can't judge them fairly. Every team in your queue is replaced."
        confirmLabel="Request a switch"
        cancelLabel="Keep my queue"
        onConfirm={() => {
          queue.requestNewQueue();
          setAsking(false);
        }}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}
