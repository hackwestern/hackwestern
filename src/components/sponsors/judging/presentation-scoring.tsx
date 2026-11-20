import { useMemo, useState } from "react";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  judgeKey,
  teamIdAndLink,
  type TeamScores as TeamScoresData,
} from "~/lib/sponsor-scoring";
import { formatPresentationTime } from "~/lib/sponsor-presentations";
import { JudgePicker, JudgingAs, useJudgeName } from "./judge-picker";
import { ProjectLinks, TeamScores } from "./project-card";
import { ScoreControl } from "./score-control";
import type { JudgingData, SaveState } from "./use-sponsor-judging";

const copy = sponsorJudgingCopy;

/**
 * Round 2 live scoring: the sponsor's scheduled presentations in presentation
 * order, one normal 1-10 range control per team. The existing per-rep score
 * mutation is reused, so the team average also appears in the Top 5 view.
 */
export function PresentationScoring({
  sponsor,
  data,
  scoresByTeam,
  saveState,
  onScore,
}: {
  sponsor: string;
  data: JudgingData;
  scoresByTeam: ReadonlyMap<string, TeamScoresData>;
  saveState: Record<string, SaveState>;
  onScore: (teamId: string, judge: string, score: number | null) => void;
}) {
  const judge = useJudgeName(sponsor);
  const [switching, setSwitching] = useState(false);
  const me = judge.name;

  const teams = useMemo(() => {
    const byId = new Map(data.teams.map((team) => [team.id, team]));
    return data.round.slots.flatMap((slot) => {
      const team = byId.get(slot.teamId);
      return team ? [{ team, start: slot.start }] : [];
    });
  }, [data.teams, data.round.slots]);

  if (!judge.ready) {
    return (
      <div className="h-56 w-full animate-pulse rounded-dashboard-2xl bg-dashboard-bg-surface shadow-dashboard-card motion-reduce:animate-none" />
    );
  }
  if (!me || switching) {
    return (
      <JudgePicker
        reps={data.reps}
        current={me}
        onPick={(name) => {
          judge.choose(name);
          setSwitching(false);
        }}
      />
    );
  }

  const others = [...new Set([
    ...data.reps,
    ...data.scores.map((score) => score.judge),
  ])].filter((name) => judgeKey(name) !== judgeKey(me));

  if (teams.length === 0) {
    return (
      <DashboardPanel className="items-start">
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.round.noPresenters}
        </p>
      </DashboardPanel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <JudgingAs
        name={me}
        others={others}
        onSwitch={() => setSwitching(true)}
      />
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {teams.map(({ team, start }, index) => {
          const scores = scoresByTeam.get(team.id);
          const myScore =
            scores?.byJudge.find(
              (entry) => judgeKey(entry.judge) === judgeKey(me),
            )?.score ?? null;
          return (
            <li
              key={team.id}
              className="flex flex-col gap-3 rounded-dashboard-2xl bg-dashboard-bg-surface p-4 shadow-dashboard-card"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-7 min-w-9 shrink-0 items-center justify-center rounded-full bg-dashboard-action-primary px-1.5 text-xs font-bold tabular-nums text-dashboard-text-inverse">
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="break-words text-base font-semibold text-dashboard-text-heavy">
                    {team.name}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-dashboard-text-active">
                    {copy.round.presentingAt(formatPresentationTime(start))}
                  </span>
                  <span className="break-all text-xs font-medium tabular-nums text-dashboard-text-light">
                    {teamIdAndLink(team.id, team.devpostUrl)}
                  </span>
                  <ProjectLinks team={team} />
                </div>
              </div>
              <ScoreControl
                team={team.name}
                value={myScore}
                onChange={(score) => onScore(team.id, me, score)}
              />
              <TeamScores scores={scores} me={me} />
              {saveState[team.id] === "saving" && (
                <p className="m-0 text-xs font-medium text-dashboard-text-light">
                  {copy.saving}
                </p>
              )}
              {saveState[team.id] === "error" && (
                <p className="m-0 text-xs font-semibold text-dashboard-status-warning">
                  {copy.saveFailed}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
