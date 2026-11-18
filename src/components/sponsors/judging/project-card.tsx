import { useEffect, useId, useState } from "react";
import { Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import {
  DashboardButton,
  dashboardButtonVariants,
} from "~/components/internals/dashboard-button";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import { NOTE_MAX, type TeamReview } from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { ScoreControl } from "./score-control";
import {
  type JudgingTeam,
  type ReviewPatch,
  type SaveState,
} from "./use-sponsor-judging";

const copy = sponsorJudgingCopy;
const AVATARS = 4;

const linkChip = dashboardButtonVariants({ variant: "small" });

export function ProjectLinks({ team }: { team: JudgingTeam }) {
  if (!team.devpostUrl && !team.githubUrl) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {team.devpostUrl && (
        <a
          href={team.devpostUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy.browse.openOn(team.name, copy.browse.devpost)}
          className={linkChip}
        >
          {copy.browse.devpost}
          <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
        </a>
      )}
      {team.githubUrl && (
        <a
          href={team.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy.browse.openOn(team.name, copy.browse.github)}
          className={linkChip}
        >
          {copy.browse.github}
          <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
        </a>
      )}
    </div>
  );
}

/**
 * One project on the Browse step: who built it, its tracks and links, a
 * 1-10 score, Save to shortlist and an optional private note. Every change
 * autosaves; the status at the end of the action row says when it's
 * saved or failed (and is announced politely).
 */
export function ProjectCard({
  team,
  review,
  saveState,
  onSave,
}: {
  team: JudgingTeam;
  review: TeamReview | undefined;
  saveState: SaveState | undefined;
  onSave: (patch: ReviewPatch) => void;
}) {
  const noteId = useId();
  const savedNote = review?.note ?? "";
  const [noteOpen, setNoteOpen] = useState(savedNote.length > 0);
  const [draft, setDraft] = useState(savedNote);
  // Follow the saved note (e.g. after a rollback) unless the sponsor is
  // typing a different one.
  useEffect(() => setDraft(savedNote), [savedNote]);
  const shortlisted = review?.shortlisted ?? false;
  const extra = team.members.length - AVATARS;

  const commitNote = () => {
    const next = draft.trim();
    if (next !== savedNote.trim()) onSave({ note: next || null });
  };

  return (
    <article
      aria-labelledby={`${noteId}-name`}
      className={cn(
        "flex flex-col gap-4 rounded-dashboard-2xl border-2 bg-dashboard-bg-surface p-4 shadow-dashboard-card motion-safe:transition-colors motion-safe:duration-150 sm:p-5",
        shortlisted ? "border-dashboard-action-primary" : "border-transparent",
      )}
    >
      <div className="flex flex-col gap-2">
        <h3
          id={`${noteId}-name`}
          className="m-0 break-words text-lg font-semibold leading-snug text-dashboard-text-heavy"
        >
          {team.name}
        </h3>
        <div className="flex items-center gap-2.5">
          {team.members.length > 0 && (
            <span className="flex shrink-0 -space-x-2" aria-hidden>
              {team.members.slice(0, AVATARS).map((m, i) => (
                <HackerAvatar
                  key={`${m}-${i}`}
                  name={m}
                  size="sm"
                  className="ring-2 ring-dashboard-bg-surface"
                />
              ))}
              {extra > 0 && (
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-dashboard-bg-nav text-xs font-semibold text-dashboard-text-medium ring-2 ring-dashboard-bg-surface">
                  +{extra}
                </span>
              )}
            </span>
          )}
          <p className="m-0 min-w-0 break-words text-sm font-medium text-dashboard-text-light">
            {team.members.length > 0
              ? team.members.join(", ")
              : copy.browse.noMembers}
          </p>
        </div>
        {team.tracks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {team.tracks.map((track) => (
              <DashboardTag key={track}>{track}</DashboardTag>
            ))}
          </div>
        )}
        <ProjectLinks team={team} />
      </div>

      <ScoreControl
        team={team.name}
        value={review?.score ?? null}
        onChange={(score) => onSave({ score })}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={shortlisted}
          aria-label={
            shortlisted ? undefined : copy.shortlistToggle.label(team.name)
          }
          onClick={() => onSave({ shortlisted: !shortlisted })}
          className={cn(
            "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-dashboard-lg border px-4 text-base font-semibold sm:flex-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
            shortlisted
              ? "border-dashboard-action-primary bg-dashboard-bg-highlight text-dashboard-text-active"
              : "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse shadow-dashboard-primary-btn [@media(hover:hover)]:hover:bg-dashboard-text-active",
            pressable,
          )}
        >
          {shortlisted ? (
            <BookmarkCheck aria-hidden className="size-5" strokeWidth={1.75} />
          ) : (
            <Bookmark aria-hidden className="size-5" strokeWidth={1.75} />
          )}
          {shortlisted ? copy.shortlistToggle.added : copy.shortlistToggle.add}
        </button>
        {!noteOpen && (
          <DashboardButton
            type="button"
            variant="link"
            onClick={() => setNoteOpen(true)}
            aria-expanded={false}
            aria-controls={noteId}
          >
            {copy.note.add}
          </DashboardButton>
        )}
        <p
          aria-live="polite"
          className={cn(
            "m-0 ml-auto text-sm font-medium",
            saveState === "error"
              ? "text-dashboard-status-warning"
              : "text-dashboard-text-light",
          )}
        >
          {saveState === "saving"
            ? copy.saving
            : saveState === "saved"
              ? copy.saved
              : saveState === "error"
                ? copy.saveFailed
                : ""}
        </p>
      </div>

      {noteOpen && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={noteId}
            className="text-sm font-semibold text-dashboard-text-medium"
          >
            {copy.note.edit}
            <span className="sr-only">: {copy.note.label(team.name)}</span>
          </label>
          <textarea
            id={noteId}
            value={draft}
            maxLength={NOTE_MAX}
            rows={2}
            placeholder={copy.note.placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitNote}
            className="w-full resize-y rounded-dashboard-md border border-dashboard-border-default bg-dashboard-bg-surface px-3 py-2 text-base font-medium text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus:border-dashboard-action-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
          />
          <span className="self-end text-xs font-medium tabular-nums text-dashboard-text-light">
            {copy.note.left(NOTE_MAX - draft.length)}
          </span>
        </div>
      )}
    </article>
  );
}
