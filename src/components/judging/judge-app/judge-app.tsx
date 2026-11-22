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
  clearTeamDraft,
  completeDraft,
} from "~/components/judging/judge-app/judge-rubric";
import {
  type JudgedTeam,
  JudgeTeams,
  type UpcomingTeam,
} from "~/components/judging/judge-app/judge-teams";
import { JudgeComparison } from "~/components/judging/judge-app/judge-comparison";
import { JudgeFinal } from "~/components/judging/judge-app/judge-final";
import { JudgeQuestionBank } from "~/components/judging/judge-app/judge-question-bank";
import {
  JudgeQueueList,
  type QueueLineup,
} from "~/components/judging/judge-app/judge-queue-list";
import { JudgeRescore } from "~/components/judging/judge-app/judge-rescore";
import { VenueMap } from "~/components/judging/judge-app/judge-map";
import {
  type RoundView,
  roundIsOpen,
} from "~/components/judging/judge-app/judge-round";
import { useNow } from "~/components/judging/control/control-shared";
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

// Each rubric category is sent with the mark as the same 0-10 slider value
// the judge set, keyed by criterion id; the server stores each one in its own
// team_mark column (impact_rating, ...), next to the overall 0-10 score:
// { ratings: { impact: 7.5, ... }, notes, superLike }.
const toBreakdown = (ratings: Ratings, notes: string, superLike: boolean) => ({
  ratings: Object.fromEntries(
    RUBRIC.criteria.map((c) => [c.id, ratings[c.id] ?? RUBRIC_MIN]),
  ),
  ...(notes ? { notes } : {}),
  superLike,
});

// Where the judge is in the flow. It is remembered on this device, per judge.
// The server doesn't know about it yet, so it guides this app, not the judging
// router.
//   first     score each assigned team (no project links)
//   rescore   go back through every review
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
  // The stop the score form was opened for. It stays the one being scored even
  // if its round ends, so a score never lands on another team. When the next
  // round starts the judge is moved on to that round's team.
  const [scoringStopId, setScoringStopId] = useState<number | null>(null);
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
  // Polled so a round starting, pausing or ending shows up within seconds.
  const stopsQuery = api.judging.me.getMyStops.useQuery(undefined, {
    refetchInterval: 4000,
  });
  const marksQuery = api.judging.me.getSubmittedTeamMarks.useQuery();
  // A rehearsal restart wipes the scores: a judge left on a later step with
  // none goes back to the first pass.
  useEffect(() => {
    if (!hydrated || stage === "first" || marksQuery.data?.length !== 0) return;
    setStage("first");
    writeStage(judgeKey, "first");
    setRescored([]);
    writeRescored(judgeKey, []);
  }, [hydrated, stage, marksQuery.data, judgeKey]);
  const startStop = api.judging.me.startStop.useMutation();
  const submit = api.judging.me.submitStop.useMutation();
  const edit = api.judging.me.editTeamMark.useMutation();
  const reportAbsent = api.judging.me.reportAbsent.useMutation();

  // Stops still to do that have a team seated (an empty table can't be scored).
  const openStops = (stopsQuery.data?.stops ?? []).filter(
    (s) => (s.status === "assigned" || s.status === "in_progress") && s.team,
  );
  // Timed rounds: round N is every judge's Nth stop, and only the open
  // round's stop can be done. Between rounds (or before round 1) there is none.
  useNow(stopsQuery.data?.round.enabled ? 1000 : 3_600_000);
  const roundView: RoundView | null = stopsQuery.data
    ? { state: stopsQuery.data.round, fetchedAt: stopsQuery.dataUpdatedAt }
    : null;
  const gated = roundView?.state.enabled === true;
  const roundOpen = roundView ? roundIsOpen(roundView, Date.now()) : false;
  // A stop whose round has passed without a score is missed. The judge moves on
  // to the next round and can score it late from My teams.
  const pendingStops = !gated
    ? openStops
    : openStops.filter(
        (s) =>
          s.position > (roundView?.state.round ?? 0) ||
          (s.position === roundView?.state.round && roundOpen),
      );
  const missedStops = gated
    ? openStops
        .filter((s) => !pendingStops.includes(s))
        .sort((a, b) => a.position - b.position)
    : [];
  // New tables to judge (a hand-off, a top-up, or a step left on this phone
  // from a test run) send the judge back to the first pass.
  useEffect(() => {
    if (!hydrated || stage === "first" || pendingStops.length === 0) return;
    setStage("first");
    writeStage(judgeKey, "first");
  }, [hydrated, stage, pendingStops.length, judgeKey]);
  const activeStops = !gated
    ? pendingStops
    : roundOpen
      ? pendingStops.filter((s) => s.position === roundView?.state.round)
      : [];
  const heldStop =
    scoring && scoringStopId !== null
      ? (openStops.find((s) => s.id === scoringStopId) ?? null)
      : (activeStops.find((s) => s.status === "in_progress") ??
        activeStops[0] ??
        null);
  const upcomingStop =
    gated && roundView
      ? pendingStops
          .filter((s) => s.position > roundView.state.round)
          .sort((a, b) => a.position - b.position)[0]
      : undefined;
  // My teams lists the judge's whole route in a fixed order: scored, absent
  // and missed teams stay in place, and the one to judge now is highlighted.
  const currentStopId =
    (activeStops.find((s) => s.status === "in_progress") ?? activeStops[0])
      ?.id ?? null;
  const upcomingTeams: UpcomingTeam[] = (stopsQuery.data?.stops ?? [])
    .filter((s) => s.status !== "cancelled" && s.team)
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      stopId: s.id,
      table: s.table.number,
      teamName: s.team?.name ?? "Team",
      members: s.team?.members ?? [],
      round: gated ? s.position : null,
      absent: s.status === "team_absent",
      late: missedStops.includes(s),
      done: s.status === "done",
      current: s.id === currentStopId,
    }));
  // Teams whose round ended before this judge sent a score.
  const unsentTeams = upcomingTeams.filter((u) => u.late && !u.absent);
  // This judge's stop in the open round, once it's closed: scored or absent.
  const roundStop = gated
    ? (stopsQuery.data?.stops ?? []).find(
        (s) => s.position === roundView?.state.round,
      )
    : undefined;
  const scoredRound = roundStop?.status === "done";
  const absentTable =
    roundStop?.status === "team_absent" ? roundStop.table.number : null;
  // Table numbers from the live stops win over the page-load snapshot, which
  // goes stale when organizers move teams or change routes.
  const tableByTeam: Record<string, number> = { ...initial.tableByTeam };
  for (const s of stopsQuery.data?.stops ?? []) {
    if (s.team) tableByTeam[s.team.id] = s.table.number;
  }
  const held = heldStop?.team ?? null;
  // The judge is finishing a team whose round already ended.
  const heldLate = heldStop !== null && missedStops.includes(heldStop);
  const heldTable = held ? (tableByTeam[held.id] ?? null) : null;

  const results: JudgedTeam[] = (marksQuery.data ?? [])
    .map((m) => ({
      markId: m.id,
      teamId: m.teamId,
      table: tableByTeam[m.teamId] ?? null,
      teamName: m.team.name,
      // Empty for a slider-only mark, so its sliders start empty.
      ratings: { ...m.ratings },
      score: m.score,
      notes: m.notes ?? "",
      superLike: m.superLike,
    }))
    // Oldest first: marks are numbered in the order they were saved.
    .sort((a, b) => a.markId - b.markId);
  const editingTeam =
    editingId !== null
      ? results.find((r) => r.markId === editingId)
      : undefined;

  const allRescored =
    results.length > 0 && results.every((r) => rescored.includes(r.teamId));

  // This judge's queue, and the tables it covers for the map: every team
  // still to judge, in order, with who is on it (from the live stops).
  const queueTeams = pendingStops
    .slice()
    .sort((a, b) => a.position - b.position)
    .flatMap((s) =>
      s.team
        ? [{ id: s.team.id, name: s.team.name, members: s.team.members }]
        : [],
    );
  const queue: QueueLineup = {
    teams: queueTeams,
    hydrated: true,
    requestNewQueue: () => undefined,
    notice: null,
  };
  const judgedIds = new Set(results.map((r) => r.teamId));
  const queueTables = [
    ...new Set(
      queue.teams
        .filter((t) => !judgedIds.has(t.id))
        .map((t) => tableByTeam[t.id])
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

  const started =
    startedLocal ||
    held !== null ||
    results.length > 0 ||
    (stopsQuery.data?.stops ?? []).some(
      (s) =>
        s.status === "done" ||
        s.status === "team_absent" ||
        s.startedAt !== null,
    );
  // No team to judge now and none coming: the Next tab offers the first
  // unfinished one (its round ended before it was sent).
  const nextLate =
    !heldStop && pendingStops.length === 0 && stage === "first"
      ? missedStops[0]
      : undefined;
  // Nothing is left in this judge's queue: time to re-score.
  const queueDone =
    stage === "first" &&
    results.length > 0 &&
    stopsQuery.data !== undefined &&
    pendingStops.length === 0;
  // Once a judge has seen every team, take them to My teams to look over
  // their scores and start re-scoring from there.
  const wasQueueDone = useRef(false);
  useEffect(() => {
    if (queueDone && !wasQueueDone.current) {
      setTab("teams");
      setEditingId(null);
    }
    wasQueueDone.current = queueDone;
  }, [queueDone]);
  let phase: NextPhase;
  if (!hydrated || stopsQuery.isLoading || (findingNext && !held)) {
    phase = "loading";
  } else if (finished) phase = "finished";
  else if (held) phase = "team";
  // Before their first team, judges see who's in their queue (conflicts).
  else if (!started && pendingStops.length > 0) phase = "welcome";
  else if (gated && pendingStops.length > 0) phase = "waitRound";
  else if (nextLate) phase = "team";
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
    setScoringStopId(null);
    setTab("next");
    await Promise.all([marksQuery.refetch(), stopsQuery.refetch()]);
    setFindingNext(false);
  };

  const submitScore = async (s: ScoreSubmission): Promise<boolean> => {
    if (!held || !heldStop) return false;
    const late = heldLate;
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
    // A late score while re-scoring counts as re-scored.
    if (stage === "rescore" && !rescored.includes(held.id)) {
      const next = [...rescored, held.id];
      setRescored(next);
      writeRescored(judgeKey, next);
    }
    await finishTeam();
    if (late) setTab("teams");
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
      else if (missedStops.length === 0) goFinal();
      else {
        // Teams not sent yet come before Final: they're listed in My teams.
        setEditingId(null);
        setTab("teams");
      }
    }
    return true;
  };

  // Tapping a tab always lands on that tab's main screen.
  // Score keeps whatever is open there (a team being judged or edited), and
  // so does a trip to Questions and back.
  const changeTab = (next: JudgeTab) => {
    setTab(next);
    if (next !== "score" && next !== "questions") setEditingId(null);
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
    // Teams not sent yet come first, then the re-scores.
    const unsent = missedStops[0];
    if (unsent) {
      await scoreLate(unsent.id);
      return;
    }
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
    // Already started (e.g. the page reloaded mid-score): just reopen the form.
    if (heldStop.status !== "in_progress") {
      try {
        await startStop.mutateAsync({
          assignmentId: heldStop.id,
          teamId: held.id,
        });
      } catch (error) {
        if (errorCode(error) === "CONFLICT") {
          // The server says why (a different team seated here, or another
          // table still open).
          setNextError(friendlyError(error));
          await utils.judging.me.getMyStops.invalidate();
          return;
        }
      }
    }
    setScoringStopId(heldStop.id);
    setScoring(true);
    setTab("score");
  };

  // Score a team whose round ended first: from My teams, also while re-scoring.
  const scoreLate = async (stopId: number) => {
    const stop = missedStops.find((s) => s.id === stopId);
    if (!stop?.team) return;
    setScoreError(null);
    setFinishError(null);
    if (stop.status !== "in_progress") {
      try {
        await startStop.mutateAsync({
          assignmentId: stop.id,
          teamId: stop.team.id,
        });
      } catch (error) {
        if (errorCode(error) === "CONFLICT") {
          setFinishError(friendlyError(error));
          await utils.judging.me.getMyStops.invalidate();
          return;
        }
      }
    }
    setScoringStopId(stop.id);
    setScoring(true);
    setTab("score");
  };

  // The team being scored was closed meanwhile (scored, absent or moved):
  // leave the form instead of showing another team.
  useEffect(() => {
    if (!scoring || scoringStopId === null || !stopsQuery.data) return;
    const stillOpen = stopsQuery.data.stops.some(
      (s) =>
        s.id === scoringStopId &&
        (s.status === "assigned" || s.status === "in_progress"),
    );
    if (stillOpen) return;
    setScoring(false);
    setScoringStopId(null);
    setNextError("That team was closed meanwhile. Check the Next tab.");
  }, [scoring, scoringStopId, stopsQuery.data]);

  // When a round's time runs out, a fully rated draft for that round's team is
  // sent as if the judge pressed Submit (even from another tab or after a
  // reload). An incomplete draft stays a missed team, scored late from My teams.
  const roundWasOpen = useRef(false);
  const autoSubmitting = useRef(false);
  const autoSubmit = useRef<() => void>(() => undefined);
  autoSubmit.current = () => {
    if (!gated || autoSubmitting.current) return;
    const stop = openStops.find(
      (s) => s.position === roundView?.state.round && s.team,
    );
    const teamId = stop?.team?.id;
    if (!stop || !teamId) return;
    const draft = completeDraft(RUBRIC, judgeKey, teamId);
    if (!draft) return;
    autoSubmitting.current = true;
    void (async () => {
      try {
        await submit.mutateAsync({
          assignmentId: stop.id,
          teamId,
          score: draft.score,
          breakdown: toBreakdown(draft.ratings, draft.notes, draft.superLike),
        });
        clearTeamDraft(judgeKey, teamId);
        if (scoring && scoringStopId === stop.id) await finishTeam();
        else await Promise.all([marksQuery.refetch(), stopsQuery.refetch()]);
      } catch {
        // Not sent: the team stays missed and can be scored late.
      } finally {
        autoSubmitting.current = false;
      }
    })();
  };
  useEffect(() => {
    const justClosed = roundWasOpen.current && !roundOpen;
    roundWasOpen.current = roundOpen;
    if (justClosed) autoSubmit.current();
  }, [roundOpen]);

  // A new round moves the judge on to that round's team, even from a form left
  // open for an earlier one. That team stays under "Not sent yet" on My teams,
  // with its draft kept on this phone.
  const moveToRound = useRef<() => void>(() => undefined);
  moveToRound.current = () => {
    if (!scoring || scoringStopId === null) return;
    const roundTeam = activeStops[0];
    if (!roundTeam || roundTeam.id === scoringStopId) return;
    setScoring(false);
    setScoringStopId(null);
    setTab("next");
  };
  const openRound = roundOpen ? (roundView?.state.round ?? null) : null;
  const lastOpenRound = useRef<number | null>(null);
  useEffect(() => {
    const opened = openRound !== null && openRound !== lastOpenRound.current;
    lastOpenRound.current = openRound;
    if (opened) moveToRound.current();
  }, [openRound]);

  // What the Score tab has open, whichever tab is showing.
  const editOpen = editingTeam !== undefined && canEdit;
  // A missed team can be scored late until the judge submits.
  const canScoreLate = heldLate && stage !== "submitted";
  const scoreOpen =
    (scoring && held !== null && (canScoreNew || canScoreLate)) || editOpen;
  const editing = tab === "score" && editOpen;
  const scoringPage = tab === "score" && scoreOpen;

  let header: ReactNode = null;
  if (tab === "map") {
    // The map page has no header: the map fills the whole screen height.
    header = null;
  } else if (tab === "questions") {
    header = <HeaderRow left="Questions" />;
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

  // The Score tab's screen. It stays mounted (just hidden) while Questions is
  // open, so a half-finished score or edit is still there on the way back.
  // The tab is locked until a team is chosen or opened for edit, so the last
  // message is only a fallback.
  const scoreBody: ReactNode =
    editingTeam && canEdit ? (
      <JudgeEdit
        key={editingTeam.markId}
        team={editingTeam}
        rubric={RUBRIC}
        mode={stage === "rescore" ? "rescore" : "edit"}
        saving={edit.isPending}
        error={editError}
        onSave={saveEdit}
        onCancel={closeEdit}
        onOpenQuestions={() => changeTab("questions")}
      />
    ) : scoring && held && (canScoreNew || canScoreLate) ? (
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
        onOpenQuestions={() => changeTab("questions")}
        late={heldLate}
        onBack={() => {
          // The draft stays on the phone; the team stays in My teams.
          setScoring(false);
          setScoringStopId(null);
          setTab("teams");
        }}
      />
    ) : (
      <p className="px-1 text-base font-medium text-dashboard-text-light">
        {gated && !held
          ? "No round is open for you. Check the Next tab."
          : "Choose a team to judge on the Next tab first."}
      </p>
    );

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
        teamName={held?.name ?? nextLate?.team?.name ?? null}
        members={held?.members ?? nextLate?.team?.members ?? []}
        table={held ? heldTable : (nextLate?.table.number ?? null)}
        late={heldLate || (!held && !!nextLate)}
        judged={results.length}
        busy={findingNext}
        error={nextError ?? finishError}
        tables={queueTables}
        fromTable={results.at(-1)?.table ?? null}
        seen={seenTables}
        onStart={() => void start()}
        onJudge={() =>
          void (held
            ? judgeThisTeam()
            : nextLate
              ? scoreLate(nextLate.id)
              : undefined)
        }
        onOpenMap={() => changeTab("map")}
        onReview={reviewAll}
        onCheckAgain={() => void fetchNext()}
        onStartRescore={() => void startRescore()}
        starting={finishing}
        round={gated ? roundView : null}
        upcoming={
          upcomingStop
            ? { table: upcomingStop.table.number, round: upcomingStop.position }
            : null
        }
        scoredRound={scoredRound}
        absentTable={absentTable}
        queueList={<JudgeQueueList queue={queue} tableByTeam={tableByTeam} />}
      />
    );
  } else if (tab === "score") {
    // Drawn below, outside the animated section (see scoreBody).
    body = null;
  } else if (tab === "questions") {
    body = <JudgeQuestionBank />;
  } else if (tab === "teams") {
    body =
      stage === "submitted" ? (
        <JudgeComparison
          data={initial.comparison}
          rubric={RUBRIC}
          tableByTeam={tableByTeam}
          refreshing={refreshing}
          onRefresh={() => void loadComparison()}
        />
      ) : stage === "final" ? (
        <JudgeFinal
          results={results}
          unsent={unsentTeams}
          error={finishError}
          onEdit={editTeam}
          onScoreLate={(stopId) => void scoreLate(stopId)}
          onSubmit={() => setConfirm("submit")}
        />
      ) : (
        <JudgeTeams
          results={results}
          upcoming={upcomingTeams}
          stage={stage}
          rescored={rescored}
          canSubmit={stage === "rescore" && allRescored}
          error={finishError}
          onEdit={editTeam}
          onScoreLate={(stopId) => void scoreLate(stopId)}
          onStartRescore={
            queueDone && !finishing ? () => void startRescore() : undefined
          }
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
  const scoreShown = tab === "score";
  const scoreKept = scoreShown || (tab === "questions" && scoreOpen);
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
            className={`flex flex-col duration-200 animate-in fade-in-0 slide-in-from-bottom-1 empty:hidden motion-reduce:animate-none ${
              mapPage ? "min-h-0 flex-1" : "gap-3"
            }`}
          >
            {body}
          </div>
          {scoreKept && (
            <div
              // A class, not the hidden attribute: `flex` would override it.
              className={`flex-col gap-3 duration-200 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none ${
                scoreShown ? "flex" : "hidden"
              }`}
            >
              {scoreBody}
            </div>
          )}
        </main>
        <JudgeNav
          active={tab}
          onChange={changeTab}
          disabled={{
            ...(!scoreOpen ? { score: "choose a team to judge first" } : {}),
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
              ? `${
                  unsentTeams.length > 0
                    ? `${unsentTeams.length} ${unsentTeams.length === 1 ? "team hasn't" : "teams haven't"} got your score yet (${unsentTeams
                        .map((u) => u.teamName)
                        .join(", ")}). `
                    : ""
                }You won't be able to change your scores after. You'll then see how they compare with the other judges.`
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
