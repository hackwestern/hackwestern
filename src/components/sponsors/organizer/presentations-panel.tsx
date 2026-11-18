import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Presentation, TriangleAlert } from "lucide-react";
import {
  DashboardButton,
  dashboardButtonVariants,
} from "~/components/internals/dashboard-button";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { SponsorBadge } from "~/components/sponsors/sponsor-badge";
import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { formatPresentationTime } from "~/lib/sponsor-presentations";
import { formatSubmittedTime } from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";

const copy = sponsorPresentationsCopy.organizer;
const VIEWS = ["rooms", "teams"] as const;
type View = (typeof VIEWS)[number];
type Overview = RouterOutputs["sponsorPresentations"]["overview"];

const REFRESH_MS = 30_000;
const CARD =
  "flex flex-col gap-2 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card";
const WARN =
  "m-0 flex items-start gap-2 rounded-dashboard-lg bg-dashboard-status-iconBadge px-4 py-3 text-sm font-semibold text-dashboard-text-warning";
const NOTE = "m-0 text-sm font-medium text-dashboard-text-medium";

/**
 * Organizer presentations on the Sponsor judging tab
 * (docs/flows/sponsor-judging.md): who sent a shortlist, Schedule
 * presentations (re-runnable; replaces the schedule), the schedule by room
 * or by team with teams that couldn't fit flagged, Notify hackers (Slack;
 * only members without their current times, "Notify again" after a
 * confirm) with members not reached listed, and the sponsor top teams for
 * the cheat check.
 */
export function PresentationsPanel({
  colors,
}: {
  colors: ReadonlyMap<string, number>;
}) {
  const utils = api.useUtils();
  const overview = api.sponsorPresentations.overview.useQuery(undefined, {
    refetchInterval: REFRESH_MS,
    retry: 1,
  });
  const refresh = () => void utils.sponsorPresentations.overview.invalidate();
  const schedule = api.sponsorPresentations.schedule.useMutation({
    onSuccess: () => {
      setConfirming(null);
      refresh();
    },
  });
  // Dry run before replacing a schedule: how many hackers get new times.
  const preview = api.sponsorPresentations.schedule.useMutation({
    onSuccess: (res) =>
      setConfirming({ kind: "schedule", changed: res.changedTimes }),
  });
  const notify = api.sponsorPresentations.notify.useMutation({
    onSuccess: () => {
      setConfirming(null);
      refresh();
    },
  });
  const cheat = api.sponsorPresentations.cheatCheckTopTeams.useMutation();
  const [confirming, setConfirming] = useState<
    { kind: "schedule"; changed: number } | { kind: "resend" } | null
  >(null);
  const [view, setView] = useState<View>("rooms");
  const data = overview.data;

  if (!data) {
    return overview.isError ? <p className={NOTE}>{copy.failed}</p> : null;
  }

  const anySent = data.sponsors.some((s) => s.sentAt);
  const scheduled = data.scheduledAt !== null;
  const { notices } = data;
  const toNotify = notices.notReached.length;
  // Before anyone was tried every member is "not sent": no list yet.
  const attempted =
    notices.reached > 0 ||
    notices.notReached.some((m) => m.reason !== "not-sent");
  const errorOf = (e: { message: string; data?: { code?: string } | null }) =>
    e.data?.code === "BAD_REQUEST" || e.data?.code === "PRECONDITION_FAILED"
      ? e.message
      : copy.failed;
  const busy = schedule.isPending || preview.isPending || notify.isPending;
  const scheduleError = schedule.error ?? preview.error;

  return (
    <section
      aria-labelledby="presentations-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="presentations-heading"
          className="m-0 flex items-center gap-2 text-base font-semibold text-dashboard-text-heavy"
        >
          <Presentation
            aria-hidden
            className="size-4 text-dashboard-text-light"
          />
          {copy.heading}
        </h2>
        <p className={NOTE}>{copy.intro}</p>
      </div>

      {/* Who has sent a shortlist. */}
      <ul
        aria-label={copy.sentLabel}
        className="m-0 flex list-none flex-wrap gap-2 p-0"
      >
        {data.sponsors.map((s) => (
          <li
            key={s.sponsorId}
            className="inline-flex items-center gap-2 rounded-dashboard-lg bg-dashboard-bg-surface px-3 py-2 shadow-dashboard-card"
          >
            <SponsorBadge name={s.name} colors={colors} />
            <span className="text-sm font-semibold text-dashboard-text-heavy">
              {s.name}
            </span>
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                s.sentAt
                  ? "text-dashboard-status-live"
                  : "text-dashboard-text-light",
              )}
            >
              {s.sentAt
                ? copy.sent(formatSubmittedTime(s.sentAt), s.sentCount)
                : copy.notSent}
            </span>
            {s.sentAfterSchedule && (
              <span className="rounded-dashboard-sm bg-dashboard-status-iconBadge px-2 py-0.5 text-xs font-semibold leading-5 text-dashboard-text-warning">
                {copy.sentAfterSchedule}
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Schedule and notify. */}
      <div className="flex flex-col gap-2">
        {confirming ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className={NOTE}>
              {confirming.kind === "schedule"
                ? copy.rescheduleConfirm(confirming.changed)
                : copy.resendConfirm(notices.reached)}
            </p>
            <div className="flex shrink-0 gap-2">
              <DashboardButton
                variant="small"
                onClick={() => setConfirming(null)}
                disabled={busy}
              >
                {copy.cancel}
              </DashboardButton>
              {confirming.kind === "schedule" ? (
                <DashboardButton
                  variant="small"
                  onClick={() => schedule.mutate()}
                  disabled={busy}
                >
                  {schedule.isPending ? copy.scheduling : copy.confirm}
                </DashboardButton>
              ) : (
                <DashboardButton
                  variant="small"
                  onClick={() => notify.mutate({ resend: true })}
                  disabled={busy}
                >
                  {notify.isPending ? copy.notifying : copy.resendButton}
                </DashboardButton>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <DashboardButton
              variant="small"
              disabled={!anySent || busy}
              onClick={() =>
                scheduled ? preview.mutate({ dryRun: true }) : schedule.mutate()
              }
            >
              {schedule.isPending
                ? copy.scheduling
                : preview.isPending
                  ? copy.checking
                  : scheduled
                    ? copy.reschedule
                    : copy.schedule}
            </DashboardButton>
            {/* Only members who don't have their current times. */}
            <DashboardButton
              variant="small"
              disabled={data.slots.length === 0 || toNotify === 0 || busy}
              onClick={() => notify.mutate()}
            >
              {notify.isPending
                ? copy.notifying
                : notices.reached > 0
                  ? copy.notifyRest(toNotify)
                  : copy.notify}
            </DashboardButton>
            {notices.reached > 0 && (
              <DashboardButton
                variant="small"
                disabled={busy}
                onClick={() => setConfirming({ kind: "resend" })}
              >
                {copy.notifyAgain}
              </DashboardButton>
            )}
          </div>
        )}
        <p className={NOTE} aria-live="polite">
          {!anySent
            ? copy.nothingSent
            : scheduled
              ? copy.scheduledAt(
                  formatSubmittedTime(data.scheduledAt!),
                  data.slots.length,
                )
              : copy.notScheduled}
          {scheduled && data.slots.length > 0 && (
            <>
              {" · "}
              {notices.lastSentAt
                ? copy.notified(
                    notices.reached,
                    notices.members,
                    formatSubmittedTime(notices.lastSentAt),
                  )
                : copy.notNotified}
            </>
          )}
        </p>
        {scheduleError && <p className={WARN}>{errorOf(scheduleError)}</p>}
        {notify.isError && (
          <p role="alert" className={WARN}>
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {errorOf(notify.error)}
          </p>
        )}
        {notify.data && (
          <p role="status" className={NOTE}>
            {copy.notifyResult(
              notify.data.sent,
              notify.data.notOnSlack.length,
              notify.data.failed,
              notify.data.skipped,
            )}
            {notify.data.notOnSlack.length > 0 && (
              <> {copy.notOnSlack(notify.data.notOnSlack.join(", "))}</>
            )}
          </p>
        )}
        {attempted && toNotify > 0 && (
          <div className={cn(WARN, "flex-col gap-1.5")}>
            <span className="inline-flex items-center gap-2">
              <TriangleAlert aria-hidden className="size-4 shrink-0" />
              {copy.notReached(toNotify)}
            </span>
            <ul className="m-0 list-none p-0 pl-6 font-medium">
              {notices.notReached.map((m) => (
                <li key={m.userId}>
                  {copy.memberOf(
                    m.name,
                    m.teamName,
                    copy.notReachedReasons[m.reason],
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {data.unplaced.length > 0 && (
        <div role="status" className={cn(WARN, "flex-col gap-1.5")}>
          <span className="inline-flex items-center gap-2">
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            {copy.flagged(data.unplaced.length)}
          </span>
          <ul className="m-0 list-none p-0 pl-6 font-medium">
            {data.unplaced.map((u) => (
              <li key={`${u.sponsorId}:${u.teamId}`}>
                {u.teamName} · {u.sponsorName} · {copy.reasons[u.reason]}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.slots.length > 0 && (
        <div className="flex flex-col gap-3">
          <div
            role="group"
            aria-label={copy.viewsLabel}
            className="flex gap-1.5"
          >
            {VIEWS.map((v) => (
              <DashboardChip
                key={v}
                selected={view === v}
                onClick={() => setView(v)}
                className="min-h-11 md:min-h-9"
              >
                {copy.views[v]}
              </DashboardChip>
            ))}
          </div>
          {view === "rooms" ? (
            <ByRoom data={data} colors={colors} />
          ) : (
            <ByTeam data={data} />
          )}
        </div>
      )}

      <CheatCheck
        data={data}
        running={cheat.isPending}
        result={cheat.data ?? null}
        failed={cheat.isError}
        onRun={() => cheat.mutate()}
      />
    </section>
  );
}

function ByRoom({
  data,
  colors,
}: {
  data: Overview;
  colors: ReadonlyMap<string, number>;
}) {
  const rooms = useMemo(() => {
    const by = new Map<string, Overview["slots"]>();
    for (const s of data.slots) {
      const list = by.get(s.sponsorId) ?? [];
      list.push(s);
      by.set(s.sponsorId, list);
    }
    return [...by.values()].sort((a, b) =>
      a[0]!.sponsorName.localeCompare(b[0]!.sponsorName),
    );
  }, [data.slots]);
  return (
    <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 xl:grid-cols-3">
      {rooms.map((slots) => {
        const first = slots[0]!;
        return (
          <li key={first.sponsorId} className={CARD}>
            <div className="flex items-center gap-2">
              <SponsorBadge name={first.sponsorName} colors={colors} />
              <h3 className="m-0 min-w-0 flex-1 break-words text-sm font-semibold text-dashboard-text-heavy">
                {copy.roomOf(first.sponsorName, first.room)}
              </h3>
              <span className="text-sm font-medium tabular-nums text-dashboard-text-light">
                {copy.slotCount(slots.length, data.slotsPerRoom)}
              </span>
            </div>
            <ol className="m-0 flex list-none flex-col divide-y divide-dashboard-border-subtle p-0">
              {slots.map((s) => (
                <SlotRow
                  key={s.teamId}
                  time={formatPresentationTime(s.start)}
                  label={s.teamName}
                />
              ))}
            </ol>
          </li>
        );
      })}
    </ul>
  );
}

function ByTeam({ data }: { data: Overview }) {
  const byTeam = useMemo(() => {
    const by = new Map<string, Overview["slots"]>();
    for (const s of data.slots) {
      const list = by.get(s.teamId) ?? [];
      list.push(s);
      by.set(s.teamId, list);
    }
    return [...by.values()].sort((a, b) =>
      a[0]!.teamName.localeCompare(b[0]!.teamName),
    );
  }, [data.slots]);
  return (
    <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 xl:grid-cols-3">
      {byTeam.map((slots) => (
        <li key={slots[0]!.teamId} className={CARD}>
          <div className="flex items-center gap-2">
            <h3 className="m-0 min-w-0 flex-1 break-words text-sm font-semibold text-dashboard-text-heavy">
              {slots[0]!.teamName}
            </h3>
            <span className="text-sm font-medium tabular-nums text-dashboard-text-light">
              {copy.teamSlots(slots.length)}
            </span>
          </div>
          <ol className="m-0 flex list-none flex-col divide-y divide-dashboard-border-subtle p-0">
            {slots.map((s) => (
              <SlotRow
                key={s.sponsorId}
                time={formatPresentationTime(s.start)}
                label={copy.roomOf(s.sponsorName, s.room)}
              />
            ))}
          </ol>
        </li>
      ))}
    </ul>
  );
}

function SlotRow({ time, label }: { time: string; label: string }) {
  return (
    <li className="flex items-baseline gap-3 py-1.5 text-sm">
      <span className="w-16 shrink-0 font-semibold tabular-nums text-dashboard-text-medium">
        {time}
      </span>
      <span className="min-w-0 break-words font-medium text-dashboard-text-heavy">
        {label}
      </span>
    </li>
  );
}

function CheatCheck({
  data,
  running,
  result,
  failed,
  onRun,
}: {
  data: Overview;
  running: boolean;
  result: { teamIds: string[]; failed: number } | null;
  failed: boolean;
  onRun: () => void;
}) {
  const ids = data.topTeams.map((t) => t.teamId);
  return (
    <div className={CARD}>
      <h3 className="m-0 text-sm font-semibold text-dashboard-text-heavy">
        {copy.cheatHeading}
      </h3>
      <p className={NOTE}>
        {ids.length > 0
          ? copy.cheatIntro(data.finalTop, ids.length)
          : copy.cheatNone(data.finalTop)}
      </p>
      {ids.length > 0 && (
        <>
          <p className="m-0 text-sm text-dashboard-text-heavy">
            {data.topTeams.map((t) => t.name).join(", ")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <DashboardButton variant="small" onClick={onRun} disabled={running}>
              {running ? copy.cheatRunning : copy.cheatRun}
            </DashboardButton>
            <Link
              href={`/internal/cheat-check?teams=${ids.map(encodeURIComponent).join(",")}`}
              className={dashboardButtonVariants({ variant: "link" })}
            >
              {copy.cheatOpen}
            </Link>
            {result && (
              <span
                role="status"
                className="inline-flex items-center gap-1 text-sm font-medium text-dashboard-text-medium"
              >
                <CheckCircle2 aria-hidden className="size-4" />
                {copy.cheatDone(result.teamIds.length, result.failed)}
              </span>
            )}
            {failed && (
              <span role="alert" className={NOTE}>
                {copy.failed}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
