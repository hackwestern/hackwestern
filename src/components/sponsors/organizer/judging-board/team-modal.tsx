import * as Dialog from "@radix-ui/react-dialog";
import {
  CheckCircle2,
  ExternalLink,
  Github,
  TriangleAlert,
  X,
} from "lucide-react";
import { HackerLinks } from "~/components/sponsors/hacker-links";
import { focusRing } from "~/components/sponsors/organizer/coffee-sessions/parts";
import { sponsorJudgingBoardCopy } from "~/content/sponsor-judging-board";
import { formatPresentationTime } from "~/lib/sponsor-presentations";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { StatusPill } from "./status";

const copy = sponsorJudgingBoardCopy.team;

const iconButton = cn(
  "inline-flex size-11 items-center justify-center rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-heavy [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
  focusRing,
);

const sectionHead =
  "m-0 text-xs font-bold uppercase tracking-wider text-dashboard-text-medium";

/**
 * One team, from a calendar or schedule cell: name and ID, Devpost and
 * GitHub, check-in (one member is enough), where and when it presents (and
 * its status), and its members. A centered dialog on desktop, a bottom sheet on
 * phones.
 */
export function TeamModal({
  teamId,
  onClose,
}: {
  teamId: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={teamId !== null} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/30" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col overflow-y-auto bg-dashboard-bg-surface font-figtree text-dashboard-text-heavy shadow-dashboard-card",
            // Phones: a bottom sheet.
            "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-dashboard-lg p-5",
            // Desktop: a centered dialog.
            "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[85dvh] md:w-[calc(100%-48px)] md:max-w-[600px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-dashboard-lg md:p-6",
          )}
        >
          {teamId && <TeamBody teamId={teamId} />}
          <Dialog.Close
            aria-label={copy.close}
            className={cn(
              "absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-dashboard-md text-dashboard-text-light [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
              focusRing,
            )}
          >
            <X aria-hidden className="size-5" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function TeamBody({ teamId }: { teamId: string }) {
  const q = api.sponsorPresentations.boardTeam.useQuery(
    { teamId },
    { retry: 1 },
  );
  const t = q.data;
  if (!t) {
    return (
      <>
        <Dialog.Title className="m-0 pr-12 text-2xl font-bold">
          {teamId}
        </Dialog.Title>
        <p
          role={q.isError ? "alert" : "status"}
          className="m-0 pt-3 text-base text-dashboard-text-medium"
        >
          {q.isError ? copy.failed : copy.loading}
        </p>
      </>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-0.5 pr-12">
        <Dialog.Title className="m-0 break-words text-2xl font-bold leading-tight">
          {t.name}
        </Dialog.Title>
        <span className="text-sm font-medium tabular-nums text-dashboard-text-light">
          {t.teamId}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {t.devpostUrl && (
          <a
            href={t.devpostUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={copy.devpost(t.name)}
            className={iconButton}
          >
            <ExternalLink aria-hidden className="size-5" />
          </a>
        )}
        {t.githubUrl && (
          <a
            href={t.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={copy.github(t.name)}
            className={iconButton}
          >
            <Github aria-hidden className="size-5" />
          </a>
        )}
        <StatusPill status={t.status} className="ml-auto" />
      </div>

      <p
        className={cn(
          "m-0 flex items-center gap-2 rounded-dashboard-md px-4 py-3 text-base font-semibold",
          t.checkedIn
            ? "bg-dashboard-schedule-green text-dashboard-status-live"
            : "bg-dashboard-bg-task text-dashboard-text-task",
        )}
      >
        {t.checkedIn ? (
          <CheckCircle2 aria-hidden className="size-5 shrink-0" />
        ) : (
          <TriangleAlert aria-hidden className="size-5 shrink-0" />
        )}
        {t.checkedIn ? copy.teamCheckedIn : copy.noneConfirmed}
      </p>

      {t.presentsTo.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className={sectionHead}>{copy.presentsTo}</h3>
          <ul className="m-0 flex list-none flex-col divide-y divide-dashboard-border-subtle p-0">
            {t.presentsTo.map((p, i) => {
              const prev = t.presentsTo[i - 1];
              return (
                <li
                  key={p.sponsorId}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 py-2.5 text-base tabular-nums"
                >
                  <span>
                    <b className="font-bold">{p.sponsorName}</b>{" "}
                    {copy.slot(formatPresentationTime(p.start), p.room)}
                  </span>
                  {prev && (
                    <span className="text-sm text-dashboard-text-light">
                      {copy.apart(p.start - prev.start)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className={sectionHead}>{copy.members}</h3>
        {t.members.length === 0 ? (
          <p className="m-0 text-base text-dashboard-text-medium">
            {copy.noMembers}
          </p>
        ) : (
          <ul className="m-0 grid list-none gap-2 p-0 md:grid-cols-2">
            {t.members.map((m) => {
              const about = [
                m.school,
                m.program,
                m.year ? copy.year(m.year) : null,
              ].filter(Boolean);
              return (
                <li
                  key={m.userId}
                  className="flex min-w-0 flex-col gap-2 rounded-dashboard-md border border-dashboard-border-subtle p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <b className="break-words text-base font-bold">{m.name}</b>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-dashboard-sm px-2 py-0.5 text-xs font-semibold leading-5",
                        m.checkedIn
                          ? "bg-dashboard-schedule-green text-dashboard-status-live"
                          : "bg-dashboard-bg-nav text-dashboard-text-medium",
                      )}
                    >
                      {m.checkedIn && (
                        <CheckCircle2 aria-hidden className="size-3.5" />
                      )}
                      {m.checkedIn ? copy.checkedIn : copy.notCheckedIn}
                    </span>
                  </div>
                  {about.length > 0 && (
                    <p className="m-0 break-words text-sm text-dashboard-text-medium">
                      {about.join(" · ")}
                    </p>
                  )}
                  <HackerLinks
                    name={m.name}
                    links={{
                      resume: m.links.resume,
                      github: m.links.github,
                      linkedIn: m.links.linkedin,
                      devpost: null,
                      extraLink: m.links.website,
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
