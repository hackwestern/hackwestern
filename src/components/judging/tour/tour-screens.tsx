import { type ReactNode, useEffect, useState } from "react";

import {
  HackerTableCard,
  JudgeMissingButton,
  type TeamJudging,
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
import { type RoundView } from "~/components/judging/judge-app/judge-round";
import { JudgeTeams } from "~/components/judging/judge-app/judge-teams";
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
import Sidebar from "~/components/live/sidebar";
import Topbar from "~/components/live/topbar";
import { api } from "~/utils/api";

/** Keeps the tour's sample drafts apart from any real judge on this device. */
const TOUR_JUDGE_KEY = "judging-tour";
const noop = () => undefined;
const yes = async () => true;

export type JudgeScene =
  | "welcome"
  | "waiting"
  | "team"
  | "score"
  | "buffer"
  | "over"
  | "catchup"
  | "myTeams"
  | "rescore"
  | "final"
  | "done";

export type HackerScene =
  | "idle"
  | "coming"
  | "none"
  | "here"
  | "judgedRound"
  | "over"
  | "absent"
  | "judged";

/* ------------------------------------------------------------------ */
/* Judge app, as on /judge                                             */
/* ------------------------------------------------------------------ */

function HeaderRow({ left, right }: { left: string; right?: string }) {
  return (
    <header className="flex min-h-[44px] items-center justify-between gap-3 px-5 pt-4 text-base font-medium text-dashboard-text-light">
      <span>{left}</span>
      {right && <span className="tabular-nums">{right}</span>}
    </header>
  );
}

/** The /judge layout: header, page, bottom tabs. Fills its parent. */
function JudgeLayout({
  tab,
  header,
  children,
}: {
  tab: JudgeTab;
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col bg-dashboard-bg-page font-figtree text-dashboard-text-heavy sm:border-x sm:border-dashboard-border-subtle">
      {header}
      <main className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-3">
        {children}
      </main>
      {/* Tabs are part of the picture; the tour moves the story along. */}
      <div className="pointer-events-none sticky bottom-0">
        <JudgeNav active={tab} onChange={noop} />
      </div>
    </div>
  );
}

function Next({
  phase,
  round = null,
  judged = 0,
  upcoming = null,
  scoredRound = false,
}: {
  phase: NextPhase;
  round?: RoundView | null;
  judged?: number;
  upcoming?: { table: number; round: number } | null;
  scoredRound?: boolean;
}) {
  return (
    <JudgeLayout
      tab="next"
      header={
        <HeaderRow
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
        absentTable={null}
        queueList={
          <JudgeQueueList queue={tourQueue} tableByTeam={TABLE_BY_TEAM} />
        }
      />
    </JudgeLayout>
  );
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

/** The real judge app, at the moment a tour step needs. */
export function JudgeScreen({ scene }: { scene: JudgeScene }) {
  const cycle = useCycle(30_000);
  // The sample Score screen starts empty on every visit.
  useEffect(() => clearTeamDraft(TOUR_JUDGE_KEY, TOUR_TEAM.id), []);
  const all = TOUR_TEAMS.length;
  const second = TOUR_TEAMS[1].table;

  switch (scene) {
    case "welcome":
      return <Next phase="welcome" />;
    case "waiting":
      return (
        <Next
          phase="waitRound"
          round={tourRound("idle", 0)}
          upcoming={{ table: TOUR_TEAM.table, round: 1 }}
        />
      );
    case "team":
      return (
        <Next
          key={cycle}
          phase="team"
          round={tourRound("running", 1, 4 * 60_000 + 40_000)}
        />
      );
    case "score":
      return (
        <JudgeLayout tab="score" header={null}>
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
        </JudgeLayout>
      );
    case "buffer":
      return (
        <Next
          key={cycle}
          phase="waitRound"
          round={tourRound("running", 1, 88_000)}
          judged={1}
          scoredRound
          upcoming={{ table: second, round: 2 }}
        />
      );
    case "over":
      return (
        <Next
          phase="waitRound"
          round={tourRound("closed", 1)}
          judged={1}
          upcoming={{ table: second, round: 2 }}
        />
      );
    case "catchup":
      return (
        <Next
          key={cycle}
          phase="waitRound"
          round={tourRound(
            "running",
            TOUR_ROUNDS + 1,
            4 * 60_000,
            TOUR_ROUNDS + 1,
          )}
          judged={all}
        />
      );
    case "myTeams":
      return (
        <JudgeLayout tab="teams" header={<HeaderRow left="Review" />}>
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
        </JudgeLayout>
      );
    case "rescore":
      return <Next phase="rescoreReady" judged={all} />;
    case "final":
      return (
        <JudgeLayout tab="teams" header={<HeaderRow left="Submit" />}>
          <JudgeFinal
            results={tourResults}
            unsent={[]}
            error={null}
            onEdit={noop}
            onScoreLate={noop}
            onSubmit={noop}
          />
        </JudgeLayout>
      );
    case "done":
      return <Next phase="finished" judged={all} />;
  }
}

/* ------------------------------------------------------------------ */
/* Hacker portal, as on /rounds                                        */
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

const HACKER: Record<HackerScene, Partial<NonNullable<TeamJudging>>> = {
  idle: {},
  coming: { round: 1, thisRound: "now" },
  none: { round: 2, thisRound: "none" },
  here: { round: 1, thisRound: "now", judgeStarted: true },
  judgedRound: { round: 1, thisRound: "done", judges: { done: 1, total: 3 } },
  over: { round: 1, thisRound: "over" },
  absent: { absent: true },
  judged: { judgedAll: true, judges: { done: 3, total: 3 } },
};

/**
 * The real hacker portal page for Judging Rounds: top bar, sidebar and the
 * team card. The sidebar shows Judging Rounds only while organizers have it
 * switched on, so the tour fills in that answer instead of asking the server.
 */
export function HackerScreen({ scene }: { scene: HackerScene }) {
  const utils = api.useUtils();
  useState(() => {
    utils.judging.board.getAccess.setData(undefined, {
      isOrganizer: false,
      shownToHackers: true,
      visible: true,
    });
    return null;
  });
  const missingIn = useCountdown(20, scene);

  return (
    <div className="flex h-full min-w-0 flex-col bg-dashboard-bg-page font-figtree md:flex-row">
      <Topbar title="Judging Rounds" />
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col gap-8 overflow-y-auto p-5 md:gap-10 md:p-12">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <h1 className="dashboard-h1">Judging Rounds</h1>
        </div>
        <div className="flex flex-col gap-4 font-figtree">
          <HackerTableCard
            mine={tourHacker(HACKER[scene])}
            missing={
              <JudgeMissingButton
                waitSeconds={scene === "coming" ? missingIn : 0}
                onReport={noop}
              />
            }
          />
        </div>
      </main>
    </div>
  );
}
