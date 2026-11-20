import { CircleCheck, Lock } from "lucide-react";
import { card, Note } from "~/components/sponsors/portal-ui";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { cn } from "~/lib/utils";
import { LinkButton, sessionLabel, type SetupData } from "./shared";

const copy = sponsorSetupCopy.submittedLock;

/** "Submitted. To change anything, ask your point of contact." */
export function SubmittedNote({ className }: { className?: string }) {
  return (
    <Note icon={<Lock aria-hidden />} className={className}>
      {copy.note}
    </Note>
  );
}

/**
 * Send availability after the sponsor submitted it (submitted once,
 * decisions 2026-11-20): a read-only summary of their team and times in
 * place of the forms, and who to ask for a change.
 */
export function AvailabilitySummary({
  data,
  homeHref,
}: {
  data: SetupData;
  homeHref: string;
}) {
  return (
    <section
      aria-labelledby="availability-summary"
      className={cn(card, "gap-4")}
    >
      <h2
        id="availability-summary"
        className="m-0 flex items-center gap-2 text-xl font-semibold"
      >
        <CircleCheck
          aria-hidden
          className="size-5 shrink-0 text-dashboard-status-live"
        />
        {copy.availabilityTitle}
      </h2>
      <p className="m-0 text-sm text-dashboard-text-medium">
        {copy.perChat(data.hackersPerChat)}
      </p>
      <ul className="m-0 flex list-none flex-col p-0">
        {data.reps.map((r) => (
          <li
            key={r.id}
            className="flex flex-col gap-0.5 border-t border-dashboard-border-subtle py-2.5 first:border-t-0 first:pt-0"
          >
            <span className="font-semibold">
              {copy.rep(r.name, r.chatsWanted)}
              {r.isPrimary && (
                <span className="ml-2 rounded-full bg-dashboard-bg-highlight px-2 py-0.5 text-xs font-semibold text-dashboard-text-active">
                  {copy.primary}
                </span>
              )}
            </span>
            <span className="text-sm text-dashboard-text-light">
              {r.free.length
                ? copy.free(r.free.map(sessionLabel).join(", "))
                : copy.noTimes}
            </span>
          </li>
        ))}
      </ul>
      <SubmittedNote />
      <LinkButton href={homeHref} variant="outline">
        {sponsorSetupCopy.back}
      </LinkButton>
    </section>
  );
}
