import Link from "next/link";
import { CalendarDays, ChevronRight, ScanLine, Users } from "lucide-react";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { LinkButton, type SetupData } from "./shared";
import { YourChats } from "./your-chats";

const copy = sponsorSetupCopy.home;

/**
 * Chats home, in the order of the job (simplify-decisions, "Chats home"):
 * - before submit: the preferences card with "Start" (the only filled
 *   button), then the shortlist card (locked), then "Add a hacker";
 * - after submit: the status card, then the shortlist, then preferences;
 * - after Send: the status card, "Your chats", then one line of setup links.
 */
export function ChatsHome({
  status,
  sponsor,
  data,
  prefsHref,
  teamHref,
  shortlistHref,
  scanHref,
}: {
  /** The status card, right under the title. */
  status: React.ReactNode;
  sponsor: string;
  data: SetupData;
  prefsHref: string;
  /** Step 1 of preferences (Your team), for "Change your team or times". */
  teamHref: string;
  shortlistHref: string;
  scanHref: string;
}) {
  const shortlistQ = api.sponsorShortlist.list.useQuery(
    { sponsor },
    { enabled: !!data.submittedAt, retry: 1, refetchOnWindowFocus: false },
  );
  const picked = shortlistQ.data?.picked ?? 0;
  const cap = shortlistQ.data?.maxShortlist ?? data.totals.hackers;
  const submitted = !!data.submittedAt;
  const prefsStatus = data.confirmed
    ? copy.prefs.confirmed
    : submitted
      ? copy.prefs.submitted
      : data.reps.length > 0
        ? copy.prefs.draft
        : copy.prefs.notStarted;
  const shortlistStatus = !submitted
    ? copy.shortlist.locked
    : data.shortlistSubmittedAt && picked <= cap
      ? copy.shortlist.submitted(picked, cap)
      : copy.shortlist.seats(picked, cap);

  // The page title ("Coffee chats") is the shell's heading.
  const header = (
    <p data-tour="chats-home" className="m-0 max-w-[62ch] text-base text-dashboard-text-medium">
      {copy.intro}
    </p>
  );

  const scan = (
    <div className="flex flex-col gap-1">
      <LinkButton href={scanHref} variant="outline">
        <ScanLine aria-hidden className="size-5" />
        {copy.scan}
      </LinkButton>
      <p className="m-0 text-sm text-dashboard-text-light">
        {copy.scanHint}
        {data.scannedCount > 0 && ` · ${copy.scanned(data.scannedCount)}`}
      </p>
    </div>
  );

  // After Send: the chats they came for first, setup one tap away.
  if (data.confirmed) {
    const a = copy.afterSend;
    return (
      <>
        {header}
        {status}
        <YourChats data={data} />
        <section aria-labelledby="setup-links" className="flex flex-col gap-2">
          <h2 id="setup-links" className="dashboard-section-label m-0 text-dashboard-text-light">
            {a.heading}
          </h2>
          <ul className="m-0 flex list-none flex-col divide-y divide-dashboard-border-subtle rounded-dashboard-lg bg-dashboard-bg-surface p-0 shadow-dashboard-card">
            <SetupLink href={teamHref} icon={<CalendarDays aria-hidden className="size-5" />} title={a.change} />
            <SetupLink
              href={shortlistHref}
              icon={<Users aria-hidden className="size-5" />}
              title={a.shortlist}
              detail={shortlistStatus}
            />
            <SetupLink
              href={scanHref}
              icon={<ScanLine aria-hidden className="size-5" />}
              title={copy.scan}
              detail={data.scannedCount > 0 ? copy.scanned(data.scannedCount) : undefined}
            />
          </ul>
        </section>
      </>
    );
  }

  const prefsCard = (
    <EntryCard
      icon={<CalendarDays aria-hidden className="size-6" />}
      tag={copy.prefs.tag}
      title={copy.prefs.title}
      body={copy.prefs.body}
      status={prefsStatus}
      good={submitted}
      action={
        // The one filled button until preferences are in.
        <LinkButton href={prefsHref} variant={submitted ? "outline" : "primary"}>
          {submitted ? copy.prefs.view : data.reps.length ? copy.prefs.continue : copy.prefs.start}
        </LinkButton>
      }
    />
  );
  const shortlistCard = (
    <EntryCard
      icon={<Users aria-hidden className="size-6" />}
      tag={copy.shortlist.tag}
      title={copy.shortlist.title}
      body={copy.shortlist.body}
      status={shortlistStatus}
      good={!!data.shortlistSubmittedAt}
      action={
        submitted ? (
          <LinkButton href={shortlistHref} variant={data.shortlistSubmittedAt ? "outline" : "primary"}>
            {data.shortlistSubmittedAt ? copy.shortlist.view : picked ? copy.shortlist.continue : copy.shortlist.start}
          </LinkButton>
        ) : null
      }
    />
  );

  return (
    <>
      {header}
      {status}
      <div className="grid gap-4 md:grid-cols-2">
        {submitted ? (
          <>
            {shortlistCard}
            {prefsCard}
          </>
        ) : (
          <>
            {prefsCard}
            {shortlistCard}
          </>
        )}
      </div>
      {scan}
    </>
  );
}

function SetupLink({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex min-h-14 items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
          pressable,
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-dashboard-md bg-dashboard-bg-highlight text-dashboard-text-active">
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-semibold text-dashboard-text-link">{title}</span>
          {detail && <span className="text-sm text-dashboard-text-medium">{detail}</span>}
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-dashboard-text-light" />
      </Link>
    </li>
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
