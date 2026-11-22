import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  HackerTableCard,
  JudgeMissingButton,
} from "~/components/judging/board/round-board";
import { JudgeFinal } from "~/components/judging/judge-app/judge-final";
import {
  JudgeNav,
  type JudgeTab,
} from "~/components/judging/judge-app/judge-nav";
import {
  JudgeNext,
  type NextPhase,
} from "~/components/judging/judge-app/judge-next";
import { JudgeQueueList } from "~/components/judging/judge-app/judge-queue-list";
import {
  JudgeRubric,
  clearTeamDraft,
} from "~/components/judging/judge-app/judge-rubric";
import {
  RoundClock,
  type RoundView,
} from "~/components/judging/judge-app/judge-round";
import { VenueMap } from "~/components/judging/judge-app/judge-map";
import { JudgeTeams } from "~/components/judging/judge-app/judge-teams";
import { TableMap } from "~/components/judging/map/table-map";
import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import {
  TABLE_BY_TEAM,
  TOUR_ROUNDS,
  TOUR_TABLES,
  TOUR_TEAM,
  TOUR_TEAMS,
  tourHacker,
  tourQueue,
  tourResults,
  tourRound,
  tourRouteDone,
} from "~/components/judging/tour/tour-mocks";
import { judgingTourCopy as copy } from "~/content/judging-tour";

type View = "both" | "judge" | "hacker";
type StopId = keyof typeof copy.stops;

const STOP_IDS = Object.keys(copy.stops) as StopId[];
/** Keeps the tour's sample drafts apart from any real judge on this device. */
const TOUR_JUDGE_KEY = "judging-tour";
const noop = () => undefined;
const yes = async () => true;

/** One screen on a device. A stop can show a few, picked with small tabs. */
export interface Screen {
  label: string;
  node: ReactNode;
}

/* ------------------------------------------------------------------ */
/* Devices                                                             */
/* ------------------------------------------------------------------ */

/** The judge app's header row, as on /judge. */
function JudgeHeader({ left, right }: { left: string; right?: string }) {
  return (
    <header className="flex min-h-[44px] items-center justify-between gap-3 px-5 pt-4 text-base font-medium text-dashboard-text-light">
      <span>{left}</span>
      {right && <span className="tabular-nums">{right}</span>}
    </header>
  );
}

/** The /judge layout inside a phone: header, page, bottom tabs. */
function JudgePhone({
  tab,
  header,
  children,
  teamsLabel,
}: {
  tab: JudgeTab;
  header: ReactNode;
  children: ReactNode;
  teamsLabel?: string;
}) {
  return (
    <div className="flex min-h-full flex-col bg-dashboard-bg-page font-figtree text-dashboard-text-heavy">
      {header}
      <main className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-3">
        {children}
      </main>
      {/* The tabs are part of the picture; the tour moves between stops. */}
      <div className="pointer-events-none sticky bottom-0" aria-hidden="true">
        <JudgeNav
          active={tab}
          onChange={noop}
          labels={teamsLabel ? { teams: teamsLabel } : {}}
        />
      </div>
    </div>
  );
}

/** The Next tab in a given phase, with the sample judge's route. */
function NextTab({
  phase,
  round = null,
  judged = 0,
  upcoming = null,
  scoredRound = false,
  absentTable = null,
  queueList,
}: {
  phase: NextPhase;
  round?: RoundView | null;
  judged?: number;
  upcoming?: { table: number; round: number } | null;
  scoredRound?: boolean;
  absentTable?: number | null;
  queueList?: ReactNode;
}) {
  return (
    <JudgePhone
      tab="next"
      header={
        <JudgeHeader
          left="Judge"
          right={judged > 0 ? `${judged} judged` : undefined}
        />
      }
    >
      <JudgeNext
        phase={phase}
        teamName={TOUR_TEAM.name}
        table={TOUR_TEAM.table}
        members={[...TOUR_TEAM.members]}
        tables={TOUR_TABLES}
        fromTable={null}
        seen={judged > 0 ? TOUR_TABLES.slice(0, judged) : []}
        judged={judged}
        busy={false}
        error={null}
        onStart={noop}
        onJudge={noop}
        onOpenMap={noop}
        onReview={noop}
        onCheckAgain={noop}
        onStartRescore={noop}
        starting={false}
        round={round}
        upcoming={upcoming}
        scoredRound={scoredRound}
        absentTable={absentTable}
        queueList={queueList}
      />
    </JudgePhone>
  );
}

function ScoreTab() {
  return (
    <JudgePhone tab="score" header={null}>
      <div className="pt-1" />
      <JudgeRubric
        judgeKey={TOUR_JUDGE_KEY}
        teamId={TOUR_TEAM.id}
        teamName={TOUR_TEAM.name}
        table={TOUR_TEAM.table}
        rubric={DEFAULT_RUBRIC}
        busy={false}
        error={null}
        onSubmit={yes}
        onAbsent={yes}
      />
    </JudgePhone>
  );
}

/** The hacker portal's Judging Rounds page, as on /rounds. */
function RoundsPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col gap-6 bg-dashboard-bg-page p-5 font-figtree">
      <h1 className="dashboard-h1 m-0">Judging Rounds</h1>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

/** The timer on the big screen at the front of the hall. */
function BigScreen({ view }: { view: RoundView }) {
  return (
    <div className="flex min-h-full flex-col justify-center gap-4 bg-dashboard-bg-page p-5 font-figtree">
      <RoundClock view={view} forJudge={false} />
    </div>
  );
}

/** A device with a URL bar and, when a stop has several screens, small tabs. */
export function Device({
  kind,
  title,
  url,
  screens,
}: {
  kind: "phone" | "browser";
  title: string;
  url: string;
  screens: Screen[];
}) {
  const [index, setIndex] = useState(0);
  // Callers key this by stop, so a new stop starts on its first screen. The
  // screens themselves are rebuilt every second (live sample timers), so
  // resetting on `screens` would throw the viewer back to the first tab.
  const shown = screens[Math.min(index, screens.length - 1)];

  return (
    <figure className="m-0 flex min-w-0 flex-col gap-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold uppercase tracking-wider text-dashboard-text-light">
          {title}
        </span>
        {screens.length > 1 && (
          <span
            role="group"
            aria-label={`${title} screens`}
            className="inline-flex rounded-full border border-dashboard-border-default bg-dashboard-bg-surface p-0.5"
          >
            {screens.map((s, i) => (
              <button
                key={s.label}
                type="button"
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
                className={`min-h-8 rounded-full px-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-action-primary ${
                  i === index
                    ? "bg-dashboard-action-primary text-dashboard-text-inverse"
                    : "text-dashboard-text-heavy"
                }`}
              >
                {s.label}
              </button>
            ))}
          </span>
        )}
      </figcaption>
      <div
        className={`flex flex-col overflow-hidden border border-dashboard-border-default bg-dashboard-bg-surface shadow-[0_18px_40px_-24px_rgba(11,43,74,0.45)] ${
          kind === "phone"
            ? "mx-auto h-[720px] w-full max-w-[380px] rounded-[34px] border-[6px] border-dashboard-text-heavy"
            : "max-h-[680px] min-h-[340px] w-full rounded-2xl"
        }`}
      >
        <div
          className={`flex shrink-0 items-center gap-2 border-b border-dashboard-border-subtle bg-dashboard-bg-nav px-4 font-figtree text-xs font-medium text-dashboard-text-light ${
            kind === "phone" ? "justify-center py-2" : "py-2.5"
          }`}
        >
          {kind === "browser" && (
            <span aria-hidden="true" className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-dashboard-border-control" />
              <span className="size-2.5 rounded-full bg-dashboard-border-control" />
              <span className="size-2.5 rounded-full bg-dashboard-border-control" />
            </span>
          )}
          <span className="truncate rounded-full bg-dashboard-bg-surface px-3 py-0.5">
            {url}
          </span>
        </div>
        <div
          key={`${url}:${shown?.label}`}
          className="relative min-h-0 flex-1 overflow-y-auto"
        >
          {shown?.node}
        </div>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Stops                                                               */
/* ------------------------------------------------------------------ */

/** Counts down from `from` seconds, starting again whenever `key` changes. */
function useCountdown(from: number, key: string) {
  const [left, setLeft] = useState(from);
  useEffect(() => {
    setLeft(from);
    const id = setInterval(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(id);
  }, [from, key]);
  return left;
}

/**
 * Restarts a sample timer every `periodMs`, so a running round shown in the
 * tour never runs all the way out while someone reads.
 */
function useCycle(periodMs: number) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), periodMs);
    return () => clearInterval(id);
  }, [periodMs]);
  return n;
}

export function List({ items }: { items: readonly string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-3 text-base leading-relaxed text-dashboard-text-medium"
        >
          <span
            aria-hidden="true"
            className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-dashboard-action-primary"
          />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function RoleBlock({
  role,
  items,
}: {
  role: string;
  items: readonly string[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-dashboard-text-active">
        {role}
      </h3>
      <List items={items} />
    </section>
  );
}

function QrCards({ view }: { view: View }) {
  const cards = [
    {
      who: "judge" as const,
      src: "/judging-tour/qr-judge.svg",
      ...copy.qr.judge,
    },
    {
      who: "hacker" as const,
      src: "/judging-tour/qr-rounds.svg",
      ...copy.qr.hacker,
    },
  ].filter((c) => view === "both" || view === c.who);
  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
      {cards.map((c) => (
        <div
          key={c.who}
          className="flex flex-col items-center gap-2 rounded-2xl border border-dashboard-border-card bg-dashboard-bg-surface p-4"
        >
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-dashboard-text-active">
            {c.label}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed SVG, no resizing needed */}
          <img
            src={c.src}
            alt={c.alt}
            width={168}
            height={168}
            className="size-[168px]"
          />
          <span className="font-semibold tabular-nums text-dashboard-text-heavy">
            {c.route}
          </span>
        </div>
      ))}
    </div>
  );
}

function Criteria() {
  return (
    <ol className="m-0 grid list-none grid-cols-1 gap-2.5 p-0">
      {DEFAULT_RUBRIC.criteria.map((c, i) => (
        <li
          key={c.id}
          className="grid grid-cols-[2rem_1fr] gap-x-3 rounded-xl border border-dashboard-border-subtle bg-dashboard-bg-surface p-3.5"
        >
          <span className="row-span-2 text-2xl font-bold tabular-nums leading-none text-dashboard-action-primary">
            {i + 1}
          </span>
          <span className="font-bold text-dashboard-text-heavy">{c.name}</span>
          <span className="text-sm leading-relaxed text-dashboard-text-light">
            {c.description}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Routes() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-dashboard-border-subtle bg-dashboard-bg-surface">
      <table className="w-full border-collapse text-left text-sm">
        <tbody>
          {copy.stops.routes.rows.map((r) => (
            <tr
              key={r.route + r.who}
              className="border-b border-dashboard-border-subtle last:border-0"
            >
              <th
                scope="row"
                className="whitespace-nowrap px-4 py-3 align-top text-xs font-bold uppercase tracking-[0.1em] text-dashboard-text-active"
              >
                {r.who}
              </th>
              <td className="whitespace-nowrap px-4 py-3 align-top font-semibold text-dashboard-text-heavy">
                {r.route}
              </td>
              <td className="min-w-[220px] px-4 py-3 align-top leading-relaxed text-dashboard-text-medium">
                {r.what}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The tour                                                            */
/* ------------------------------------------------------------------ */

export function JudgingTour() {
  const [view, setView] = useState<View>("both");
  const [at, setAt] = useState(0);
  const [reported, setReported] = useState(false);
  const id = STOP_IDS[at] ?? "open";
  const stop = copy.stops[id];

  // Each stop can be linked to: /judging-tour#catchup.
  useEffect(() => {
    const read = () => {
      const i = STOP_IDS.indexOf(window.location.hash.slice(1) as StopId);
      if (i >= 0) setAt(i);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const go = useCallback((i: number) => {
    const next = Math.max(0, Math.min(STOP_IDS.length - 1, i));
    setAt(next);
    setReported(false);
    history.replaceState(null, "", `#${STOP_IDS[next]}`);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.closest("input, textarea, [role=slider]") ?? t.isContentEditable)
      )
        return;
      if (e.key === "ArrowRight") go(at + 1);
      if (e.key === "ArrowLeft") go(at - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, go]);

  // The sample Score screen starts empty on every visit.
  useEffect(() => clearTeamDraft(TOUR_JUDGE_KEY, TOUR_TEAM.id), []);

  // On phones the stop list is a sideways strip: keep the current stop in it.
  useEffect(() => {
    document
      .querySelector(
        `nav[aria-label="${copy.stopsLabel}"] [aria-current="step"]`,
      )
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [at]);

  // Timers that keep counting while a stop is open, never reaching 0.
  const cycle = useCycle(30_000);
  const missingIn = useCountdown(20, `${id}`);

  const screens = useMemo((): { judge: Screen[]; hacker: Screen[] } | null => {
    const s = copy.stops;
    const queue = (
      <JudgeQueueList queue={tourQueue} tableByTeam={TABLE_BY_TEAM} />
    );
    const hacker = (
      node: ReactNode,
      label: string = copy.screens.rounds,
    ): Screen => ({
      label,
      node: <RoundsPage>{node}</RoundsPage>,
    });
    switch (id) {
      case "open":
      case "routes":
        return null;
      case "before":
        return {
          judge: [
            {
              label: s.before.screens.welcome,
              node: <NextTab phase="welcome" queueList={queue} />,
            },
            {
              label: s.before.screens.waiting,
              node: (
                <NextTab
                  phase="waitRound"
                  round={tourRound("idle", 0)}
                  upcoming={{ table: TOUR_TEAM.table, round: 1 }}
                />
              ),
            },
          ],
          hacker: [
            hacker(<HackerTableCard mine={tourHacker()} missing={null} />),
          ],
        };
      case "room":
        return {
          judge: [
            {
              label: copy.screens.map,
              node: (
                <div className="flex h-full min-h-[560px] flex-col">
                  <VenueMap
                    tables={TOUR_TABLES}
                    current={TOUR_TEAM.table}
                    variant="page"
                  />
                </div>
              ),
            },
          ],
          hacker: [
            hacker(<HackerTableCard mine={tourHacker()} missing={null} />),
            {
              label: copy.screens.roomMap,
              node: (
                <div className="flex h-full min-h-[460px] flex-col">
                  <TableMap
                    focus={TOUR_TEAM.table}
                    focusLabel={copy.screens.yourTable}
                  />
                </div>
              ),
            },
          ],
        };
      case "walk":
        return {
          judge: [
            {
              label: copy.screens.next,
              node: (
                <NextTab
                  phase="team"
                  round={tourRound("running", 1, 6 * 60_000)}
                />
              ),
            },
          ],
          hacker: [
            hacker(
              <HackerTableCard
                mine={tourHacker({ round: 1, thisRound: "now" })}
                missing={
                  <JudgeMissingButton waitSeconds={missingIn} onReport={noop} />
                }
              />,
              copy.stops.walk.screens.coming,
            ),
            hacker(
              <HackerTableCard
                mine={tourHacker({ round: 1, thisRound: "none" })}
                missing={null}
              />,
              copy.stops.walk.screens.idle,
            ),
          ],
        };
      case "timeup":
        return {
          judge: [
            {
              label: copy.screens.roundOver,
              node: (
                <NextTab
                  phase="waitRound"
                  round={tourRound("closed", 1)}
                  judged={1}
                  upcoming={{ table: TOUR_TEAMS[1].table, round: 2 }}
                />
              ),
            },
          ],
          hacker: [
            hacker(
              <HackerTableCard
                mine={tourHacker({ round: 1, thisRound: "over" })}
                missing={null}
              />,
            ),
            {
              label: copy.screens.bigScreen,
              node: <BigScreen view={tourRound("closed", 1)} />,
            },
          ],
        };
      case "demo":
      case "criteria":
        return {
          judge: [{ label: copy.screens.score, node: <ScoreTab /> }],
          hacker: [
            hacker(
              <HackerTableCard
                mine={tourHacker({
                  round: 1,
                  thisRound: "now",
                  judgeStarted: true,
                })}
                missing={null}
              />,
            ),
          ],
        };
      case "buffer": {
        const buffer = tourRound("running", 1, 88_000);
        return {
          judge: [
            {
              label: copy.screens.buffer,
              node: (
                <NextTab
                  phase="waitRound"
                  round={buffer}
                  judged={1}
                  scoredRound
                  upcoming={{ table: TOUR_TEAMS[1].table, round: 2 }}
                />
              ),
            },
          ],
          hacker: [
            hacker(
              <HackerTableCard
                mine={tourHacker({
                  round: 1,
                  thisRound: "done",
                  judges: { done: 1, total: 3 },
                })}
                missing={null}
              />,
            ),
            {
              label: copy.screens.bigScreen,
              node: <BigScreen view={buffer} />,
            },
          ],
        };
      }
      case "problems":
        return {
          judge: [
            {
              label: copy.screens.teamNotHere,
              node: (
                <NextTab
                  phase="waitRound"
                  round={tourRound("running", 2, 4 * 60_000 + 30_000)}
                  judged={1}
                  absentTable={TOUR_TEAMS[1].table}
                  upcoming={{ table: TOUR_TEAMS[2].table, round: 3 }}
                />
              ),
            },
          ],
          hacker: [
            hacker(
              <HackerTableCard
                mine={tourHacker({
                  round: 2,
                  thisRound: "now",
                  reportedMissing: reported,
                })}
                missing={
                  <JudgeMissingButton
                    waitSeconds={0}
                    onReport={() => setReported(true)}
                  />
                }
              />,
              "Judge missing",
            ),
            hacker(
              <HackerTableCard
                mine={tourHacker({ absent: true })}
                missing={null}
              />,
              "Marked absent",
            ),
          ],
        };
      case "catchup":
        return {
          judge: [
            {
              label: copy.screens.catchUp,
              node: (
                <NextTab
                  phase="waitRound"
                  round={tourRound(
                    "running",
                    TOUR_ROUNDS + 1,
                    5 * 60_000 + 30_000,
                    TOUR_ROUNDS + 1,
                  )}
                  judged={TOUR_TEAMS.length}
                />
              ),
            },
            {
              label: copy.screens.myTeams,
              node: (
                <JudgePhone tab="teams" header={<JudgeHeader left="Review" />}>
                  <JudgeTeams
                    results={tourResults}
                    upcoming={tourRouteDone}
                    stage="first"
                    rescored={[]}
                    canSubmit={false}
                    error={null}
                    onEdit={noop}
                    onScoreLate={noop}
                    onStartRescore={noop}
                    onSubmit={noop}
                  />
                </JudgePhone>
              ),
            },
          ],
          hacker: [
            hacker(
              <HackerTableCard
                mine={tourHacker({
                  round: TOUR_ROUNDS + 1,
                  thisRound: "none",
                  judges: { done: 2, total: 3 },
                })}
                missing={null}
              />,
            ),
          ],
        };
      case "finish":
        return {
          judge: [
            {
              label: copy.screens.rescore,
              node: <NextTab phase="rescoreReady" judged={TOUR_TEAMS.length} />,
            },
            {
              label: copy.screens.submit,
              node: (
                <JudgePhone tab="teams" header={<JudgeHeader left="Submit" />}>
                  <JudgeFinal
                    results={tourResults}
                    unsent={[]}
                    error={null}
                    onEdit={noop}
                    onScoreLate={noop}
                    onSubmit={noop}
                  />
                </JudgePhone>
              ),
            },
          ],
          hacker: [
            hacker(
              <HackerTableCard
                mine={tourHacker({
                  judgedAll: true,
                  judges: { done: 3, total: 3 },
                })}
                missing={null}
              />,
            ),
          ],
        };
      case "roam":
        return {
          judge: [
            {
              label: copy.screens.done,
              node: <NextTab phase="finished" judged={TOUR_TEAMS.length} />,
            },
          ],
          hacker: [
            hacker(
              <HackerTableCard
                mine={tourHacker({
                  judgedAll: true,
                  judges: { done: 3, total: 3 },
                })}
                missing={null}
              />,
            ),
          ],
        };
    }
    // `cycle` restarts running timers before they hit 0.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cycle, missingIn, reported]);

  const showJudge = view !== "hacker";
  const showHacker = view !== "judge";
  const last = at === STOP_IDS.length - 1;
  // Both roles: the judge's phone column, then the hacker's laptop column.
  const cols =
    view === "both"
      ? screens
        ? "lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]"
        : "md:grid-cols-2"
      : "max-w-[760px]";

  return (
    <div className="min-h-dvh bg-dashboard-bg-page font-figtree text-dashboard-text-heavy">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-[max(16px,env(safe-area-inset-left,0px))] py-8 md:gap-10 md:py-12">
        <header className="flex flex-col gap-5">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.16em] text-dashboard-text-active">
            {copy.eyebrow}
          </p>
          <h1 className="m-0 text-balance font-figtree text-4xl font-bold leading-[1.1] md:text-5xl">
            {copy.heading}
          </h1>
          <p className="m-0 max-w-[60ch] text-lg leading-relaxed text-dashboard-text-medium">
            {copy.intro}
          </p>
          <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-dashboard-border-subtle py-4 md:grid-cols-4">
            {copy.facts.map((f) => (
              <div key={f.label} className="flex flex-col gap-0.5">
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-dashboard-text-light">
                  {f.label}
                </dt>
                <dd className="m-0 font-semibold">{f.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* Stops: a row that scrolls on phones, a list on wide screens. */}
          <nav
            aria-label={copy.stopsLabel}
            className="min-w-0 lg:sticky lg:top-6 lg:self-start"
          >
            <ol className="m-0 flex list-none gap-1.5 overflow-x-auto p-0 pb-1 lg:flex-col lg:overflow-visible">
              {STOP_IDS.map((sid, i) => (
                <li key={sid} className="shrink-0">
                  <button
                    type="button"
                    aria-current={i === at ? "step" : undefined}
                    onClick={() => go(i)}
                    className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-dashboard-action-primary ${
                      i === at
                        ? "bg-dashboard-action-primary text-dashboard-text-inverse"
                        : "text-dashboard-text-medium hover:bg-dashboard-bg-nav"
                    }`}
                  >
                    <span className="w-5 text-right tabular-nums opacity-70">
                      {i + 1}
                    </span>
                    <span className="whitespace-nowrap">
                      {copy.stops[sid].nav}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <article className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="m-0 text-sm font-semibold tabular-nums text-dashboard-text-light">
                {copy.stopOf(at + 1, STOP_IDS.length)}
              </p>
              <div
                role="group"
                aria-label={copy.views.label}
                className="inline-flex rounded-full border border-dashboard-border-default bg-dashboard-bg-surface p-0.5"
              >
                {(["both", "judge", "hacker"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={`min-h-9 rounded-full px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-action-primary ${
                      view === v
                        ? "bg-dashboard-action-primary text-dashboard-text-inverse"
                        : "text-dashboard-text-heavy"
                    }`}
                  >
                    {copy.views[v]}
                  </button>
                ))}
              </div>
            </div>

            <h2 className="m-0 text-balance text-3xl font-bold leading-tight md:text-4xl">
              {stop.title}
            </h2>
            {"lead" in stop && (
              <p className="m-0 max-w-[62ch] text-lg font-semibold leading-relaxed text-dashboard-text-medium">
                {stop.lead}
              </p>
            )}

            {id === "open" && <QrCards view={view} />}
            {id === "criteria" && (
              <>
                <Criteria />
                <aside className="flex max-w-[70ch] flex-col gap-2 rounded-2xl border border-dashboard-border-outline bg-dashboard-bg-highlight p-5">
                  <h3 className="m-0 text-lg font-bold">
                    {copy.stops.criteria.adventurous.title}
                  </h3>
                  <p className="m-0 leading-relaxed text-dashboard-text-medium">
                    {copy.stops.criteria.adventurous.body}
                  </p>
                </aside>
              </>
            )}

            {id === "routes" ? (
              <Routes />
            ) : (
              // Judges on the left, hackers on the right: each role's steps sit
              // right above its own screen.
              <div
                className={`grid grid-cols-1 items-start gap-x-8 gap-y-6 ${cols}`}
              >
                {"judge" in stop && showJudge && (
                  <div className="flex min-w-0 flex-col gap-5">
                    <RoleBlock role={copy.views.judge} items={stop.judge} />
                    {screens && (
                      <Device
                        key={id}
                        kind="phone"
                        title={copy.judgeScreen}
                        url={copy.qr.judge.route}
                        screens={screens.judge}
                      />
                    )}
                  </div>
                )}
                {"hacker" in stop && showHacker && (
                  <div className="flex min-w-0 flex-col gap-5">
                    <RoleBlock role={copy.views.hacker} items={stop.hacker} />
                    {screens && (
                      <Device
                        key={id}
                        kind="browser"
                        title={copy.hackerScreen}
                        url={copy.qr.hacker.route}
                        screens={screens.hacker}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {id === "roam" && (
              <aside className="flex max-w-[70ch] flex-col gap-2 rounded-2xl border border-dashboard-border-outline bg-dashboard-bg-highlight p-5">
                <h3 className="m-0 text-lg font-bold">
                  {copy.stops.roam.mlh.title}
                </h3>
                <p className="m-0 leading-relaxed text-dashboard-text-medium">
                  {copy.stops.roam.mlh.body}
                </p>
              </aside>
            )}

            {screens && (
              <p className="m-0 text-sm text-dashboard-text-light">
                {copy.sample}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-dashboard-border-subtle pt-5">
              <button
                type="button"
                onClick={() => go(at - 1)}
                disabled={at === 0}
                className="min-h-11 rounded-xl border border-dashboard-border-default bg-dashboard-bg-surface px-5 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-action-primary disabled:opacity-40"
              >
                {copy.back}
              </button>
              <button
                type="button"
                onClick={() => go(last ? 0 : at + 1)}
                className="min-h-11 rounded-xl bg-dashboard-action-primary px-6 font-semibold text-dashboard-text-inverse focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-action-primary"
              >
                {last
                  ? copy.restart
                  : `${copy.next}: ${copy.stops[STOP_IDS[at + 1] ?? "open"].nav}`}
              </button>
              <span className="ml-auto hidden text-sm text-dashboard-text-light md:inline">
                {copy.keys}
              </span>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
