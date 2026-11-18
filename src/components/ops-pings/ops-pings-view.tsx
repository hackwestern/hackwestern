import { useMemo, useState } from "react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { ReadAt } from "~/components/sponsors/schedule-states";
import { opsPingsCopy } from "~/content/ops-pings";
import { formatClock, RUN_OF_SHOW_DAYS } from "~/lib/run-of-show";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/utils/api";
import { api } from "~/utils/api";

const copy = opsPingsCopy.page;

type Overview = Extract<RouterOutputs["opsPings"]["overview"], { ok: true }>;
type Task = Overview["tasks"][number];
type Owner = Task["owners"][number];
type Ping = Task["pings"][number];
type SyncResult = RouterOutputs["opsPings"]["sync"];

/** "Sat 12:50 PM", in event time. */
const pingClock = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
});
const when = (d: Date) => pingClock.format(new Date(d));

const WARN = "text-dashboard-text-warning";

type PersonLike = Extract<Owner, { kind: "person" }> | { token: string; status: string; name?: string; via?: string; candidates?: string[] };

function personLabel(p: PersonLike): { text: string; warn: boolean } {
  switch (p.status) {
    case "matched": {
      const via = p.via ? copy.owner.via[p.via] : "";
      return { text: `${p.token} → ${p.name}${via ? ` (${via})` : ""}`, warn: p.via === "close" };
    }
    case "ambiguous":
      return { text: `${p.token}: ${copy.owner.ambiguous(p.candidates ?? [])}`, warn: true };
    case "no-slack":
      return { text: `${p.token} → ${p.name}: ${copy.owner.noSlack}`, warn: true };
    default:
      return { text: `${p.token}: ${copy.owner.noMatch}`, warn: true };
  }
}

function OwnerItem({ owner }: { owner: Owner }) {
  if (owner.kind === "everyone") {
    return <li className="text-dashboard-text-light">{copy.owner.everyone}</li>;
  }
  if (owner.kind === "spon") {
    if (!owner.members) return <li className={WARN}>{copy.owner.sponUnavailable}</li>;
    return (
      <li>
        <span className="text-dashboard-text-medium">
          {owner.token}: {copy.owner.spon(owner.members.length)}
        </span>
        <ul className="m-0 list-none pl-3">
          {owner.members.map((m) => {
            const l = personLabel(m);
            return (
              <li key={m.token} className={cn(l.warn && WARN)}>
                {l.text}
              </li>
            );
          })}
        </ul>
      </li>
    );
  }
  const l = personLabel(owner);
  return <li className={cn(l.warn && WARN)}>{l.text}</li>;
}

function PingItem({ ping, label }: { ping: Ping; label: string }) {
  const counts = new Map<string, number>();
  for (const d of ping.deliveries) counts.set(d.status, (counts.get(d.status) ?? 0) + 1);
  const failed = ping.deliveries.filter((d) => d.status === "failed");
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold tabular-nums">{label}</span>
        {ping.deliveries.length === 0 ? (
          <DashboardTag>{copy.ping.nobody}</DashboardTag>
        ) : (
          [...counts].map(([status, n]) => (
            <DashboardTag key={status} className={cn(status === "failed" && WARN)}>
              {copy.ping.status[status] ?? status} · {copy.ping.recipients(n)}
            </DashboardTag>
          ))
        )}
      </div>
      {failed.map((d) => (
        <span key={d.slackUserId} className={cn("text-xs", WARN)}>
          {d.name}: {copy.ping.failedWith(d.error ?? "error")}
        </span>
      ))}
      <details className="text-sm">
        <summary className="cursor-pixel-hover text-dashboard-text-link">
          {ping.kind === "start" ? copy.preview : copy.previewEnd}
        </summary>
        <pre className="m-0 mt-1 whitespace-pre-wrap break-words rounded-dashboard-md bg-dashboard-bg-inset p-3 font-figtree text-sm text-dashboard-text-medium">
          {ping.text}
        </pre>
      </details>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const time = task.end
    ? `${formatClock(task.start)} – ${formatClock(task.end)}`
    : formatClock(task.start);
  return (
    <li className="flex flex-col gap-3 border-b border-dashboard-border-default p-4 last:border-b-0 sm:grid sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4 sm:px-5">
      <div className="flex flex-col">
        <span className="text-sm font-semibold tabular-nums">{time}</span>
        <span className="text-xs text-dashboard-text-light">
          {task.end ? (task.endSource === "cell" ? copy.endFromCell : null) : copy.noEnd}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="break-words font-semibold">{task.title}</span>
        <span className="text-xs text-dashboard-text-light">
          {[task.location ? copy.where(task.location) : null, task.column, copy.cell(task.cell)]
            .filter(Boolean)
            .join(" · ")}
        </span>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm text-dashboard-text-medium">
          {task.owners.map((o, i) => (
            <OwnerItem key={`${o.token}-${i}`} owner={o} />
          ))}
        </ul>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {task.pings.map((p) => (
          <PingItem
            key={p.kind}
            ping={p}
            label={p.kind === "start" ? copy.ping.start(when(p.postAt)) : copy.ping.end(when(p.postAt))}
          />
        ))}
      </div>
    </li>
  );
}

function syncMessage(r: SyncResult): { text: string; warn: boolean } {
  if (r.ok) return { text: copy.syncDone(r), warn: r.failed > 0 };
  const byReason: Record<string, string> = {
    "no-token": copy.noToken,
    "not-configured": copy.sheetNotConfigured,
    "sheet-error": copy.sheetError,
    "slack-error": copy.slackError,
  };
  return { text: byReason[r.reason] ?? copy.syncError, warn: true };
}

const isPast = (t: Task, now: number) =>
  t.pings.every((p) => new Date(p.postAt).getTime() <= now);

export function OpsPingsView() {
  const overview = api.opsPings.overview.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });
  const utils = api.useUtils();
  const [result, setResult] = useState<{ text: string; warn: boolean } | null>(null);
  const sync = api.opsPings.sync.useMutation({
    onSuccess: (r) => {
      setResult(syncMessage(r));
      void utils.opsPings.overview.invalidate();
    },
    onError: () => setResult({ text: copy.syncError, warn: true }),
  });
  const [showPast, setShowPast] = useState(false);

  const data = overview.data;
  const now = Date.now();
  const byDay = useMemo(() => {
    if (!data?.ok) return [];
    return RUN_OF_SHOW_DAYS.map((day) => ({
      day,
      tasks: data.tasks.filter((t) => t.day === day && (showPast || !isPast(t, now))),
    })).filter((d) => d.tasks.length > 0);
    // `now` only matters per refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, showPast]);

  if (overview.isLoading) {
    return (
      <div
        aria-busy="true"
        className="h-40 w-full rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card motion-safe:animate-pulse"
      />
    );
  }
  if (!data) {
    return (
      <DashboardPanel className="flex-row flex-wrap items-center gap-3">
        <span className={cn("text-sm", WARN)}>{copy.loadError}</span>
        <DashboardButton variant="outline" onClick={() => void overview.refetch()}>
          {copy.retry}
        </DashboardButton>
      </DashboardPanel>
    );
  }
  if (!data.ok) {
    return (
      <DashboardPanel className="gap-3">
        <span className={cn("text-sm", WARN)}>
          {data.reason === "not-configured" ? copy.sheetNotConfigured : copy.sheetError}
        </span>
        <div>
          <DashboardButton variant="outline" onClick={() => void overview.refetch()}>
            {copy.retry}
          </DashboardButton>
        </div>
      </DashboardPanel>
    );
  }

  const flaggedTasks = data.tasks.filter((t) =>
    t.owners.some((o) =>
      o.kind === "person"
        ? o.status !== "matched"
        : o.kind === "spon" && (!o.members || o.members.some((m) => m.status !== "matched")),
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <DashboardPanel className="gap-3">
        {data.slack !== "connected" && (
          <p className={cn("m-0 text-sm", WARN)}>
            {data.slack === "no-token" ? copy.noToken : copy.slackError}
          </p>
        )}
        <p className="m-0 text-sm text-dashboard-text-medium">
          {copy.summary({ tasks: data.tasks.length, flagged: data.flagged, issues: data.issues.length })}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <DashboardButton
            variant="primary"
            disabled={sync.isPending || data.slack === "no-token"}
            onClick={() => {
              setResult(null);
              sync.mutate();
            }}
          >
            {sync.isPending ? copy.refreshing : copy.refresh}
          </DashboardButton>
          {data.sheetUrl && (
            <a
              href={data.sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-dashboard-text-link"
            >
              {copy.sheetLink}
            </a>
          )}
        </div>
        <p className="m-0 text-xs text-dashboard-text-light">{copy.refreshHint}</p>
        {result && (
          <p role="status" className={cn("m-0 text-sm", result.warn ? WARN : "text-dashboard-text-medium")}>
            {result.text}
          </p>
        )}
        <ReadAt iso={data.readAt} />
      </DashboardPanel>

      <section aria-labelledby="ops-attention" className="flex flex-col gap-3">
        <h2 id="ops-attention" className="m-0 text-lg font-semibold">
          {copy.needsAttentionHeading}
        </h2>
        {data.issues.length === 0 && flaggedTasks.length === 0 ? (
          <p className="m-0 text-sm text-dashboard-text-medium">{copy.allClear}</p>
        ) : (
          <DashboardPanel className="gap-2">
            <p className="m-0 text-sm text-dashboard-text-medium">{copy.needsAttentionIntro}</p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
              {data.issues.map((i) => (
                <li key={i.cell} className="break-words">
                  <span className="font-semibold">{copy.cell(i.cell)}</span>
                  {" · "}
                  {i.title}
                  {" · "}
                  <span className={WARN}>{copy.issueReasons[i.reason]}</span>
                </li>
              ))}
              {flaggedTasks.map((t) => (
                <li key={t.cell} className="break-words">
                  <span className="font-semibold">{copy.cell(t.cell)}</span>
                  {" · "}
                  {t.day} {formatClock(t.start)} {t.title}
                  <ul className="m-0 list-none pl-3">
                    {t.owners
                      .filter((o) => o.kind !== "everyone")
                      .map((o, i) => (
                        <OwnerItem key={`${o.token}-${i}`} owner={o} />
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          </DashboardPanel>
        )}
      </section>

      <div className="flex justify-end">
        <DashboardButton variant="link" onClick={() => setShowPast((v) => !v)}>
          {showPast ? copy.hidePast : copy.showPast}
        </DashboardButton>
      </div>

      {byDay.length === 0 ? (
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.noTasks}</p>
      ) : (
        byDay.map(({ day, tasks }) => (
          <section key={day} aria-labelledby={`ops-day-${day}`} className="flex flex-col gap-3">
            <h2 id={`ops-day-${day}`} className="m-0 text-lg font-semibold">
              {copy.dayHeading(day)}
            </h2>
            <DashboardPanel className="gap-0 p-0">
              <ul className="m-0 list-none p-0">
                {tasks.map((t) => (
                  <TaskRow key={t.cell} task={t} />
                ))}
              </ul>
            </DashboardPanel>
          </section>
        ))
      )}
    </div>
  );
}
