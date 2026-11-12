import { useRouter } from "next/router";
import { type ReactNode, useEffect, useState } from "react";

import {
  JudgeOfflineBanner,
  useOnline,
} from "~/components/judging/judge-app/judge-offline";
import {
  type EditedScore,
  JudgeEdit,
} from "~/components/judging/dashboard/judge-edit";
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
import { JudgeCalibration } from "~/components/judging/judge-app/judge-calibration";
import { VenueMap } from "~/components/judging/judge-app/judge-map";
import {
  errorCode,
  focusRing,
  friendlyError,
} from "~/components/judging/shared/judge-ui";
import {
  DEFAULT_RUBRIC,
  type Ratings,
} from "~/components/judging/shared/rubric-scorer";
import { JudgeConfirm } from "~/components/judging/shared/judge-confirm";
import { type JudgeInitialData } from "~/server/api/utils/judge-data";
import { api } from "~/utils/api";

// The rubric every judge scores with, until rubrics come from the backend.
const RUBRIC = DEFAULT_RUBRIC;

// Each rubric category is stored on the mark as the same 0-100 slider value
// the judge set (team_mark.score_breakdown), next to the overall 0-100 score.
// Ratings are stored by criterion id: { ratings: { technical: 80, ... }, notes }.
const toBreakdown = (ratings: Ratings, notes: string) => ({
  ratings: Object.fromEntries(
    RUBRIC.criteria.map((c) => [c.id, ratings[c.id] ?? 0]),
  ),
  ...(notes ? { notes } : {}),
});

function fromBreakdown(
  b: { ratings?: Record<string, number> } | null,
): Ratings {
  // Marks saved before ratings were keyed by criterion have no `ratings`; the
  // sliders start empty for those.
  return b?.ratings ? { ...b.ratings } : {};
}

// Finishing is remembered on this device, per judge. The server doesn't know
// about it yet, so it locks this app, not the judging router.
const finishedKey = (judgeKey: string) => `hw13-judge-finished-${judgeKey}`;

function readFinished(judgeKey: string): boolean {
  try {
    return localStorage.getItem(finishedKey(judgeKey)) === "1";
  } catch {
    return false;
  }
}

function writeFinished(judgeKey: string) {
  try {
    localStorage.setItem(finishedKey(judgeKey), "1");
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

  // Finish judging: locks the scores in this app.
  const [finished, setFinished] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  useEffect(() => {
    setFinished(readFinished(judgeKey));
    setHydrated(true);
  }, [judgeKey]);

  const online = useOnline();
  const utils = api.useUtils();
  const router = useRouter();

  // Organizers can swap the map for a calibration summary. Everyone else only
  // ever sees the map.
  const [mapView, setMapView] = useState<"map" | "calibration">("map");
  const [refreshing, setRefreshing] = useState(false);
  const calibration = initial.isOrganizer ? initial.calibration : null;
  const showCalibration = calibration !== null && mapView === "calibration";

  // Re-runs getServerSideProps for the page, which reloads the numbers. The
  // component keeps its state.
  const refreshCalibration = async () => {
    setRefreshing(true);
    try {
      await router.replace(router.asPath, undefined, { scroll: false });
    } finally {
      setRefreshing(false);
    }
  };
  const changeMapView = (view: "map" | "calibration") => {
    setMapView(view);
    if (view === "calibration") void refreshCalibration();
  };
  const assignment = api.judging.me.getCurrentAssignment.useQuery();
  const marksQuery = api.judging.me.getSubmittedTeamMarks.useQuery();
  const getNext = api.judging.me.getNextTeam.useMutation();
  const submit = api.judging.me.submitTeamMark.useMutation();
  const edit = api.judging.me.editTeamMark.useMutation();
  const startTeam = api.judging.me.startTeam.useMutation();
  const skip = api.judging.me.skipAssignment.useMutation();

  const held = assignment.data?.team ?? null;
  const heldTable = held ? (initial.tableByTeam[held.id] ?? null) : null;

  const results: JudgedTeam[] = (marksQuery.data ?? []).map((m) => ({
    markId: m.id,
    teamId: m.teamId,
    table: initial.tableByTeam[m.teamId] ?? null,
    teamName: m.team.name,
    ratings: fromBreakdown(m.scoreBreakdown),
    score: Math.round(m.score),
    notes: m.scoreBreakdown?.notes ?? "",
  }));
  const editingTeam =
    editingId !== null ? results.find((r) => r.markId === editingId) : undefined;

  const started = startedLocal || held !== null || results.length > 0;
  let phase: NextPhase;
  if (!hydrated || assignment.isLoading || (findingNext && !held)) {
    phase = "loading";
  } else if (finished) phase = "finished";
  else if (held) phase = "team";
  else if (!started) phase = "welcome";
  else phase = "none";

  // Asks the server for the next team. A CONFLICT means nothing is waiting.
  const fetchNext = async () => {
    setNextError(null);
    setFindingNext(true);
    try {
      await getNext.mutateAsync();
    } catch (error) {
      if (errorCode(error) !== "CONFLICT") setNextError(friendlyError(error));
    } finally {
      await utils.judging.me.getCurrentAssignment.invalidate();
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
    await Promise.all([
      marksQuery.refetch(),
      utils.judging.me.getCurrentAssignment.invalidate(),
    ]);
    await fetchNext();
  };

  const submitScore = async (s: ScoreSubmission): Promise<boolean> => {
    if (!held) return false;
    setScoreError(null);
    setSending(true);
    try {
      await submit.mutateAsync({
        teamId: held.id,
        score: s.score,
        breakdown: toBreakdown(s.ratings, s.notes),
      });
    } catch (error) {
      setScoreError(
        friendlyError(
          error,
          "You're no longer assigned to this team. Go back to the Next tab.",
        ),
      );
      if (errorCode(error) === "CONFLICT") {
        await utils.judging.me.getCurrentAssignment.invalidate();
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
    try {
      await skip.mutateAsync({});
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
    if (editingId === null || finished) return false;
    setEditError(null);
    try {
      await edit.mutateAsync({
        teamMarkId: editingId,
        score: u.score,
        breakdown: toBreakdown(u.ratings, u.notes),
      });
      await marksQuery.refetch();
    } catch (error) {
      setEditError(friendlyError(error));
      return false;
    }
    closeEdit();
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
    if (finished) return;
    setEditError(null);
    setEditingId(markId);
    setTab("score");
  };

  const closeEdit = () => {
    setEditingId(null);
    setTab("teams");
  };

  // Releases the team the judge is holding (so another judge can have it),
  // then locks the app. A CONFLICT just means they held nothing.
  const finishJudging = async () => {
    setConfirmFinish(false);
    setFinishError(null);
    setFinishing(true);
    try {
      await skip.mutateAsync({ released: true });
    } catch (error) {
      if (errorCode(error) !== "CONFLICT") {
        setFinishError(friendlyError(error));
        setFinishing(false);
        return;
      }
    }
    await utils.judging.me.getCurrentAssignment.invalidate();
    writeFinished(judgeKey);
    setFinished(true);
    setScoring(false);
    setFinishing(false);
  };

  // Tells the server this stop has started (it stamps started_at and shows the
  // table as being judged). If the team was given to someone else meanwhile, go
  // back and fetch another. Any other failure (like being offline) doesn't
  // block scoring: the stop is closed when the score is submitted.
  const judgeThisTeam = async () => {
    setScoreError(null);
    try {
      await startTeam.mutateAsync();
    } catch (error) {
      if (errorCode(error) === "CONFLICT") {
        setNextError("That team was given to someone else. Finding you another.");
        await utils.judging.me.getCurrentAssignment.invalidate();
        return;
      }
    }
    setScoring(true);
    setTab("score");
  };

  const editing = tab === "score" && editingTeam !== undefined && !finished;
  const scoringPage = tab === "score" && ((scoring && held !== null) || editing);

  let header: ReactNode = null;
  if (tab === "map") {
    // The map page has no header: the map fills the whole screen height.
    header = null;
  } else if (tab === "teams") {
    header = <HeaderRow left="Review" />;
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
  if (tab === "next") {
    body = (
      <JudgeNext
        phase={phase}
        teamName={held?.name ?? null}
        table={heldTable}
        judged={results.length}
        busy={findingNext}
        error={nextError}
        onStart={() => void start()}
        onJudge={() => void judgeThisTeam()}
        onOpenMap={() => changeTab("map")}
        onReview={reviewAll}
        onCheckAgain={() => void fetchNext()}
      />
    );
  } else if (tab === "score") {
    // The Score tab is locked until a team is chosen or opened for edit, so the
    // last message is only a fallback.
    body = editingTeam && !finished ? (
      <JudgeEdit
        key={editingTeam.markId}
        team={editingTeam}
        rubric={RUBRIC}
        saving={edit.isPending}
        error={editError}
        onSave={saveEdit}
        onCancel={closeEdit}
      />
    ) : scoring && held && !finished ? (
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
    body = (
      <JudgeTeams
        results={results}
        finished={finished}
        finishing={finishing}
        error={finishError}
        onEdit={editTeam}
        onFinish={() => setConfirmFinish(true)}
      />
    );
  } else {
    body = (
      <>
        {calibration && (
          <div
            role="group"
            aria-label="Map view"
            className="flex shrink-0 gap-2 px-3 pb-2 pt-2"
          >
            {(["map", "calibration"] as const).map((view) => (
              <button
                key={view}
                type="button"
                aria-pressed={mapView === view}
                onClick={() => changeMapView(view)}
                className={`min-h-11 flex-1 rounded-dashboard-lg border px-3 text-base font-semibold ${focusRing} ${
                  mapView === view
                    ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
                    : "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-heavy"
                }`}
              >
                {view === "map" ? "Map" : "Calibration"}
              </button>
            ))}
          </div>
        )}
        {showCalibration ? (
          // The toggle stays put; the summary scrolls under it.
          <div className="min-h-0 flex-1 overflow-y-auto">
            <JudgeCalibration
              data={calibration}
              rubric={RUBRIC}
              tableByTeam={initial.tableByTeam}
              refreshing={refreshing}
              onRefresh={() => void refreshCalibration()}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <VenueMap tables={[]} current={heldTable ?? undefined} variant="page" />
          </div>
        )}
      </>
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
          disabled={!(scoring && held && !finished) && !editing ? ["score"] : []}
        />
        <JudgeConfirm
          open={confirmFinish}
          title="Finish judging?"
          description="You won't be able to change your scores after."
          confirmLabel="Finish judging"
          cancelLabel="Not yet"
          onConfirm={() => void finishJudging()}
          onCancel={() => setConfirmFinish(false)}
        />
      </div>
    </div>
  );
}