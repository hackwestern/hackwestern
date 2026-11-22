import { useCallback, useMemo, useState } from "react";

import {
  around,
  byText,
  bySelector,
  cardWith,
  Spotlight,
  type SpotStep,
} from "~/components/judging/tour/spotlight";
import {
  HackerScreen,
  JudgeScreen,
  type HackerScene,
  type JudgeScene,
} from "~/components/judging/tour/tour-screens";
import { judgingTourCopy } from "~/content/judging-tour";

const copy = judgingTourCopy.walkthrough;
const s = copy.steps;

export type WalkRole = "both" | "judge" | "hacker";
type Side = "judge" | "hacker";

interface WalkStep extends SpotStep {
  /** Which screen the step points at. */
  side: Side;
  judge: JudgeScene;
  hacker: HackerScene;
}

const J = (text: string) => () => cardWith("judge", text);
const JB = (text: string) => () => byText("judge", text, "button");
const H = (text: string) => () => byText("hacker", text);

/**
 * The general judging story, one moment per step. Both screens move
 * together: while the judge walks over, the hacker's page says a judge is
 * coming. A one-role tour keeps only that role's steps.
 */
const STEPS: readonly WalkStep[] = [
  {
    id: "queue",
    side: "judge",
    judge: "welcome",
    hacker: "idle",
    ...s.queue,
    find: () => around("judge", "Teams in your queue", "Trailhead AR"),
  },
  {
    id: "start",
    side: "judge",
    judge: "welcome",
    hacker: "idle",
    ...s.start,
    find: JB("Start judging"),
  },
  {
    id: "roundsLink",
    side: "hacker",
    judge: "waiting",
    hacker: "idle",
    ...s.roundsLink,
    find: () => bySelector("hacker", 'a[href="/rounds"]'),
  },
  {
    id: "yourTable",
    side: "hacker",
    judge: "waiting",
    hacker: "idle",
    ...s.yourTable,
    find: () => bySelector("hacker", 'section[aria-label="Your team"]'),
  },
  {
    id: "waiting",
    side: "judge",
    judge: "waiting",
    hacker: "idle",
    ...s.waiting,
    find: J("Waiting for round 1"),
  },
  {
    id: "table",
    side: "judge",
    judge: "team",
    hacker: "coming",
    ...s.table,
    find: J("Your table"),
  },
  {
    id: "clock",
    side: "judge",
    judge: "team",
    hacker: "coming",
    ...s.clock,
    find: J("Time left"),
  },
  {
    id: "coming",
    side: "hacker",
    judge: "team",
    hacker: "coming",
    ...s.coming,
    find: H("A judge is coming"),
  },
  {
    id: "missing",
    side: "hacker",
    judge: "team",
    hacker: "coming",
    ...s.missing,
    find: () => byText("hacker", "Judge missing", "button"),
  },
  {
    id: "idle",
    side: "hacker",
    judge: "team",
    hacker: "none",
    ...s.idle,
    find: H("No judge at your table"),
  },
  {
    id: "judgeThis",
    side: "judge",
    judge: "team",
    hacker: "coming",
    ...s.judgeThis,
    find: JB("Judge this team"),
  },
  {
    id: "here",
    side: "hacker",
    judge: "score",
    hacker: "here",
    ...s.here,
    find: H("Your judge is here"),
  },
  {
    id: "criteria",
    side: "judge",
    judge: "score",
    hacker: "here",
    ...s.criteria,
    find: () => around("judge", "Innovation + Impact", "Adventurous"),
  },
  {
    id: "superLike",
    side: "judge",
    judge: "score",
    hacker: "here",
    ...s.superLike,
    find: JB("Super like"),
  },
  {
    id: "notHere",
    side: "judge",
    judge: "score",
    hacker: "absent",
    ...s.notHere,
    find: JB("Team not here"),
  },
  {
    id: "nextTeam",
    side: "judge",
    judge: "score",
    hacker: "here",
    ...s.nextTeam,
    find: JB("Next team"),
  },
  {
    id: "buffer",
    side: "judge",
    judge: "buffer",
    hacker: "judgedRound",
    ...s.buffer,
    find: J("Buffer"),
  },
  {
    id: "over",
    side: "judge",
    judge: "over",
    hacker: "over",
    ...s.over,
    find: J("is over"),
  },
  {
    id: "catchup",
    side: "judge",
    judge: "catchup",
    hacker: "none",
    ...s.catchup,
    find: J("No table this round"),
  },
  {
    id: "rescore",
    side: "judge",
    judge: "myTeams",
    hacker: "judged",
    ...s.rescore,
    find: J("Start re-scoring"),
  },
  {
    id: "submit",
    side: "judge",
    judge: "final",
    hacker: "judged",
    ...s.submit,
    find: () => byText("judge", "Submit", "button"),
  },
  {
    id: "judged",
    side: "hacker",
    judge: "done",
    hacker: "judged",
    ...s.judged,
    find: H("Your team has been judged"),
  },
  {
    id: "done",
    side: "judge",
    judge: "done",
    hacker: "judged",
    ...s.done,
    find: J("done judging"),
  },
];

function Pane({
  label,
  side,
  children,
}: {
  label: string;
  side: Side;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className="flex h-full min-h-0 min-w-0 flex-col bg-dashboard-bg-page"
    >
      <p className="m-0 shrink-0 border-b border-dashboard-border-default bg-dashboard-bg-nav px-4 py-2 font-figtree text-xs font-semibold text-dashboard-text-medium">
        {label}
      </p>
      <div data-tour-stage={side} className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </section>
  );
}

/**
 * The judging tour: the real judge app and hacker page on sample data,
 * dimmed around one spot at a time, like the sponsor portal tour. "both"
 * shows the two screens side by side (one at a time on a phone, following
 * the step).
 */
export function JudgingWalkthrough({
  role,
  onChange,
}: {
  role: WalkRole;
  onChange: () => void;
}) {
  const steps = useMemo(
    () => (role === "both" ? STEPS : STEPS.filter((st) => st.side === role)),
    [role],
  );
  const [at, setAt] = useState(0);
  const [open, setOpen] = useState(true);
  // Phones show one screen in "both": the step's, unless the viewer picks.
  const [picked, setPicked] = useState<Side | null>(null);
  const step = steps[Math.min(at, steps.length - 1)]!;

  const move = useCallback((i: number) => {
    setAt(i);
    setPicked(null);
  }, []);

  // Arrow keys and Escape come from the tour overlay itself.

  const narrowSide = picked ?? step.side;
  const judge = (
    <Pane label={copy.judgeLabel} side="judge">
      <JudgeScreen scene={step.judge} />
    </Pane>
  );
  const hacker = (
    <Pane label={copy.hackerLabel} side="hacker">
      <HackerScreen scene={step.hacker} />
    </Pane>
  );

  return (
    <div className="flex h-dvh flex-col bg-dashboard-bg-page font-figtree">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-dashboard-border-default bg-dashboard-bg-surface px-[max(12px,env(safe-area-inset-left,0px))] py-2">
        <button
          type="button"
          onClick={onChange}
          className="min-h-9 rounded-full border border-dashboard-border-default px-4 text-sm font-semibold text-dashboard-text-heavy"
        >
          {copy.change}
        </button>
        {role === "both" && (
          <div
            role="group"
            aria-label={copy.chooser.options.both.title}
            className="ml-auto inline-flex rounded-full border border-dashboard-border-default p-0.5 lg:hidden"
          >
            {(["judge", "hacker"] as const).map((side) => (
              <button
                key={side}
                type="button"
                aria-pressed={narrowSide === side}
                onClick={() => setPicked(side)}
                className={`min-h-8 rounded-full px-3 text-xs font-semibold ${
                  narrowSide === side
                    ? "bg-dashboard-action-primary text-dashboard-text-inverse"
                    : "text-dashboard-text-heavy"
                }`}
              >
                {side === "judge" ? copy.showJudge : copy.showHacker}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className={`grid min-h-0 flex-1 ${
          role === "both"
            ? "grid-cols-1 lg:grid-cols-[minmax(360px,440px)_minmax(0,1fr)]"
            : "grid-cols-1"
        }`}
      >
        {role === "judge" && judge}
        {role === "hacker" && hacker}
        {role === "both" && (
          <>
            <div
              className={`min-h-0 lg:block lg:border-r lg:border-dashboard-border-default ${
                narrowSide === "judge" ? "block" : "hidden"
              }`}
            >
              {judge}
            </div>
            <div
              className={`min-h-0 lg:block ${
                narrowSide === "hacker" ? "block" : "hidden"
              }`}
            >
              {hacker}
            </div>
          </>
        )}
      </div>

      {open ? (
        <>
          {/* Escape, the callout's X and Done minimize too: the tour keeps
              its place so the presenter can talk over the bare screen. */}
          <Spotlight
            steps={steps}
            at={at}
            onMove={move}
            onClose={() => setOpen(false)}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="fixed right-[max(12px,env(safe-area-inset-right,0px))] top-[calc(8px+env(safe-area-inset-top,0px))] z-[70] min-h-10 rounded-full bg-dashboard-bg-surface px-4 text-sm font-semibold text-dashboard-text-heavy shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-action-primary"
          >
            {copy.minimize}
          </button>
        </>
      ) : (
        <div
          role="status"
          className="fixed bottom-[calc(16px+env(safe-area-inset-bottom,0px))] right-[max(16px,env(safe-area-inset-right,0px))] z-[70] flex max-w-[calc(100vw-32px)] flex-wrap items-center gap-2 rounded-2xl border border-dashboard-border-default bg-dashboard-bg-surface p-2 pl-4 shadow-lg"
        >
          <span className="text-sm font-semibold text-dashboard-text-medium">
            {copy.minimized(at + 1, steps.length)}
          </span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-10 rounded-full bg-dashboard-action-primary px-4 text-sm font-semibold text-dashboard-text-inverse focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-action-primary"
          >
            {copy.resume}
          </button>
          <button
            type="button"
            onClick={() => {
              move(0);
              setOpen(true);
            }}
            className="min-h-10 rounded-full border border-dashboard-border-default px-4 text-sm font-semibold text-dashboard-text-heavy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-action-primary"
          >
            {copy.restart}
          </button>
        </div>
      )}
    </div>
  );
}
