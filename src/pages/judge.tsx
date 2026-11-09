import { useSession } from "next-auth/react";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import { JudgeAssignmentCard } from "~/components/judging/judge-assignment-card";
import { JudgeHeader } from "~/components/judging/judge-header";
import { JudgeMarks } from "~/components/judging/judge-marks";
import {
  JudgeScoring,
  type ScoreChoice,
  type ScoringBusy,
} from "~/components/judging/judge-scoring";
import {
  card,
  errorCode,
  friendlyError,
  primaryButton,
} from "~/components/judging/judge-ui";
import SEO from "~/components/seo";
import { api } from "~/utils/api";
import { authRedirectHacker } from "~/utils/redirect";

type Busy = ScoringBusy | "next";
type Status = { tone: "info" | "error"; text: string } | null;

const NO_TEAMS = "No teams need a judge right now. Try again in a minute.";
const info = (text: string): Status => ({ tone: "info", text });
const failure = (text: string): Status => ({ tone: "error", text });

export default function JudgePage() {
  const { data: session } = useSession();
  const utils = api.useUtils();

  const assignment = api.judging.me.getCurrentAssignment.useQuery(undefined, {
    // A non-judge (FORBIDDEN) or signed-out user won't fix themselves on retry.
    retry: (count, err) =>
      err.data?.code !== "FORBIDDEN" &&
      err.data?.code !== "UNAUTHORIZED" &&
      count < 2,
  });
  const marks = api.judging.me.getSubmittedTeamMarks.useQuery(undefined, {
    enabled: !!assignment.data,
  });
  const nextTeam = api.judging.me.getNextTeam.useMutation();
  const submit = api.judging.me.submitTeamMark.useMutation();
  const skip = api.judging.me.skipAssignment.useMutation();

  const [busy, setBusy] = useState<Busy>(null);
  const [status, setStatus] = useState<Status>(null);

  const refreshAssignment = () =>
    utils.judging.me.getCurrentAssignment.invalidate();
  const refreshMarks = () =>
    utils.judging.me.getSubmittedTeamMarks.invalidate();

  /** Ask for the next team: true if one was assigned, false if none are left. */
  async function claimNext(): Promise<boolean> {
    try {
      await nextTeam.mutateAsync();
      return true;
    } catch (error) {
      if (errorCode(error) === "CONFLICT") return false;
      throw error;
    } finally {
      await refreshAssignment();
    }
  }

  async function run(
    kind: NonNullable<Busy>,
    action: () => Promise<Status>,
    conflictText?: string,
  ) {
    setBusy(kind);
    setStatus(null);
    try {
      setStatus(await action());
    } catch (error) {
      setStatus(failure(friendlyError(error, conflictText)));
      // Resync: e.g. the team was handed to someone else in the meantime.
      void refreshAssignment();
    } finally {
      setBusy(null);
    }
  }

  const getNext = () =>
    run("next", async () => ((await claimNext()) ? null : info(NO_TEAMS)));

  const submitScore = (
    teamId: string,
    teamName: string,
    choice: ScoreChoice,
    then: "next" | "pause",
  ) =>
    run(
      then === "next" ? "submit-next" : "submit-pause",
      async () => {
        await submit.mutateAsync({ teamId, score: choice.score });
        void refreshMarks();
        const saved = `Saved ${teamName} · ${choice.label}.`;
        if (then === "pause") {
          await refreshAssignment();
          return info(`${saved} Take a breather.`);
        }
        try {
          return (await claimNext())
            ? info(`${saved} Next team below.`)
            : info(`${saved} ${NO_TEAMS}`);
        } catch {
          return failure(
            `${saved} Couldn't load your next team. Tap "Get my next team" to try again.`,
          );
        }
      },
      "This team isn't assigned to you anymore, so that score wasn't saved.",
    );

  const skipTeam = (teamName: string) =>
    run(
      "skip",
      async () => {
        await skip.mutateAsync();
        try {
          return (await claimNext())
            ? info(`Skipped ${teamName}. Another judge will get them.`)
            : info(`Skipped ${teamName}. ${NO_TEAMS}`);
        } catch {
          return failure(
            `Skipped ${teamName}, but couldn't load your next team. Tap "Get my next team" to try again.`,
          );
        }
      },
      "You don't have a team to skip right now.",
    );

  const data = assignment.data;
  const judge = data?.judge;
  const role = judge
    ? judge.type === "organizer"
      ? "Organizer"
      : `Sponsor · ${judge.track?.join(", ") ?? "no track"}`
    : null;
  const judgedCount = marks.data?.length ?? 0;

  let body: ReactNode;
  if (data?.team) {
    const team = data.team;
    body = (
      <>
        <JudgeAssignmentCard
          key={`card-${team.id}`}
          team={team}
          assignedAt={data.assignedAt}
        />
        <JudgeScoring
          key={`score-${team.id}`}
          busy={busy === "next" ? null : busy}
          onSubmit={(choice, then) =>
            void submitScore(team.id, team.name, choice, then)
          }
          onSkip={() => void skipTeam(team.name)}
        />
      </>
    );
  } else if (data) {
    body = (
      <section className={`${card} flex flex-col gap-3.5 p-5`}>
        <h1 className="text-[22px] font-bold">Ready for your next team?</h1>
        <p className="text-[15px] leading-normal text-[#4a5d73]">
          You get the team that needs a judge most. Walk to their table, hear
          the pitch, score it, and the next table comes up straight away.
        </p>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void getNext()}
          className={primaryButton}
        >
          {busy === "next" ? "Finding a team…" : "Get my next team"}
        </button>
        <p className="text-[13px] text-[#4a5d73]">
          {marks.data
            ? `${judgedCount} ${judgedCount === 1 ? "team" : "teams"} judged`
            : " "}
        </p>
      </section>
    );
  } else if (assignment.isPending) {
    body = <p className="px-1 text-[15px] text-[#4a5d73]">Loading…</p>;
  } else if (errorCode(assignment.error) === "FORBIDDEN") {
    body = (
      <section className={`${card} flex flex-col gap-2 p-5`}>
        <h1 className="text-[22px] font-bold">
          {"You're not set up as a judge yet."}
        </h1>
        <p className="text-[15px] text-[#4a5d73]">Ask an organizer.</p>
      </section>
    );
  } else if (errorCode(assignment.error) === "UNAUTHORIZED") {
    body = (
      <section className={`${card} flex flex-col gap-3 p-5`}>
        <h1 className="text-[22px] font-bold">{"You've been signed out."}</h1>
        <Link
          href="/login"
          className={`${primaryButton} flex items-center justify-center`}
        >
          Sign in again
        </Link>
      </section>
    );
  } else {
    body = (
      <section className={`${card} flex flex-col gap-3 p-5`}>
        <h1 className="text-[22px] font-bold">
          {"Couldn't load your judging screen."}
        </h1>
        <p className="text-[15px] text-[#4a5d73]">
          {friendlyError(assignment.error)}
        </p>
        <button
          type="button"
          onClick={() => void assignment.refetch()}
          className={primaryButton}
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <>
      <SEO title="Judging" noindex />
      <div className="min-h-dvh bg-[#eef1f6] font-figtree text-[#0b2238]">
        <div className="mx-auto flex min-h-dvh w-full flex-col sm:max-w-md sm:border-x sm:border-[#d6dbe5]">
          <JudgeHeader
            name={session?.user?.name ?? session?.user?.email ?? "Judge"}
            role={role}
            showControlRoom={data?.canManage ?? false}
          />
          <main className="flex-1 px-5 pb-5 pt-4">
            <div aria-live="polite">
              {status && (
                <p
                  className={`mb-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold ${
                    status.tone === "error"
                      ? "bg-[#fdecec] text-[#8f1d1d]"
                      : "bg-[#e4effd] text-[#123d75]"
                  }`}
                >
                  {status.text}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {body}
              {data && <JudgeMarks marks={marks.data ?? []} />}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = authRedirectHacker;
