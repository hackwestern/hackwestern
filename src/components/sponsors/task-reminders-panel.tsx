import { useState } from "react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { dashboardFieldClass } from "~/components/sponsors/coffee-chat-rooms";
import { useNow } from "~/components/sponsors/use-now";
import { taskRemindersCopy } from "~/content/task-reminders";
import { compareRunOfShow, formatClock } from "~/lib/run-of-show";
import type {
  OwnerMatch,
  TaskOwnerRow,
} from "~/server/api/utils/task-reminders";
import { api } from "~/utils/api";

const copy = taskRemindersCopy.panel;

function ago(from: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - from.getTime()) / 60_000);
  if (minutes < 1) return copy.agoJustNow;
  if (minutes < 60) return copy.agoMinutes(minutes);
  return copy.agoHours(Math.floor(minutes / 60));
}

const time = (d: Date) =>
  formatClock(
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  );

// Slack reminders for team tasks (T49): owners get a DM at each task's start
// time, unowned tasks go to the sponsor team channel. Lives on the Team
// tasks tab; the sync itself runs after each sheet read.
export function TaskRemindersPanel() {
  const now = useNow(30_000);
  const utils = api.useUtils();
  const status = api.taskReminders.status.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });
  const owners = api.taskReminders.owners.useQuery(undefined, { retry: 1 });
  const sync = api.taskReminders.sync.useMutation({
    onSettled: async () => {
      await Promise.all([
        utils.taskReminders.status.invalidate(),
        utils.taskReminders.owners.invalidate(),
      ]);
    },
  });

  const s = status.data;
  const summary = s
    ? [
        s.lastSyncedAt
          ? copy.lastSynced(ago(s.lastSyncedAt, now))
          : copy.neverSynced,
        copy.scheduled(s.scheduled),
        s.toChannel > 0 && copy.toChannel(s.toChannel),
        s.unmatchedOwners.length > 0 && copy.notOnSlack(s.unmatchedOwners.length),
        s.tooSoon > 0 && copy.tooSoon(s.tooSoon),
        s.failures.length > 0 && copy.failed(s.failures.length),
      ].filter(Boolean)
    : [];

  return (
    <DashboardPanel className="gap-4 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold">{copy.heading}</h2>
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.intro}</p>
      </div>

      {status.isLoading ? (
        <div className="h-10 w-full animate-pulse rounded-dashboard-md bg-dashboard-bg-nav" />
      ) : !s ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-dashboard-text-warning">{copy.loadError}</span>
          <DashboardButton
            variant="outline"
            onClick={() => void status.refetch()}
          >
            {copy.retry}
          </DashboardButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-dashboard-text-heavy">
            {summary.join(" · ")}
          </p>
          {!s.slackConnected && (
            <p className="m-0 text-sm text-dashboard-text-warning">
              {copy.noToken}
            </p>
          )}
          {s.slackConnected && !s.channelConfigured && s.noChannelTasks > 0 && (
            <p className="m-0 text-sm text-dashboard-text-warning">
              {copy.noChannel(s.noChannelTasks)}
            </p>
          )}
          {s.sheetError && (
            <p className="m-0 text-sm text-dashboard-text-warning">
              {copy.sheetError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <DashboardButton
              variant="outline"
              className="h-11"
              disabled={sync.isPending || !s.slackConnected}
              onClick={() => sync.mutate()}
            >
              {sync.isPending ? copy.resyncing : copy.resync}
            </DashboardButton>
            <span aria-live="polite" className="text-sm empty:hidden">
              {sync.error ? (
                <span className="text-dashboard-text-warning">
                  {copy.resyncError}
                </span>
              ) : sync.data?.ok ? (
                <span className="text-dashboard-text-light">
                  {copy.resyncDone(sync.data.scheduled, sync.data.cancelled)}
                </span>
              ) : sync.data ? (
                <span className="text-dashboard-text-warning">
                  {copy.resyncNoToken}
                </span>
              ) : null}
            </span>
          </div>
        </div>
      )}

      <section aria-labelledby="reminder-owners" className="flex flex-col gap-2">
        <h3 id="reminder-owners" className="m-0 text-base font-semibold">
          {copy.ownersHeading}
        </h3>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {copy.ownersIntro}
        </p>
        {owners.isLoading ? (
          <div className="h-24 w-full animate-pulse rounded-dashboard-md bg-dashboard-bg-nav" />
        ) : !owners.data ? (
          <p className="m-0 text-sm text-dashboard-text-warning">
            {copy.loadError}
          </p>
        ) : owners.data.owners.length === 0 ? (
          <p className="m-0 text-sm text-dashboard-text-light">
            {copy.ownersEmpty}
          </p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sr-only sm:not-sr-only">
              <tr className="border-b border-dashboard-border-default text-xs uppercase tracking-wide text-dashboard-text-light">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {copy.ownerColumn}
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  {copy.emailColumn}
                </th>
                <th scope="col" className="py-2 font-semibold">
                  {copy.matchColumn}
                </th>
              </tr>
            </thead>
            <tbody>
              {owners.data.owners.map((o) => (
                <OwnerRow key={o.ownerName} owner={o} />
              ))}
            </tbody>
          </table>
        )}
      </section>

      {s && s.unmatchedOwners.length > 0 && (
        <ListSection
          id="reminder-unmatched"
          heading={copy.unmatchedHeading}
          intro={copy.unmatchedIntro}
          items={s.unmatchedOwners.map((name) => ({ key: name, text: name }))}
        />
      )}
      {s && s.noOwnerTasks.length > 0 && (
        <ListSection
          id="reminder-no-owner"
          heading={copy.noOwnerHeading}
          intro={copy.noOwnerIntro}
          items={[...s.noOwnerTasks].sort(compareRunOfShow).map((t, i) => ({
            key: `${t.day}-${t.start}-${i}`,
            text: `${t.day.slice(0, 3)} ${formatClock(t.start)} · ${t.task}`,
          }))}
        />
      )}
      {s && s.failures.length > 0 && (
        <ListSection
          id="reminder-failures"
          heading={copy.failuresHeading}
          items={s.failures.map((f, i) => ({
            key: `${f.postAt.toISOString()}-${i}`,
            text: `${time(f.postAt)} · ${f.task}${f.owner ? ` · ${f.owner}` : ""} · ${f.error}`,
            warning: true,
          }))}
        />
      )}
    </DashboardPanel>
  );
}

function ListSection({
  id,
  heading,
  intro,
  items,
}: {
  id: string;
  heading: string;
  intro?: string;
  items: { key: string; text: string; warning?: boolean }[];
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="m-0 text-base font-semibold">
        {heading}
      </h3>
      {intro && (
        <p className="m-0 text-sm text-dashboard-text-medium">{intro}</p>
      )}
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
        {items.map((item) => (
          <li
            key={item.key}
            className={`whitespace-pre-line break-words ${item.warning ? "text-dashboard-text-warning" : ""}`}
          >
            {item.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

const MATCH_LABEL: Record<OwnerMatch, string> = {
  matched: `✓ ${copy.matched}`,
  "not-found": copy.notFound,
  "not-checked": copy.notChecked,
  "no-email": copy.noEmail,
};

function OwnerRow({ owner }: { owner: TaskOwnerRow }) {
  const utils = api.useUtils();
  const [value, setValue] = useState(owner.slackEmail ?? "");
  const [saved, setSaved] = useState(false);
  const save = api.taskReminders.setOwnerEmail.useMutation({
    onSuccess: async () => {
      setSaved(true);
      await Promise.all([
        utils.taskReminders.owners.invalidate(),
        utils.taskReminders.status.invalidate(),
      ]);
    },
  });
  const slug = owner.ownerName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const inputId = `owner-email-${slug}`;
  const statusId = `${inputId}-status`;
  const dirty = value.trim() !== (owner.slackEmail ?? "");

  return (
    <tr className="flex flex-col gap-2 border-b border-dashboard-border-default py-3 sm:table-row">
      <th
        scope="row"
        className="text-left font-semibold sm:py-3 sm:pr-3 sm:align-middle"
      >
        <span className="break-words">{owner.ownerName}</span>
        <span className="block text-xs font-medium text-dashboard-text-light">
          {copy.taskCount(owner.taskCount)}
        </span>
      </th>
      <td className="sm:py-3 sm:pr-3 sm:align-middle">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSaved(false);
            save.mutate({
              ownerName: owner.ownerName,
              slackEmail: value.trim() || null,
            });
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            {copy.emailLabel(owner.ownerName)}
          </label>
          <input
            id={inputId}
            type="email"
            value={value}
            maxLength={255}
            autoComplete="off"
            placeholder={copy.emailPlaceholder}
            aria-describedby={statusId}
            aria-invalid={save.error ? true : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            className={`${dashboardFieldClass} min-w-0 flex-1`}
          />
          <DashboardButton
            type="submit"
            variant="outline"
            disabled={!dirty || save.isPending}
            aria-label={copy.saveFor(owner.ownerName)}
          >
            {copy.save}
          </DashboardButton>
        </form>
        <span
          id={statusId}
          aria-live="polite"
          className="mt-1 block text-xs empty:hidden"
        >
          {save.error ? (
            <span className="text-dashboard-text-warning">
              {copy.saveError}
            </span>
          ) : saved && !dirty ? (
            <span className="text-dashboard-text-light">{copy.saved}</span>
          ) : null}
        </span>
      </td>
      <td className="sm:py-3 sm:align-middle">
        <DashboardTag
          className={
            owner.match === "matched"
              ? "bg-dashboard-action-primary text-dashboard-text-inverse"
              : owner.match === "not-found"
                ? "text-dashboard-text-warning"
                : undefined
          }
        >
          {MATCH_LABEL[owner.match]}
        </DashboardTag>
      </td>
    </tr>
  );
}
