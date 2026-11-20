import { useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Link from "next/link";
import { useRouter } from "next/router";
import { Check, Clock, Users } from "lucide-react";
import { btn, card, Note } from "~/components/sponsors/portal-ui";
import { sponsorSetupCopy } from "~/content/sponsor-coffee-setup";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import type { SetupData } from "./shared";
import { YourChats } from "./your-chats";

const copy = sponsorSetupCopy.page;

export type ChatsStage = "new" | "prefs" | "short" | "conf";

/** Which stage the Chats page shows: follows what the sponsor did. */
export function stageOf(data: SetupData): ChatsStage {
  if (data.confirmed) return "conf";
  if (data.shortlistSubmittedAt) return "short";
  if (data.submittedAt) return "prefs";
  return "new";
}

/**
 * The Chats page (mock sponsor-chats-v3), one stage at a time under a
 * 2-step line: A. Not started (one card, Start), B. Availability sent (the
 * optional shortlist card), C. Shortlist sent (we'll confirm by 10 PM), D.
 * Confirmed (Your chats, with "Change your team or times" at the bottom).
 * Finished steps shrink to one line with Change / Edit.
 */
export function ChatsHome({
  sponsor,
  data,
  startHref,
  changeHref,
  teamHref,
  shortlistHref,
}: {
  sponsor: string;
  data: SetupData;
  /** Not started: Your team, or Availability once the team is in. */
  startHref: string;
  /** "Availability sent · Change": the availability step. */
  changeHref: string;
  /** "Change your team or times" after invites: Your team. */
  teamHref: string;
  shortlistHref: string;
}) {
  const stage = stageOf(data);
  const shortlistQ = api.sponsorShortlist.list.useQuery(
    { sponsor },
    { enabled: !!data.submittedAt, retry: 1, refetchOnWindowFocus: false },
  );
  // Unknown while the shortlist loads, so "(0)" or "Skipped" never flash.
  const picked = shortlistQ.data?.picked;

  return (
    <div className="flex flex-col gap-5" data-stage={stage}>
      <StepsLine
        stage={stage}
        reps={data.reps.length}
        picked={picked ?? 0}
        shortlistSent={!!data.shortlistSubmittedAt}
      />
      {stage === "new" && (
        <section aria-labelledby="stage-new" className={cn(card, "gap-3.5 border-t-[6px] border-dashboard-action-primary")}>
          <p className="m-0 text-xs font-extrabold uppercase tracking-wide text-dashboard-text-active">
            {copy.stageNew.kick}
          </p>
          <h2 id="stage-new" className="m-0 text-[22px] font-bold leading-tight">
            {copy.stageNew.title}
          </h2>
          <p className="m-0 max-w-[62ch]">{copy.stageNew.body}</p>
          <Link href={startHref} className={cn(btn.primary, btn.lg, "self-stretch sm:self-start")}>
            {data.reps.length ? copy.stageNew.continue : copy.stageNew.start}
          </Link>
        </section>
      )}
      {(stage === "prefs" || stage === "short") && (
        <div className="flex flex-col gap-2">
          <DoneLine text={copy.availabilitySent} action={copy.change} label={copy.changeLabel} href={changeHref} />
          {stage === "short" && (
            <DoneLine
              text={copy.shortlistSent}
              count={picked}
              action={copy.edit}
              label={copy.editLabel}
              href={shortlistHref}
            />
          )}
        </div>
      )}
      {stage === "prefs" && (
        <section aria-labelledby="stage-short" className={cn(card, "gap-3.5 border-t-[6px] border-dashboard-group-border")}>
          <p className="m-0 text-xs font-extrabold uppercase tracking-wide text-dashboard-group-text">
            {copy.stagePrefs.kick}
          </p>
          <h2 id="stage-short" className="m-0 text-[22px] font-bold leading-tight">
            {copy.stagePrefs.title}
          </h2>
          <Note icon={<Users aria-hidden />} className="max-w-[62ch]">
            {copy.stagePrefs.note}
          </Note>
          <p className="m-0 text-[15px] tabular-nums text-dashboard-text-medium">
            {picked ? (
              <>
                <b className="text-xl text-dashboard-text-heavy">
                  {copy.stagePrefs.picked(picked, shortlistQ.data?.maxShortlist ?? data.totals.hackers)}
                </b>{" "}
                {copy.stagePrefs.pickedSuffix}
              </>
            ) : (
              <>
                <b className="text-xl font-bold text-dashboard-text-heavy">{data.totals.hackers}</b>{" "}
                {copy.stagePrefs.seatsWord(data.totals.hackers)}
              </>
            )}{" "}
            · {copy.stagePrefs.due}
          </p>
          <Link href={shortlistHref} className={cn(btn.group, btn.lg, "self-stretch sm:self-start")}>
            {picked ? copy.stagePrefs.continue : copy.stagePrefs.start}
          </Link>
          <p className="m-0 text-sm text-dashboard-text-light">{copy.stagePrefs.skip}</p>
        </section>
      )}
      {stage === "short" && (
        <section aria-labelledby="stage-wait" className={card}>
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-highlight text-dashboard-text-active">
              <Clock aria-hidden className="size-6" />
            </span>
            <div className="flex flex-col gap-0.5">
              <h2 id="stage-wait" className="m-0 text-xl font-semibold">
                {copy.stageShort.title}
              </h2>
              <p className="m-0 text-sm text-dashboard-text-light">{copy.stageShort.body}</p>
            </div>
          </div>
        </section>
      )}
      {stage === "conf" && <Confirmed data={data} teamHref={teamHref} />}
    </div>
  );
}

function StepsLine({
  stage,
  reps,
  picked,
  shortlistSent,
}: {
  stage: ChatsStage;
  reps: number;
  picked: number;
  shortlistSent: boolean;
}) {
  const s = copy.steps;
  const one = stage === "new" ? "cur" : "done";
  const two = stage === "new" ? "lock" : stage === "prefs" ? "cur" : "done";
  const sub1 = stage === "new" ? (reps ? s.inProgress : s.required) : s.sent;
  const sub2 =
    stage === "new"
      ? s.unlocks
      : stage === "prefs"
        ? picked
          ? s.optionalPicked(picked)
          : s.optional
        : stage === "short" || shortlistSent
          ? s.sent
          : s.skipped;
  const item = (state: "cur" | "done" | "lock", n: number, title: string, sub: string) => (
    <li
      aria-current={state === "cur" ? "step" : undefined}
      className={cn("flex min-w-0 items-start gap-2", state === "lock" && "opacity-60")}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-sm font-bold tabular-nums",
          state === "lock" && "border-dashed border-dashboard-border-control bg-dashboard-bg-inset text-dashboard-text-light",
          state === "cur" &&
            "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse shadow-[0_0_0_4px_theme(colors.dashboard.action.halo)]",
          state === "done" && "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse",
        )}
      >
        {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : n}
      </span>
      <span className="min-w-0">
        <b
          className={cn(
            "block text-[15px] leading-7",
            state === "cur" ? "font-bold text-dashboard-text-active" : state === "done" ? "font-semibold" : "font-semibold text-dashboard-text-medium",
          )}
        >
          {title}
        </b>
        <small className="-mt-0.5 block text-[13px] leading-tight text-dashboard-text-light">{sub}</small>
      </span>
      <span className="sr-only">({s.state[state]})</span>
    </li>
  );
  return (
    <ol
      aria-label={s.label}
      className="m-0 grid list-none grid-cols-[auto_auto_minmax(0,1fr)] items-start gap-x-3 p-0"
    >
      {item(one, 1, s.one, sub1)}
      <li aria-hidden className="font-semibold leading-7 text-dashboard-text-light">
        {s.arrow}
      </li>
      {item(two, 2, s.two, sub2)}
    </ol>
  );
}

function DoneLine({
  text,
  count,
  action,
  label,
  href,
}: {
  text: string;
  count?: number;
  action: string;
  label: string;
  href: string;
}) {
  return (
    <p className="m-0 flex min-h-[52px] flex-wrap items-center gap-x-2 rounded-dashboard-lg bg-dashboard-bg-surface py-1 pl-3.5 pr-1.5 text-[15px] shadow-dashboard-card">
      <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-dashboard-status-live text-dashboard-text-inverse">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
      <b className="font-semibold">
        {text}
        {count !== undefined && <span className="tabular-nums"> ({count})</span>}
      </b>
      <span aria-hidden className="text-dashboard-text-light">
        ·
      </span>
      <Link href={href} aria-label={label} className={btn.link}>
        {action}
      </Link>
    </p>
  );
}

function Confirmed({ data, teamHref }: { data: SetupData; teamHref: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const hackers = data.chats.flatMap((c) => c.hackers);
  const confirmed = hackers.filter((h) => h.status === "accepted").length;
  const waiting = hackers.length - confirmed;
  const chats = data.chats.reduce((n, c) => n + c.chats, 0);
  const s = copy.summary;
  const warn = sponsorSetupCopy.afterInvites;
  return (
    <>
      <section aria-label={s.label} className={card}>
        <p className="m-0 text-lg tabular-nums text-dashboard-text-medium">
          <b className="text-[28px] font-extrabold tracking-tight text-dashboard-text-heavy">{confirmed}</b> {s.confirmed}{" "}
          <span aria-hidden className="mx-1 text-dashboard-text-light">
            ·
          </span>{" "}
          <b className="text-[28px] font-extrabold tracking-tight text-dashboard-text-heavy">{waiting}</b> {s.waiting}
        </p>
        <p className="m-0 text-sm tabular-nums text-dashboard-text-light">{s.line(chats)}</p>
      </section>
      <YourChats data={data} />
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="min-h-11 self-start px-1 font-medium text-dashboard-text-light underline underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:text-dashboard-text-heavy"
      >
        {copy.changeAsk}
      </button>
      <AlertDialog.Root open={asking} onOpenChange={setAsking}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-dashboard-lg bg-dashboard-bg-surface p-6 font-figtree shadow-dashboard-card">
            <AlertDialog.Title className="m-0 text-xl font-bold text-dashboard-text-heavy">{warn.title}</AlertDialog.Title>
            <AlertDialog.Description className="m-0 text-base text-dashboard-text-medium">
              {warn.body(hackers.length)}
            </AlertDialog.Description>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <AlertDialog.Action asChild>
                <button type="button" className={btn.danger} onClick={() => void router.push(teamHref)}>
                  {warn.confirm}
                </button>
              </AlertDialog.Action>
              <AlertDialog.Cancel asChild>
                <button type="button" className={btn.outline}>
                  {warn.cancel}
                </button>
              </AlertDialog.Cancel>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
