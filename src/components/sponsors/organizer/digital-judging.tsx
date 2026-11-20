import { useEffect, useId, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  formatSubmittedTime,
  linkIsAmbiguous,
  matchTeamByLink,
  teamIdAndLink,
} from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const copy = sponsorJudgingCopy.organizer.digital;

/**
 * Organizer entry of a digital sponsor's 1st-5th place (PCBWay today: no
 * portal). Paste each Devpost link (or team ID); the match (name, ID,
 * link) shows under the field to confirm, and Save is off until every
 * place matches a different submitted team in that sponsor's track. The
 * server checks the same rule (submitDigital).
 */
export function DigitalJudging({
  names,
  top,
}: {
  names: readonly string[];
  top: number;
}) {
  if (names.length === 0) return null;
  return (
    <section
      aria-labelledby="digital-judging-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="digital-judging-heading"
          className="m-0 text-base font-semibold text-dashboard-text-heavy"
        >
          {copy.heading}
        </h2>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {copy.intro(top)}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {names.map((name) => (
          <DigitalSponsor key={name} name={name} top={top} />
        ))}
      </div>
    </section>
  );
}

export function DigitalSponsor({ name, top }: { name: string; top: number }) {
  const id = useId();
  const utils = api.useUtils();
  const query = api.sponsorScoring.digitalTeams.useQuery(
    { name },
    { retry: 1, refetchOnWindowFocus: false },
  );
  const [links, setLinks] = useState<string[]>(() =>
    Array<string>(top).fill(""),
  );
  const data = query.data;
  // Start from what was entered before, as team IDs (they match too).
  const savedKey = data?.final?.teamIds.join(",") ?? "";
  useEffect(() => {
    if (!data?.final) return;
    setLinks(
      Array.from({ length: top }, (_, i) => {
        const teamId = data.final!.teamIds[i];
        const team = data.teams.find((t) => t.id === teamId);
        return team?.devpostUrl ?? teamId ?? "";
      }),
    );
    // Only when the saved entry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey, top]);

  const save = api.sponsorScoring.submitDigital.useMutation({
    onSuccess: () => {
      void utils.sponsorScoring.digitalTeams.invalidate({ name });
      void utils.sponsorScoring.overview.invalidate();
    },
  });

  if (query.isLoading) {
    return (
      <div className="h-48 animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card motion-reduce:animate-none" />
    );
  }
  if (!data) {
    return (
      <DashboardPanel className="items-start">
        <p className="m-0 text-sm text-dashboard-text-medium">
          {copy.loadFailed}
        </p>
        <DashboardButton variant="small" onClick={() => void query.refetch()}>
          {sponsorJudgingCopy.organizer.retry}
        </DashboardButton>
      </DashboardPanel>
    );
  }

  const matches = links.map((link) => matchTeamByLink(link, data.teams));
  const dupes = matches.map(
    (m, i) => m !== null && matches.findIndex((o) => o?.id === m.id) !== i,
  );
  const ready = matches.every((m) => m !== null) && !dupes.some(Boolean);

  return (
    <section
      aria-labelledby={`${id}-name`}
      className="flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-5 shadow-dashboard-card"
    >
      <div className="flex flex-col gap-0.5">
        <h3
          id={`${id}-name`}
          className="m-0 text-base font-semibold text-dashboard-text-heavy"
        >
          {data.name}
        </h3>
        {data.track && (
          <span className="text-sm text-dashboard-text-light">
            {copy.track(data.track)}
          </span>
        )}
        {data.final && (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-dashboard-status-live">
            <CheckCircle2 aria-hidden className="size-4" />
            {copy.savedAt(formatSubmittedTime(data.final.submittedAt))}
          </span>
        )}
      </div>
      {data.teams.length === 0 && (
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.noTeams}</p>
      )}
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) save.mutate({ name, links });
        }}
      >
        {links.map((link, i) => {
          const match = matches[i];
          const inputId = `${id}-place-${i}`;
          const status = `${inputId}-status`;
          return (
            <div key={i} className="flex flex-col gap-1">
              <label
                htmlFor={inputId}
                className="text-sm font-semibold text-dashboard-text-medium"
              >
                {copy.place(i + 1)}
              </label>
              <input
                id={inputId}
                value={link}
                inputMode="url"
                autoComplete="off"
                placeholder={copy.placeholder}
                aria-describedby={status}
                aria-invalid={link.trim() !== "" && (!match || dupes[i])}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = e.target.value;
                  setLinks(next);
                }}
                className="min-h-11 w-full min-w-0 rounded-dashboard-md border border-dashboard-border-default bg-dashboard-bg-surface px-3 text-base font-medium text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus:border-dashboard-action-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
              />
              <p
                id={status}
                aria-live="polite"
                className={cn(
                  "m-0 flex min-h-5 items-start gap-1 break-all text-xs font-medium",
                  match && !dupes[i]
                    ? "text-dashboard-text-medium"
                    : "text-dashboard-text-warning",
                )}
              >
                {link.trim() === "" ? null : match && !dupes[i] ? (
                  <>
                    <CheckCircle2
                      aria-hidden
                      className="mt-px size-3.5 shrink-0 text-dashboard-status-live"
                    />
                    {copy.match(match.name)} ·{" "}
                    {teamIdAndLink(match.id, match.devpostUrl)}
                  </>
                ) : (
                  <>
                    <CircleAlert
                      aria-hidden
                      className="mt-px size-3.5 shrink-0"
                    />
                    {match
                      ? copy.duplicate
                      : linkIsAmbiguous(link, data.teams)
                        ? copy.ambiguous
                        : copy.noMatch}
                  </>
                )}
              </p>
            </div>
          );
        })}
        {save.isError && (
          <p className="m-0 text-sm font-medium text-dashboard-status-warning">
            {save.error.data?.code === "BAD_REQUEST"
              ? save.error.message
              : copy.failed}
          </p>
        )}
        <DashboardButton
          type="submit"
          disabled={!ready || save.isPending}
          className="self-start disabled:cursor-not-allowed disabled:opacity-dashboard-disabled"
        >
          {save.isPending ? copy.saving : copy.save(top)}
        </DashboardButton>
      </form>
    </section>
  );
}
