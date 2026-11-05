import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  JudgeOfflineBanner,
  readProgress,
  sendScores,
  useOutbox,
  writeProgress,
} from "~/components/judging/judge-app/judge-offline";
import { card, secondaryButton } from "~/components/judging/shared/judge-ui";
import { PublicJudgeEdit } from "~/components/judging/dashboard/judge-edit";
import {
  PublicJudgeNav,
  type PublicJudgeTab,
} from "~/components/judging/judge-app/judge-nav";
import { PublicJudgeNext } from "~/components/judging/judge-app/judge-next";
import { PublicJudgeScan } from "~/components/judging/judge-app/judge-scan";
import {
  JudgeRubric,
  type ScoreSubmission,
} from "~/components/judging/judge-app/judge-rubric";
import {
  type JudgedTeam,
  PublicJudgeTeams,
  type SubmitStatus,
} from "~/components/judging/judge-app/judge-teams";
import { PublicJudgeWrongTable } from "~/components/judging/judge-app/judge-wrong-table";
import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import { VenueMap } from "~/components/judging/judge-app/judge-map";

// Placeholder team name until teams come from the database.
const TEAM_NAME = "Team";

// Placeholder data until the backend exists.
const PLACEHOLDER = {
  label: "Judge 12",
  tables: [41, 42, 43, 44, 45, 46],
  // Tables already judged when the page opens. The next is tables[done].
  done: 3,
  // How many judges a scanned team has had. Placeholder for every team.
  scan: { judgesSoFar: 1, judgesNeeded: 3 },
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
    <header className="flex min-h-[44px] items-center justify-between gap-3 px-5 pt-4 text-[15px] text-[#4a5d73]">
      <span>{left}</span>
      {right}
    </header>
  );
}

interface PublicJudgeAppProps {
  /** Keeps this judge's saved progress apart from other judges' on a shared phone. */
  judgeKey?: string;
}

/** Mobile shell for judges who open a private link instead of signing in. */
export function PublicJudgeApp({ judgeKey = "demo" }: PublicJudgeAppProps) {
  const [tab, setTab] = useState<PublicJudgeTab>("next");
  const [started, setStarted] = useState(false);
  // Tables already judged, so the next one is tables[done].
  const [done, setDone] = useState(PLACEHOLDER.done);
  // Sub-screens: "Wrong table?" lives under Next, scanning under Score,
  // and editing a judged team under My teams.
  const [nextView, setNextView] = useState<"main" | "wrong-table">("main");
  const [scoreView, setScoreView] = useState<"main" | "scan">("main");
  const [editingTable, setEditingTable] = useState<number | null>(null);
  // Set when the judge says they are at a different table than expected.
  const [override, setOverride] = useState<number | null>(null);
  // The team picked by scanning, to be scored on top of the assigned ones.
  const [scoringTable, setScoringTable] = useState<number | null>(null);
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

  const { label, tables, scan, rubric } = PLACEHOLDER;
  const expected = tables[done];
  const currentTable = started ? (override ?? expected) : undefined;
  // What the Score page works on: a scanned team first, else the current table.
  const scoreTarget = scoringTable ?? currentTable;
  const adHoc = scoringTable !== null;
  const editingTeam =
    editingTable !== null
      ? results.find((r) => r.table === editingTable)
      : undefined;

  // Tapping a tab always lands on that tab's main screen.
  const changeTab = (next: PublicJudgeTab) => {
    setTab(next);
    setNextView("main");
    setScoreView("main");
    setEditingTable(null);
  };

  const startScan = () => {
    setTab("score");
    setScoreView("scan");
  };

  const cancelScan = () => {
    setScoreView("main");
    setTab("next");
  };

  const useTable = (actual: number) => {
    // Overrides are only logged for now. They will go to the backend later.
    console.log("[public judge] table override", {
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
    if (adHoc) {
      setScoringTable(null);
    } else {
      setDone((d) => d + 1);
      setOverride(null);
    }
    setScoreView("main");
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

  const scanning = tab === "score" && scoreView === "scan";
  const wrongTable = tab === "next" && nextView === "wrong-table";
  const scoringPage =
    tab === "score" && scoreView === "main" && scoreTarget !== undefined;
  const editing = tab === "teams" && editingTeam !== undefined;

  let header: ReactNode = null;
  if (scanning) {
    header = (
      <HeaderRow
        left="Scan team QR"
        right={
          <button
            type="button"
            onClick={cancelScan}
            className={`${secondaryButton} min-h-[44px]`}
          >
            Cancel
          </button>
        }
      />
    );
  } else if (wrongTable) {
    header = <HeaderRow left="Wrong table?" />;
  } else if (tab === "map") {
    header = <HeaderRow left="Floor map" />;
  } else if (tab === "teams") {
    // The edit view draws its own header row (team and current score).
    if (!editing) header = <HeaderRow left="Review" />;
  } else if (!scoringPage) {
    // The Score page draws its own header row (table and save status).
    header = (
      <HeaderRow
        left={started ? label : "Public judge"}
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
    body =
      nextView === "wrong-table" ? (
        <PublicJudgeWrongTable
          expected={expected}
          onBack={() => setNextView("main")}
          onUse={useTable}
        />
      ) : (
        <PublicJudgeNext
          started={started}
          onStart={() => setStarted(true)}
          tables={tables}
          currentIndex={done}
          override={override}
          onWrongTable={() => setNextView("wrong-table")}
          onScan={startScan}
        />
      );
  } else if (tab === "score") {
    if (scoreView === "scan") {
      body = (
        <PublicJudgeScan
          judgesSoFar={scan.judgesSoFar}
          judgesNeeded={scan.judgesNeeded}
          onScore={(table) => {
            setScoringTable(table);
            setScoreView("main");
          }}
        />
      );
    } else if (scoreTarget !== undefined) {
      body = (
        <JudgeRubric
          key={`${scoreTarget}-${adHoc}`}
          table={scoreTarget}
          adHoc={adHoc}
          rubric={rubric}
          onSubmit={submitScore}
          onAbsent={markAbsent}
        />
      );
    } else {
      body = (
        <p className="px-1 text-[15px] text-[#4a5d73]">
          Start judging on the Next tab to score a table.
        </p>
      );
    }
  } else if (tab === "teams") {
    body = editingTeam ? (
      <PublicJudgeEdit
        key={editingTeam.table}
        team={editingTeam}
        rubric={rubric}
        onSave={(updated) => {
          recordResult(updated);
          setEditingTable(null);
        }}
        onCancel={() => setEditingTable(null)}
      />
    ) : (
      <PublicJudgeTeams
        results={results}
        status={submitStatus}
        onEdit={setEditingTable}
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
          <p className="m-0 px-1 text-[15px] text-[#4a5d73]">
            Start judging on the Next tab to see your next table here.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-[#eef1f6] font-figtree text-[#0b2238]">
      <div className="mx-auto flex min-h-dvh w-full flex-col sm:max-w-md sm:border-x sm:border-[#d6dbe5]">
        {header}
        <main
          className={`flex flex-1 flex-col gap-3 px-5 pb-5 ${
            scoringPage || editing ? "pt-4" : "pt-3"
          }`}
        >
          <JudgeOfflineBanner online={online} pending={pending} />
          {body}
        </main>
        <PublicJudgeNav active={tab} onChange={changeTab} />
      </div>
    </div>
  );
}