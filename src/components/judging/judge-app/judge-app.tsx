import { useRouter } from "next/router";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  JudgeOfflineBanner,
  useOnline,
} from "~/components/judging/judge-app/judge-offline";
import {
  type EditedScore,
  JudgeEdit,
} from "~/components/judging/judge-app/judge-edit";
import {
  JudgeNav,
  type JudgeTab,
} from "~/components/judging/judge-app/judge-nav";
import {
  JudgeNext,
  type NextPhase,
} from "~/components/judging/judge-app/judge-next";
import {
  JudgeRubric,
  type ScoreSubmission,
} from "~/components/judging/judge-app/judge-rubric";
import {
  type JudgedTeam,
  JudgeTeams,
} from "~/components/judging/judge-app/judge-teams";
import { JudgeComparison } from "~/components/judging/judge-app/judge-comparison";
import { JudgeFinal } from "~/components/judging/judge-app/judge-final";
import {
  JudgeQueueList,
  useQueueLineup,
} from "~/components/judging/judge-app/judge-queue-list";
import { JudgeRescore } from "~/components/judging/judge-app/judge-rescore";
import { VenueMap } from "~/components/judging/judge-app/judge-map";
import { errorCode, friendlyError } from "~/components/judging/shared/judge-ui";
import {
  DEFAULT_RUBRIC,
  RUBRIC_MIN,
  type Ratings,
} from "~/components/judging/shared/rubric-scorer";
import { JudgeConfirm } from "~/components/judging/shared/judge-confirm";
import { type JudgeInitialData } from "~/server/api/utils/judge-data";
import { api } from "~/utils/api";

// The rubric every judge scores with, until rubrics come from the backend.
const RUBRIC = DEFAULT_RUBRIC;

// Ratings are stored by criterion id:
// { ratings: { technical: 7.5, ... }, notes, superLike }.
const toBreakdown = (ratings: Ratings, notes: string, superLike: boolean) => ({
  ratings: Object.fromEntries(
    RUBRIC.criteria.map((c) => [c.id, ratings[c.id] ?? RUBRIC_MIN]),
  ),
  ...(notes ? { notes } : {}),
  superLike,
});

function fromBreakdown(
  b: { ratings?: Record<string, number> } | null,
): Ratings {
  // Marks saved before ratings were keyed by criterion have no `ratings`; the
  // sliders start empty for those.
  return b?.ratings ? { ...b.ratings } : {};
}

// Where the judge is in the flow. It is remembered on this device, per judge.
// The server doesn't know about it yet, so it guides this app, not the judging
// router.
//   first     score each assigned team (no project links)
//   rescore   go back through every review, with the links
//   final     review the final scores and submit
//   submitted scores locked; the comparison with other judges is shown
type Stage = "first" | "rescore" | "final" | "submitted";
const STAGES: readonly string[] = ["first", "rescore", "final", "submitted"];

const stageKey = (judgeKey: string) => `hw13-judge-stage-${judgeKey}`;
const rescoredKey = (judgeKey: string) => `hw13-judge-rescored-${judgeKey}`;

function readStage(judgeKey: string): Stage {
  try {
    const stored = localStorage.getItem(stageKey(judgeKey));
    if (stored && STAGES.includes(stored)) return stored as Stage;
    // Called "compare" before the final submit step existed.
    if (stored === "compare") return "final";
    // Judges who tapped Finish judging before stages existed.
    if (localStorage.getItem(`hw13-judge-finished-${judgeKey}`) === "1") {
      return "submitted";
    }
  } catch {
    // Storage is blocked: start from the first review.
  }
  return "first";
}

function writeStage(judgeKey: string, stage: Stage) {
  try {
    localStorage.setItem(stageKey(judgeKey), stage);
  } catch {
    // Not remembered after a reload: storage is blocked.
  }
}

function readRescored(judgeKey: string): string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(rescoredKey(judgeKey)) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeRescored(judgeKey: string, ids: string[]) {
  try {
    localStorage.setItem(rescoredKey(judgeKey), JSON.stringify(ids));
  } catch {
    // Not remembered after a reload: storage is blocked.
  }
}

function HeaderRow({ left, right }: { left: string; right?: ReactNode }) {
  return (
    <header className="flex min-h-[44px] items-center justify-between gap-3 px-5 pt-4 text-base font-medium text-dashboard-text-light">
      <span>{left}</span>
      {right}
    </header>
  );
}

interface JudgeAppProps {
  /** Keeps this judge's drafts apart from other judges' on a shared phone, e.g. the signed-in user's id. */
  judgeKey: string;
  /** Loaded by the page: which table each team is at. */
  initial: JudgeInitialData;
}

/** Mobile shell for judging. Judges are signed-in users; the server picks each team. */
export function JudgeApp({ judgeKey, initial }: JudgeAppProps) {
  const [tab, setTab] = useState<JudgeTab>("next");
  // True once the judge has pressed "Start judging" on this device.
  const [startedLocal, setStartedLocal] = useState(false);
  // The judge pressed "Judge this team" for the team they hold.
  const [scoring, setScoring] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [findingNext, setFindingNext] = useState(false);
  const [nextError, setNextError] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Which step of judging this judge is on, and which teams they re-scored.
  const [stage, setStage] = useState<Stage>("first");
  const [rescored, setRescored] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [confirm, setConfirm] = useState<"rescore" | "submit" | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  useEffect(() => {
    setStage(readStage(judgeKey));
    setRescored(readRescored(judgeKey));
    setHydrated(true);
  }, [judgeKey]);
  const finished = stage === "submitted";
  const canScoreNew = stage === "first";
  // Any score can be opened and changed from My teams until the judge submits.
  const canEdit = stage !== "submitted";

  const changeStage = (next: Stage) => {
    setStage(next);
    writeStage(judgeKey, next);
  };

  const online = useOnline();
  const utils = api.useUtils();
  const router = useRouter();

  // The comparison with the other judges is only loaded after submitting: the
  // page is reloaded with ?compare=1, which re-runs getServerSideProps. The
  // component keeps its state.
  const [refreshing, setRefreshing] = useState(false);
  const loadComparison = async () => {
    setRefreshing(true);
    try {
      await router.replace(
        { pathname: router.pathname, query: { ...router.query, compare: "1" } },
        undefined,
        { scroll: false },
      );
    } finally {
      setRefreshing(false);
    }
  };
  // A judge who already submitted and reloads the page gets the numbers again.
  const comparisonRequested = useRef(false);
  useEffect(() => {
    if (!hydrated || stage !== "submitted") return;
    if (initial.comparison !== null || comparisonRequested.current) return;
    comparisonRequested.current = true;
    void router.replace(
      { pathname: router.pathname, query: { ...router.query, compare: "1" } },
      undefined,
      { scroll: false },
    );
  }, [hydrated, stage, initial.comparison, router]);
  // The judge's stops (tables) in walking order. The engine fixes the list up
  // front, so there is no "ask for the next team": the stop to do now is the
  // one in progress, else the first one still assigned.
  const stopsQuery = api.judging.me.getMyStops.useQuery();
  const marksQuery = api.judging.me.getSubmittedTeamMarks.useQuery();
  const startStop = api.judging.me.startStop.useMutation();
  const submit = api.judging.me.submitStop.useMutation();
  const edit = api.judging.me.editTeamMark.useMutation();
  const reportAbsent = api.judging.me.reportAbsent.useMutation();

  // Stops still to do that have a team seated (an empty table can't be scored).
  const pendingStops = (stopsQuery.data?.stops ?? []).filter(
    (s) => (s.status === "assigned" || s.status === "in_progress") && s.team,
  );
  const heldStop =
    pendingStops.find((s) => s.status === "in_progress") ??
    pendingStops[0] ??
    null;
  const held = heldStop?.team ?? null;
  const heldTable = held ? (initial.tableByTeam[held.id] ?? null) : null;

  const results: JudgedTeam[] = (marksQuery.data ?? [])
    .map((m) => ({
      markId: m.id,
      teamId: m.teamId,
      table: initial.tableByTeam[m.teamId] ?? null,
      teamName: m.team.name,
      ratings: fromBreakdown(m.scoreBreakdown),
      score: m.score,
      notes: m.scoreBreakdown?.notes ?? "",
      superLike: m.scoreBreakdown?.superLike === true,
    }))
    // Oldest first: marks are numbered in the order they were saved.
    .sort((a, b) => a.markId - b.markId);
  const editingTeam =
    editingId !== null
      ? results.find((r) => r.markId === editingId)
      : undefined;

  const allRescored =
    results.length > 0 && results.every((r) => rescored.includes(r.teamId));

  // This judge's queue (kept on the device for now), and the tables it covers
  // for the map: every queued team not judged yet.
  const queue = useQueueLineup(judgeKey, initial.queueTeams);
  const judgedIds = new Set(results.map((r) => r.teamId));
  const queueTables = [
    ...new Set(
      queue.teams
        .filter((t) => !judgedIds.has(t.id))
        .map((t) => initial.tableByTeam[t.id])
        .filter((n): n is number => n !== undefined && n !== heldTable),
    ),
  ];

  // Tables this judge has already scored, greyed on the map.
  const seenTables = [
    ...new Set(
      results
        .map((r) => r.table)
        .filter((n): n is number => n !== null && n !== heldTable),
    ),
  ];

  const started = startedLocal || held !== null || results.length > 0;
  // Nothing is left in this judge's queue: time to re-score.
  const queueDone =
    stage === "first" &&
    results.length > 0 &&
    stopsQuery.data !== undefined &&
    pendingStops.length === 0;
  let phase: NextPhase;
  if (!hydrated || stopsQuery.isLoading || (findingNext && !held)) {
    phase = "loading";
  } else if (finished) phase = "finished";
  else if (held) phase = "team";
  else if (!started) phase = "welcome";
  else if (queueDone) phase = "rescoreReady";
  else phase = "none";

  // Reloads this judge's stops. Which one is next comes from the list itself.
  const fetchNext = async () => {
    setNextError(null);
    setFindingNext(true);
    try {
      await stopsQuery.refetch();
    } catch (error) {
      setNextError(friendlyError(error));
    } finally {
      setFindingNext(false);
    }
  };

  const start = async () => {
    setStartedLocal(true);
    await fetchNext();
  };

  // After a score or a skip: refresh, go to Next, and fetch the next team.
  const finishTeam = async () => {
    setFindingNext(true);
    setScoring(false);
    setTab("next");
    await Promise.all([marksQuery.refetch(), stopsQuery.refetch()]);
    setFindingNext(false);
  };

  const submitScore = async (s: ScoreSubmission): Promise<boolean> => {
    if (!held || !heldStop) return false;
    setScoreError(null);
    setSending(true);
    try {
      await submit.mutateAsync({
        assignmentId: heldStop.id,
        teamId: held.id,
        score: s.score,
        breakdown: toBreakdown(s.ratings, s.notes, s.superLike),
      });
    } catch (error) {
      setScoreError(
        friendlyError(
          error,
          "You're no longer assigned to this team. Go back to the Next tab.",
        ),
      );
      if (errorCode(error) === "CONFLICT") {
        await utils.judging.me.getMyStops.invalidate();
      }
      setSending(false);
      return false;
    }
    setSending(false);
    await finishTeam();
    return true;
  };

  const teamNotHere = async (): Promise<boolean> => {
    setScoreError(null);
    setSending(true);
    if (!heldStop) return false;
    try {
      await reportAbsent.mutateAsync({
        assignmentId: heldStop.id,
        teamId: held?.id ?? null,
      });
    } catch (error) {
      setScoreError(friendlyError(error));
      setSending(false);
      return false;
    }
    setSending(false);
    await finishTeam();
    return true;
  };

  const saveEdit = async (u: EditedScore): Promise<boolean> => {
    if (editingId === null || !canEdit) return false;
    setEditError(null);
    try {
      await edit.mutateAsync({
        teamMarkId: editingId,
        score: u.score,
        breakdown: toBreakdown(u.ratings, u.notes, u.superLike),
      });
      await marksQuery.refetch();
    } catch (error) {
      setEditError(friendlyError(error));
      return false;
    }

    if (stage !== "rescore") {
      // A change from My teams or the final overview: go back to the list.
      setEditingId(null);
      setTab("teams");
      return true;
    }

    if (editingTeam) {
      // Count this team as re-scored, then go straight to the next one. After
      // the last team, move on to the comparison.
      const next = rescored.includes(editingTeam.teamId)
        ? rescored
        : [...rescored, editingTeam.teamId];
      setRescored(next);
      writeRescored(judgeKey, next);
      const nextTeam = results.find((r) => !next.includes(r.teamId));
      if (nextTeam) setEditingId(nextTeam.markId);
      else goFinal();
    }
    return true;
  };

  // Tapping a tab always lands on that tab's main screen.
  // Score keeps whatever is open there (a team being judged or edited).
  const changeTab = (next: JudgeTab) => {
    setTab(next);
    if (next !== "score") setEditingId(null);
  };

  const reviewAll = () => {
    setTab("teams");
    setEditingId(null);
  };

  const editTeam = (markId: number) => {
    if (!canEdit) return;
    setEditError(null);
    setEditingId(markId);
    setTab("score");
  };

  const closeEdit = () => {
    setEditingId(null);
    setTab(stage === "rescore" ? "next" : "teams");
  };

  // Moves on to the final review, where the judge submits.
  const goFinal = () => {
    changeStage("final");
    setEditingId(null);
    setTab("teams");
  };

  // First review is over: starts the second pass.
  const startRescore = async () => {
    setConfirm(null);
    setFinishError(null);
    setFinishing(true);
    await utils.judging.me.getMyStops.invalidate();
    setScoring(false);
    setFinishing(false);
    if (results.length === 0) {
      goFinal();
      return;
    }
    changeStage("rescore");
    // Straight into the first team still to re-score: the "Time for
    // re-scoring" card already explained what happens next.
    const first = results.find((r) => !rescored.includes(r.teamId));
    if (first) editTeam(first.markId);
    else setTab("next");
  };

  // Locks the scores in this app. Moving to "submitted" also loads the
  // comparison with the other judges (see the effect above).
  const submitAll = () => {
    setConfirm(null);
    changeStage("submitted");
  };

  // Tells the server this stop has started (it stamps started_at and shows the
  // table as being judged). If the team was given to someone else meanwhile, go
  // back and fetch another. Any other failure (like being offline) doesn't
  // block scoring: the stop is closed when the score is submitted.
  const judgeThisTeam = async () => {
    setScoreError(null);
    if (!heldStop || !held) return;
    try {
      await startStop.mutateAsync({
        assignmentId: heldStop.id,
        teamId: held.id,
      });
    } catch (error) {
      if (errorCode(error) === "CONFLICT") {
        // A different team was seated here meanwhile (e.g. after a swap).
        setNextError("That table changed. Reloading your list.");
        await utils.judging.me.getMyStops.invalidate();
        return;
      }
    }
    setScoring(true);
    setTab("score");
  };

  const editing = tab === "score" && editingTeam !== undefined && canEdit;
  const scoringPage =
    tab === "score" && ((scoring && held !== null && canScoreNew) || editing);

  let header: ReactNode = null;
  if (tab === "map") {
    // The map page has no header: the map fills the whole screen height.
    header = null;
  } else if (tab === "teams") {
    header = (
      <HeaderRow
        left={
          stage === "submitted"
            ? "Results"
            : stage === "final"
              ? "Submit"
              : "Review"
        }
      />
    );
  } else if (!scoringPage) {
    // The Score page draws its own header row (team and save status).
    header = (
      <HeaderRow
        left="Judge"
        right={
          results.length > 0 ? (
            <span className="tabular-nums">{results.length} judged</span>
          ) : undefined
        }
      />
    );
  }

  let body: ReactNode;

  if (tab === "next" && (stage === "rescore" || stage === "final")) {
    body = (
      <JudgeRescore
        results={results}
        rescored={rescored}
        allDone={stage === "final" || allRescored}
        onStart={editTeam}
        onFinal={goFinal}
      />
    );
  } else if (tab === "next") {
    body = (
      <JudgeNext
        phase={phase}
        teamName={held?.name ?? null}
        table={heldTable}
        judged={results.length}
        busy={findingNext}
        error={nextError ?? finishError}
        tables={queueTables}
        fromTable={results.at(-1)?.table ?? null}
        seen={seenTables}
        onStart={() => void start()}
        onJudge={() => void judgeThisTeam()}
        onOpenMap={() => changeTab("map")}
        onReview={reviewAll}
        onCheckAgain={() => void fetchNext()}
        onStartRescore={() => void startRescore()}
        starting={finishing}
        queueList={
          <JudgeQueueList queue={queue} tableByTeam={initial.tableByTeam} />
        }
      />
    );
  } else if (tab === "score") {
    // The Score tab is locked until a team is chosen or opened for edit, so the
    // last message is only a fallback.
    body =
      editingTeam && canEdit ? (
        <JudgeEdit
          key={editingTeam.markId}
          team={editingTeam}
          rubric={RUBRIC}
          mode={stage === "rescore" ? "rescore" : "edit"}
          links={
            // Project links stay hidden until re-scoring.
            stage === "first"
              ? undefined
              : initial.linksByTeam[editingTeam.teamId]
          }
          saving={edit.isPending}
          error={editError}
          onSave={saveEdit}
          onCancel={closeEdit}
        />
      ) : scoring && held && canScoreNew ? (
        <JudgeRubric
          key={held.id}
          judgeKey={judgeKey}
          teamId={held.id}
          teamName={held.name}
          table={heldTable}
          rubric={RUBRIC}
          busy={sending}
          error={scoreError}
          onSubmit={submitScore}
          onAbsent={teamNotHere}
        />
      ) : (
        <p className="px-1 text-base font-medium text-dashboard-text-light">
          Choose a team to judge on the Next tab first.
        </p>
      );
  } else if (tab === "teams") {
    body =
      stage === "submitted" ? (
        <JudgeComparison
          data={initial.comparison}
          rubric={RUBRIC}
          tableByTeam={initial.tableByTeam}
          refreshing={refreshing}
          onRefresh={() => void loadComparison()}
        />
      ) : stage === "final" ? (
        <JudgeFinal
          results={results}
          error={finishError}
          onEdit={editTeam}
          onSubmit={() => setConfirm("submit")}
        />
      ) : (
        <JudgeTeams
          results={results}
          stage={stage}
          rescored={rescored}
          canSubmit={stage === "rescore" && allRescored}
          error={finishError}
          onEdit={editTeam}
          onSubmit={() => setConfirm("submit")}
        />
      );
  } else {
    body = (
      <VenueMap
        tables={queueTables}
        current={heldTable ?? undefined}
        seen={seenTables}
        variant="page"
      />
    );
  }

  // Each section opens at the top and fades in, instead of snapping.
  const sectionKey = `${tab}:${phase}:${editingId ?? ""}:${scoring}`;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [sectionKey]);

  const mapPage = tab === "map";

  return (
    <div className="min-h-dvh bg-dashboard-bg-page font-figtree text-dashboard-text-heavy">
      <div
        className={`mx-auto flex w-full flex-col sm:max-w-md sm:border-x sm:border-dashboard-border-subtle ${
          mapPage ? "h-dvh" : "min-h-dvh"
        }`}
      >
        {header}
        <main
          className={
            mapPage
              ? "flex min-h-0 flex-1 flex-col"
              : `flex flex-1 flex-col gap-3 px-5 pb-5 ${
                  scoringPage || editing ? "pt-4" : "pt-3"
                }`
          }
        >
          <div className={mapPage ? "px-3 pt-2 empty:hidden" : "contents"}>
            <JudgeOfflineBanner online={online} />
          </div>
          <div
            key={sectionKey}
            className={`flex flex-col duration-200 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none ${
              mapPage ? "min-h-0 flex-1" : "gap-3"
            }`}
          >
            {body}
          </div>
        </main>
        <JudgeNav
          active={tab}
          onChange={changeTab}
          disabled={{
            ...(!(scoring && held && canScoreNew) && !editing
              ? { score: "choose a team to judge first" }
              : {}),
          }}
          labels={{ teams: stage === "submitted" ? "Results" : "My teams" }}
        />
        <JudgeConfirm
          open={confirm !== null}
          title={
            confirm === "submit" ? "Submit your scores?" : "Start re-scoring?"
          }
          description={
            confirm === "submit"
              ? "You won't be able to change your scores after. You'll then see how they compare with the other judges."
              : "You won't be given any more teams. Next you'll go back through every team you scored."
          }
          confirmLabel={confirm === "submit" ? "Submit" : "Start re-scoring"}
          cancelLabel="Not yet"
          onConfirm={() =>
            confirm === "submit" ? submitAll() : void startRescore()
          }
          onCancel={() => setConfirm(null)}
        />
      </div>
    </div>
  );
}
