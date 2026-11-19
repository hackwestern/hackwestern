import Link from "next/link";
import { CalendarDays, ScanLine, Users } from "lucide-react";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { LinkButton, type SetupData } from "./shared";
import { YourChats } from "./your-chats";

const copy = sponsorSetupCopy.home;

/** Chats home: the two flows (preferences, shortlist), scanning, Your chats. */
export function ChatsHome({
  status,
  sponsor,
  data,
  prefsHref,
  shortlistHref,
  scanHref,
}: {
  /** The status card, right under the title. */
  status: React.ReactNode;
  sponsor: string;
  data: SetupData;
  prefsHref: string;
  shortlistHref: string;
  scanHref: string;
}) {
  const shortlistQ = api.sponsorShortlist.list.useQuery(
    { sponsor },
    { enabled: !!data.submittedAt, retry: 1, refetchOnWindowFocus: false },
  );
  const picked = shortlistQ.data?.picked ?? 0;
  const cap = shortlistQ.data?.maxShortlist ?? data.totals.hackers;
  const prefsStatus = data.confirmed
    ? copy.prefs.confirmed
    : data.submittedAt
      ? copy.prefs.submitted
      : data.reps.length > 0
        ? copy.prefs.draft
        : copy.prefs.notStarted;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="dashboard-h1 m-0">{copy.title}</h1>
        <p className="m-0 max-w-2xl text-base text-dashboard-text-medium">{copy.intro}</p>
      </div>

      {status}

      <div className="flex flex-col gap-1">
        <Link
          href={scanHref}
          className={cn(
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-dashboard-lg bg-dashboard-action-primary px-4 text-base font-semibold text-dashboard-text-inverse shadow-dashboard-primary-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2 sm:w-fit",
            pressable,
          )}
        >
          <ScanLine aria-hidden className="size-5" />
          {copy.scan}
        </Link>
        <p className="m-0 text-sm text-dashboard-text-light">
          {copy.scanHint}
          {data.scannedCount > 0 && ` · ${copy.scanned(data.scannedCount)}`}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <EntryCard
          icon={<CalendarDays aria-hidden className="size-6" />}
          tag={copy.prefs.tag}
          title={copy.prefs.title}
          body={copy.prefs.body}
          status={prefsStatus}
          good={!!data.submittedAt}
          action={
            <LinkButton href={prefsHref}>
              {data.submittedAt ? copy.prefs.view : data.reps.length ? copy.prefs.continue : copy.prefs.start}
            </LinkButton>
          }
        />
        <EntryCard
          icon={<Users aria-hidden className="size-6" />}
          tag={copy.shortlist.tag}
          title={copy.shortlist.title}
          body={copy.shortlist.body}
          status={
            !data.submittedAt
              ? copy.shortlist.locked
              : data.shortlistSubmittedAt
                ? copy.shortlist.submitted(picked, cap)
                : copy.shortlist.seats(picked, cap)
          }
          good={!!data.shortlistSubmittedAt}
          action={
            data.submittedAt ? (
              <LinkButton href={shortlistHref}>
                {data.shortlistSubmittedAt ? copy.shortlist.view : picked ? copy.shortlist.continue : copy.shortlist.start}
              </LinkButton>
            ) : null
          }
        />
      </div>

      {data.confirmed && <YourChats data={data} />}
    </>
  );
}

function EntryCard({
  icon,
  tag,
  title,
  body,
  status,
  good,
  action,
}: {
  icon: React.ReactNode;
  tag: string;
  title: string;
  body: string;
  status: string;
  good: boolean;
  action: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-dashboard-lg border-t-4 border-dashboard-action-primary bg-dashboard-bg-surface p-5 shadow-dashboard-card">
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-11 items-center justify-center rounded-dashboard-md bg-dashboard-bg-highlight text-dashboard-text-active">
          {icon}
        </span>
        <span className="rounded-full border border-dashboard-action-primary px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-dashboard-text-active">
          {tag}
        </span>
      </div>
      <h2 className="m-0 text-xl font-semibold text-dashboard-text-active">{title}</h2>
      <p className="m-0 text-base text-dashboard-text-medium">{body}</p>
      <p className="m-0 flex items-center gap-2 text-sm font-semibold text-dashboard-text-heavy">
        <span
          aria-hidden
          className={cn("size-2 rounded-full", good ? "bg-dashboard-status-live" : "bg-dashboard-border-medium")}
        />
        {status}
      </p>
      <div className="mt-auto pt-1">{action}</div>
    </section>
  );
}
