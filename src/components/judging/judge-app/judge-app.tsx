import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  JudgeOfflineBanner,
  readProgress,
  sendScores,
  useOutbox,
  writeProgress,
} from "~/components/judging/judge-app/judge-offline";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { card } from "~/components/judging/shared/judge-ui";
import { JudgeEdit } from "~/components/judging/dashboard/judge-edit";
import {
  JudgeNav,
  type JudgeTab,
} from "~/components/judging/judge-app/judge-nav";
import { JudgeNext } from "~/components/judging/judge-app/judge-next";
import { JudgeImpromptu } from "~/components/judging/judge-app/judge-impromptu";
import {
  JudgeRubric,
  type ScoreSubmission,
} from "~/components/judging/judge-app/judge-rubric";
import {
  type JudgedTeam,
  JudgeTeams,
  type SubmitStatus,
} from "~/components/judging/judge-app/judge-teams";
import { JudgeWrongTable } from "~/components/judging/judge-app/judge-wrong-table";
import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import { VenueMap } from "~/components/judging/judge-app/judge-map";

// Placeholder team name until teams come from the database.
const TEAM_NAME = "Team";

// Placeholder data until the backend exists.
const PLACEHOLDER = {
  label: "Judge 12",
  tables: [41, 42, 43, 44, 45, 46],
  // Tables already judged when the page opens. The next is tables[done].
  done: 1,
  // How many judges a table has had. Placeholder for every table.
  impromptu: { judgesSoFar: 1, judgesNeeded: 3 },
  // The rubric this judge scores with. Will come from the backend.
  rubric: DEFAULT_RUBRIC,
  // Teams judged so far. These match the first three tables above.
  results: [
    {
      table: 41,
      teamName: TEAM_NAME,
      absent: false,
      ratings: { idea: 70, technical: 60, design: 60, pitch: 66 },
      score: 64,
      notes: "",
    },
    {
      table: 42,
      teamName: TEAM_NAME,
      absent: true,
      ratings: {},
      score: null,
      notes: "",
    },
    {
      table: 43,
      teamName: TEAM_NAME,
      absent: false,
      ratings: { idea: 75, technical: 70, design: 72, pitch: 71 },
      score: 72,
      notes: "Great live demo.",
    },
  ] satisfies JudgedTeam[],
};

function HeaderRow({ left, right }: { left: string; right?: ReactNode }) {
  return (
    <header className="flex min-h-[44px] items-center justify-between gap-3 px-5 pt-4 text-base font-medium text-dashboard-text-light">
      <span>{left}</span>
      {right}
    </header>
  );
}

interface JudgeAppProps {
  /** Keeps this judge's saved progress apart from other judges' on a shared phone, e.g. the signed-in user's id. */
  judgeKey?: string;
}

/** Mobile shell for judging. Judges are signed-in users. */
export function JudgeApp({ judgeKey = "demo" }: JudgeAppProps) {
  const [tab, setTab] = useState<JudgeTab>("next");
  const [started, setStarted] = useState(false);
  // Tables already judged, so the next one is tables[done].
  const [done, setDone] = useState(PLACEHOLDER.done);
  // Sub-screens: "Wrong table?" and "Judge another team" live under Next, and
  // editing a judged team under My teams.
  const [nextView, setNextView] = useState<
    "main" | "wrong-table" | "impromptu"
  >("main");
  const [editingTable, setEditingTable] = useState<number | null>(null);
  // Set when the judge says they are at a different table than expected.
  const [override, setOverride] = useState<number | null>(null);
  // The team being judged right now. Null until the judge picks one with
  // "Judge this team" or "Judge another team"; the Score tab stays locked until
  // then. adHoc means the table was typed in, on top of the assigned ones.
  const [judging, setJudging] = useState<{
    table: number;
    adHoc: boolean;
  } | null>(null);
  // Everything scored or marked absent, waiting for the final submit.
  const [results, setResults] = useState<JudgedTeam[]>(PLACEHOLDER.results);
  // True once the server has the latest results.
  const [sent, setSent] = useState(false);

  // Offline support. Progress and unsent scores live on the phone, so a reload
  // or a dead connection doesn't lose them.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const saved = readProgress(judgeKey);
    if (saved) {
      setDone(saved.done);
      setStarted(saved.started);
      setResults(saved.results);
      setSent(saved.sent);
    }
    setHydrated(true);
  }, [judgeKey]);
  useEffect(() => {
    if (hydrated) writeProgress(judgeKey, { done, started, results, sent });
  }, [hydrated, judgeKey, done, started, results, sent]);

  const resultsRef = useRef(results);
  useEffect(() => {
    resultsRef.current = results;
  });
  const { online, pending, submit } = useOutbox(judgeKey, sendScores, (item) => {
    // Only counts as sent if nothing changed while it was on its way.
    setSent(JSON.stringify(item.results) === JSON.stringify(resultsRef.current));
  });
  let submitStatus: SubmitStatus = "open";
  if (pending > 0) submitStatus = online ? "sending" : "waiting";
  else if (sent) submitStatus = "sent";

  const { label, tables, impromptu, rubric } = PLACEHOLDER;
  const expected = tables[done];
  const currentTable = started ? (override ?? expected) : undefined;
  const adHoc = judging?.adHoc ?? false;
  const editingTeam =
    editingTable !== null
      ? results.find((r) => r.table === editingTable)
      : undefined;

  // Tapping a tab always lands on that tab's main screen.
  // Score keeps whatever is open there (a team being judged or edited).
  const changeTab = (next: JudgeTab) => {
    setTab(next);
    setNextView("main");
    if (next !== "score") setEditingTable(null);
  };

  // "Review all teams": jump to the full list.
  const reviewAll = () => {
    setTab("teams");
    setNextView("main");
    setEditingTable(null);
  };

  // Tapping a judged team opens it on the Score page.
  const editTeam = (table: number) => {
    setEditingTable(table);
    setTab("score");
    setNextView("main");
  };

  // Leaving an edit goes back to the list it came from.
  const closeEdit = () => {
    setEditingTable(null);
    setTab("teams");
  };

  // "Judge this team": score the table the Next page is showing.
  const judgeThisTeam = () => {
    if (currentTable === undefined) return;
    setJudging({ table: currentTable, adHoc: false });
    setTab("score");
  };

  // "Judge another team": score a table the judge typed in.
  const judgeAnotherTeam = (table: number) => {
    setJudging({ table, adHoc: true });
    setNextView("main");
    setTab("score");
  };

  const useTable = (actual: number) => {
    // Overrides are only logged for now. They will go to the backend later.
    console.log("[judge app] table override", {
      judge: label,
      expected,
      actual,
    });
    setOverride(actual);
    setNextView("main");
  };

  // Adds a result, or replaces the one for the same table. Any change after a
  // submit means there is something new to submit.
  const recordResult = (team: JudgedTeam) => {
    setResults((list) =>
      list.some((r) => r.table === team.table)
        ? list.map((r) => (r.table === team.table ? team : r))
        : [...list, team],
    );
    setSent(false);
  };

  // After a table is scored or marked absent: move on and show what's next.
  const finishTable = () => {
    if (!adHoc) {
      setDone((d) => d + 1);
      setOverride(null);
    }
    setJudging(null);
    setNextView("main");
    setTab("next");
  };

  const submitScore = (submission: ScoreSubmission) => {
    recordResult({
      table: submission.table,
      teamName: TEAM_NAME,
      absent: false,
      ratings: submission.ratings,
      score: submission.score,
      notes: submission.notes,
    });
    finishTable();
  };

  const markAbsent = (table: number) => {
    recordResult({
      table,
      teamName: TEAM_NAME,
      absent: true,
      ratings: {},
      score: null,
      notes: "",
    });
    finishTable();
  };

  const submitAll = () => {
    if (
      !window.confirm(
        `Submit ${results.length} score${results.length === 1 ? "" : "s"}? You can't change them after.`,
      )
    )
      return;
    // Saved on the phone first, then sent when there is a connection.
    submit({ judge: label, results });
  };

  const impromptuOpen = tab === "next" && nextView === "impromptu";
  const wrongTable = tab === "next" && nextView === "wrong-table";
  const editing = tab === "score" && editingTeam !== undefined;
  const scoringPage = tab === "score" && (judging !== null || editing);

  let header: ReactNode = null;
  if (impromptuOpen) {
    header = (
      <HeaderRow
        left="Judge another team"
        right={
          <DashboardButton
            type="button"
            variant="outline"
            onClick={() => setNextView("main")}
            className="min-h-11"
          >
            Cancel
          </DashboardButton>
        }
      />
    );
  } else if (wrongTable) {
    header = <HeaderRow left="Wrong table?" />;
  } else if (tab === "map") {
    header = <HeaderRow left="Floor map" />;
  } else if (tab === "teams") {
    header = <HeaderRow left="Review" />;
  } else if (!scoringPage) {
    // The Score page draws its own header row (table and save status).
    header = (
      <HeaderRow
        left={started ? label : "Judge"}
        right={
          started ? (
            <span className="tabular-nums">
              {Math.min(done + 1, tables.length)} of {tables.length}
            </span>
          ) : undefined
        }
      />
    );
  }

  let body: ReactNode;
  if (tab === "next") {
    if (nextView === "wrong-table") {
      body = (
        <JudgeWrongTable
          expected={expected}
          onBack={() => setNextView("main")}
          onUse={useTable}
        />
      );
    } else if (nextView === "impromptu") {
      body = (
        <JudgeImpromptu
          judgesSoFar={impromptu.judgesSoFar}
          judgesNeeded={impromptu.judgesNeeded}
          onScore={judgeAnotherTeam}
        />
      );
    } else {
      body = (
        <JudgeNext
          started={started}
          onStart={() => setStarted(true)}
          tables={tables}
          currentIndex={done}
          override={override}
          onJudge={judgeThisTeam}
          onReview={reviewAll}
          onWrongTable={() => setNextView("wrong-table")}
          onImpromptu={() => setNextView("impromptu")}
        />
      );
    }
  } else if (tab === "score") {
    // The Score tab is locked until a team is chosen or opened for edit, so the
    // last message is only a fallback.
    body = editingTeam ? (
      <JudgeEdit
        key={editingTeam.table}
        team={editingTeam}
        rubric={rubric}
        onSave={(updated) => {
          recordResult(updated);
          closeEdit();
        }}
        onCancel={closeEdit}
      />
    ) : judging ? (
      <JudgeRubric
        key={`${judging.table}-${judging.adHoc}`}
        table={judging.table}
        adHoc={judging.adHoc}
        rubric={rubric}
        onSubmit={submitScore}
        onAbsent={markAbsent}
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
        status={submitStatus}
        onEdit={editTeam}
        onSubmit={submitAll}
      />
    );
  } else {
    body = (
      <>
        <section aria-label="Floor map" className={`${card} p-3.5`}>
          <VenueMap tables={tables} current={currentTable} />
        </section>
        {currentTable === undefined && (
          <p className="m-0 px-1 text-base font-medium text-dashboard-text-light">
            Start judging on the Next tab to see your next table here.
          </p>
        )}
      </>
    );
  }

  // Each section opens at the top and fades in, instead of snapping.
  const sectionKey = `${tab}:${nextView}:${started}:${editingTable ?? ""}:${judging?.table ?? ""}`;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [sectionKey]);

  return (
    <div className="min-h-dvh bg-dashboard-bg-page font-figtree text-dashboard-text-heavy">
      <div className="mx-auto flex min-h-dvh w-full flex-col sm:max-w-md sm:border-x sm:border-dashboard-border-subtle">
        {header}
        <main
          className={`flex flex-1 flex-col gap-3 px-5 pb-5 ${
            scoringPage || editing ? "pt-4" : "pt-3"
          }`}
        >
          <JudgeOfflineBanner online={online} pending={pending} />
          <div
            key={sectionKey}
            className="flex flex-col gap-3 duration-200 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none"
          >
            {body}
          </div>
        </main>
        <JudgeNav
          active={tab}
          onChange={changeTab}
          disabled={judging === null && !editing ? ["score"] : []}
        />
      </div>
    </div>
  );
}