import { createHash } from "node:crypto";
import { eq, inArray, sql, and, gt } from "drizzle-orm";

import { opsPingsCopy } from "~/content/ops-pings";
import { opsOwnerAliases } from "~/content/ops-pings-aliases";
import { env } from "~/env";
import {
  foldAliases,
  matchName,
  type NameCandidate,
  type NameMatch,
} from "~/lib/ops-owners";
import {
  parseOpsSchedule,
  type OpsIssue,
  type OpsTask,
  type ParsedOpsSchedule,
} from "~/lib/ops-run-of-show";
import { formatClock, RUN_OF_SHOW_DAYS } from "~/lib/run-of-show";
import { runOfShowInstant } from "~/lib/run-of-show-time";
import {
  createCachedLoader,
  getRunOfShowSheetsClient,
  gridOf,
  mergesOf,
  SHEET_FIELDS,
} from "~/server/api/utils/run-of-show-sheet";
import { diffReminders } from "~/server/api/utils/task-reminders";
import { db } from "~/server/db";
import { opsPings, users } from "~/server/db/schema";
import { escapeSlackText } from "~/server/slack/client";
import { lookupSlackUser } from "~/server/slack/dm";
import { getSlackOrganizers, type SlackOrganizer } from "~/server/slack/organizers";
import {
  cancelScheduledMessage,
  MIN_SCHEDULE_AHEAD_MS,
  scheduleSlackMessage,
} from "~/server/slack/scheduled-messages";

/**
 * Ops pings: every task in the organizer team's run of show
 * (OPS_RUN_OF_SHOW_SHEET, "Schedule View") DMs each of its owners on Slack
 * 10 minutes before it starts and again at its end time. DMs only; no
 * channel posts. Owners are matched to Slack people tagged "[ORGANIZER]"
 * (src/server/slack/organizers.ts), with organizer accounts in the app +
 * users.lookupByEmail as the fallback. "Everyone" pings nobody; "ALL OF SPON"
 * DMs the spon team (Team Assignments tab of the sponsor run of show).
 * Anything unmatched or ambiguous is shown on /internal/ops-pings and nobody
 * is DMed for it. Scheduling reuses the sponsor task pings' diff and Slack
 * helpers, so re-running it never duplicates a message.
 * docs/decisions.md 2026-11-18 (ops pings).
 */

export const OPS_SCHEDULE_TAB = "Schedule View";
export const TEAM_ASSIGNMENTS_TAB = "Team Assignments";
/** Start pings go out 10 minutes before the start (Jazz, 2026-11-18). */
export const START_LEAD_MS = 10 * 60_000;
export const OPS_SHEET_CACHE_MS = 60_000;
const LOCK_KEY = "ops-pings-sync";

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

export type OpsSheet = {
  parsed: ParsedOpsSchedule;
  /** Spon team names from Team Assignments; null when it couldn't be read. */
  sponRoster: string[] | null;
  readAt: string;
};

export class OpsSheetNotConfiguredError extends Error {
  constructor() {
    super("OPS_RUN_OF_SHOW_SHEET is not set");
    this.name = "OpsSheetNotConfiguredError";
  }
}

export function opsSheetUrl(): string | null {
  const id = env.OPS_RUN_OF_SHOW_SHEET;
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
}

/**
 * The spon team from the sponsor run of show's Team Assignments tab: the
 * names in column A under its "Team Member" header. Null when there's no
 * such header.
 */
export function parseTeamRoster(values: string[][]): string[] | null {
  const header = values.findIndex((row) =>
    /^team members?$/i.test((row[0] ?? "").trim()),
  );
  if (header < 0) return null;
  const names = values
    .slice(header + 1)
    .map((row) => (row[0] ?? "").trim())
    .filter(Boolean);
  return [...new Set(names)];
}

async function fetchOpsSheet(): Promise<OpsSheet> {
  const id = env.OPS_RUN_OF_SHOW_SHEET?.trim();
  if (!id) throw new OpsSheetNotConfiguredError();
  const sheets = await getRunOfShowSheetsClient();
  const res = await sheets.spreadsheets.get({
    spreadsheetId: id,
    ranges: [`'${OPS_SCHEDULE_TAB}'!A1:AA1000`],
    fields: SHEET_FIELDS,
  });
  const tab = res.data.sheets?.[0];
  const parsed = parseOpsSchedule(gridOf(tab), mergesOf(tab));

  let sponRoster: string[] | null = null;
  const sponSheet = env.RUN_OF_SHOW_SHEET?.trim();
  if (sponSheet) {
    try {
      const roster = await sheets.spreadsheets.values.get({
        spreadsheetId: sponSheet,
        range: `'${TEAM_ASSIGNMENTS_TAB}'!A1:A60`,
      });
      sponRoster = parseTeamRoster(
        (roster.data.values ?? []).map((r) => r.map(String)),
      );
    } catch (error) {
      console.error("ops pings: Team Assignments read failed", error);
    }
  }
  return { parsed, sponRoster, readAt: new Date().toISOString() };
}

const opsSheetCache = createCachedLoader(fetchOpsSheet, OPS_SHEET_CACHE_MS);

/** The parsed sheet, re-read at most once a minute (or now, when fresh). */
export function getOpsSheet(options: { fresh?: boolean } = {}): Promise<OpsSheet> {
  if (options.fresh) opsSheetCache.clear();
  return opsSheetCache.get();
}

// ---------------------------------------------------------------------------
// Owners
// ---------------------------------------------------------------------------

export type AppOrganizer = NameCandidate & { email: string };

export type PersonResolution =
  | {
      status: "matched";
      /** The person's name as matched ("Jessica Xing"). */
      name: string;
      /** Null when Slack wasn't checked (not connected). */
      slackUserId: string | null;
      via: Extract<NameMatch, { status: "one" }>["via"] | "email";
    }
  | { status: "ambiguous"; candidates: string[] }
  | { status: "no-match" }
  /** An organizer account matched, but its email has no Slack user. */
  | { status: "no-slack"; name: string };

export type OwnerResolution = {
  /** As in the sheet: "Aleeza (Photos)". */
  token: string;
} & (
  | ({ kind: "person" } & PersonResolution)
  | { kind: "everyone" }
  | {
      kind: "spon";
      /** Null when the Team Assignments list couldn't be read. */
      members: ({ token: string } & PersonResolution)[] | null;
    }
);

export type OwnerContext = {
  /** Tagged Slack organizers; null when Slack wasn't read. */
  slack: SlackOrganizer[] | null;
  /** Organizer accounts in the app (user.type = organizer). */
  app: AppOrganizer[];
  aliases?: Map<string, string>;
  /** users.lookupByEmail; null when Slack isn't connected. */
  lookupEmail: ((email: string) => Promise<string | null>) | null;
  sponRoster: string[] | null;
};

/** Resolve sheet owner names, once per name. */
export function ownerResolver(ctx: OwnerContext) {
  const aliases = ctx.aliases ?? foldAliases(opsOwnerAliases);
  const memo = new Map<string, Promise<PersonResolution>>();

  const person = (name: string): Promise<PersonResolution> => {
    const key = name.trim().toLowerCase();
    let found = memo.get(key);
    if (!found) {
      found = resolvePerson(name);
      memo.set(key, found);
    }
    return found;
  };

  async function resolvePerson(name: string): Promise<PersonResolution> {
    if (ctx.slack) {
      const m = matchName(name, ctx.slack, aliases);
      if (m.status === "one") {
        return { status: "matched", name: m.name, slackUserId: m.id, via: m.via };
      }
      if (m.status === "many") return { status: "ambiguous", candidates: m.candidates };
    }
    // Fallback: an organizer account in the app, then Slack by its email.
    const a = matchName(name, ctx.app, aliases);
    if (a.status === "many") return { status: "ambiguous", candidates: a.candidates };
    if (a.status === "none") return { status: "no-match" };
    const account = ctx.app.find((o) => o.id === a.id)!;
    if (!ctx.lookupEmail) {
      return { status: "matched", name: a.name, slackUserId: null, via: a.via };
    }
    const slackUserId = await ctx.lookupEmail(account.email);
    return slackUserId
      ? { status: "matched", name: a.name, slackUserId, via: "email" }
      : { status: "no-slack", name: a.name };
  }

  return async function resolve(task: OpsTask): Promise<OwnerResolution[]> {
    return Promise.all(
      task.owners.map(async (o): Promise<OwnerResolution> => {
        if (o.group === "everyone") return { token: o.raw, kind: "everyone" };
        if (o.group === "spon") {
          const members = ctx.sponRoster
            ? await Promise.all(
                ctx.sponRoster.map(async (n) => ({ token: n, ...(await person(n)) })),
              )
            : null;
          return { token: o.raw, kind: "spon", members };
        }
        return { token: o.raw, kind: "person", ...(await person(o.name)) };
      }),
    );
  };
}

/** A person to DM: matched, with a Slack user. */
export type Recipient = { slackUserId: string; name: string };

export function recipientsOf(owners: OwnerResolution[]): Recipient[] {
  const out = new Map<string, Recipient>();
  const add = (p: PersonResolution) => {
    if (p.status === "matched" && p.slackUserId && !out.has(p.slackUserId)) {
      out.set(p.slackUserId, { slackUserId: p.slackUserId, name: p.name });
    }
  };
  for (const o of owners) {
    if (o.kind === "person") add(o);
    if (o.kind === "spon") o.members?.forEach(add);
  }
  return [...out.values()];
}

/** Owner names nobody can be DMed for, to show on the page. */
export function flaggedOwners(owners: OwnerResolution[]): number {
  let n = 0;
  for (const o of owners) {
    if (o.kind === "person" && o.status !== "matched") n++;
    if (o.kind === "spon") {
      if (!o.members) n++;
      else n += o.members.filter((m) => m.status !== "matched").length;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export type PingKind = "start" | "end";

/** Stable id of a task: a change to its day, start or title is a new task. */
export function opsTaskKey(t: Pick<OpsTask, "day" | "start" | "title">): string {
  return sha256(JSON.stringify([t.day, t.start, t.title.trim().replace(/\s+/g, " ")]));
}

export function pingText(task: OpsTask, kind: PingKind): string {
  const e = (s: string | null) =>
    s === null ? null : escapeSlackText(s.replace(/[ \t]+/g, " ").trim());
  const start = formatClock(task.start);
  const end = task.end ? formatClock(task.end) : null;
  if (kind === "end") {
    return opsPingsCopy.slack.end({
      title: e(task.title)!,
      end: end ?? start,
      location: e(task.location),
    });
  }
  return opsPingsCopy.slack.start({
    title: e(task.title)!,
    when: opsPingsCopy.slack.when(start, end),
    location: e(task.location),
    blurb: e(task.blurb),
    owners: e(task.ownerText)!,
  });
}

export function pingTimes(task: OpsTask): { kind: PingKind; postAt: Date }[] {
  const out: { kind: PingKind; postAt: Date }[] = [
    {
      kind: "start",
      postAt: new Date(runOfShowInstant(task.day, task.start).getTime() - START_LEAD_MS),
    },
  ];
  if (task.end) {
    out.push({ kind: "end", postAt: runOfShowInstant(task.day, task.end) });
  }
  return out;
}

export type DesiredOpsPing = {
  /** The ping's identity (ops_ping.ping_key); named for diffReminders. */
  taskKey: string;
  /** The task's identity (ops_ping.task_key). */
  groupKey: string;
  kind: PingKind;
  task: string;
  owner: string;
  slackUserId: string;
  postAt: Date;
  text: string;
  tooSoon: boolean;
  routeKey: string;
};

export type PlannedTask = {
  task: OpsTask;
  key: string;
  owners: OwnerResolution[];
  recipients: Recipient[];
  pings: { kind: PingKind; postAt: Date; text: string }[];
};

export function compareTasks(a: OpsTask, b: OpsTask): number {
  const day = RUN_OF_SHOW_DAYS.indexOf(a.day) - RUN_OF_SHOW_DAYS.indexOf(b.day);
  return day || a.start.localeCompare(b.start) || a.cell.localeCompare(b.cell);
}

/** Every task with its owners resolved, and the DMs that should exist now. */
export async function planOpsPings(
  sheet: Pick<OpsSheet, "parsed">,
  ctx: OwnerContext,
  now: Date,
): Promise<{ tasks: PlannedTask[]; desired: DesiredOpsPing[] }> {
  const resolve = ownerResolver(ctx);
  const tasks: PlannedTask[] = [];
  const desired = new Map<string, DesiredOpsPing>();
  for (const task of [...sheet.parsed.tasks].sort(compareTasks)) {
    const owners = await resolve(task);
    const recipients = recipientsOf(owners);
    const key = opsTaskKey(task);
    const pings = pingTimes(task).map((p) => ({ ...p, text: pingText(task, p.kind) }));
    tasks.push({ task, key, owners, recipients, pings });
    for (const p of pings) {
      if (p.postAt <= now) continue;
      for (const r of recipients) {
        const pingKey = sha256(JSON.stringify([key, p.kind, r.slackUserId]));
        if (desired.has(pingKey)) continue; // the same task twice in the sheet
        desired.set(pingKey, {
          taskKey: pingKey,
          groupKey: key,
          kind: p.kind,
          task: task.title,
          owner: r.name,
          slackUserId: r.slackUserId,
          postAt: p.postAt,
          text: p.text,
          tooSoon: p.postAt.getTime() < now.getTime() + MIN_SCHEDULE_AHEAD_MS,
          routeKey: sha256(JSON.stringify([r.slackUserId, p.text])),
        });
      }
    }
  }
  return { tasks, desired: [...desired.values()] };
}

// ---------------------------------------------------------------------------
// Slack + DB context
// ---------------------------------------------------------------------------

export type OpsDeps = {
  token?: string;
  fetch?: typeof fetch;
  readSheet?: (options: { fresh?: boolean }) => Promise<OpsSheet>;
};

function slackToken(deps: OpsDeps): string | undefined {
  const token = "token" in deps ? deps.token : env.SLACK_BOT_TOKEN;
  return token?.length ? token : undefined;
}

async function appOrganizers(): Promise<AppOrganizer[]> {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.type, "organizer"));
  return rows.flatMap((r) =>
    r.name?.trim() ? [{ id: r.id, name: r.name.trim(), email: r.email }] : [],
  );
}

const EMAIL_TTL_MS = 10 * 60_000;
const emailCache = new Map<string, { at: number; id: string | null }>();

/** Tests only. */
export function resetOpsEmailCache(): void {
  emailCache.clear();
}

function emailLookup(token: string, fetchImpl: typeof fetch, now: number) {
  return async (email: string): Promise<string | null> => {
    const hit = emailCache.get(email);
    if (hit && now - hit.at < EMAIL_TTL_MS) return hit.id;
    const found = await lookupSlackUser(token, email, fetchImpl);
    if (found.status === "error") {
      console.error("ops pings: Slack email lookup failed:", found.code);
      return null; // not cached: tried again next time
    }
    const id = found.status === "found" ? found.userId : null;
    emailCache.set(email, { at: now, id });
    return id;
  };
}

type SlackState = "connected" | "no-token" | "error";

async function ownerContext(
  sheet: OpsSheet,
  now: Date,
  deps: OpsDeps,
  fresh: boolean,
): Promise<{ ctx: OwnerContext; slack: SlackState }> {
  const token = slackToken(deps);
  const fetchImpl = deps.fetch ?? fetch;
  const app = await appOrganizers();
  const base = { app, sponRoster: sheet.sponRoster };
  if (!token) {
    return { ctx: { ...base, slack: null, lookupEmail: null }, slack: "no-token" };
  }
  try {
    const organizers = await getSlackOrganizers(token, fetchImpl, now.getTime(), {
      fresh,
    });
    return {
      ctx: { ...base, slack: organizers, lookupEmail: emailLookup(token, fetchImpl, now.getTime()) },
      slack: "connected",
    };
  } catch (error) {
    console.error("ops pings: Slack organizer list failed", error);
    return { ctx: { ...base, slack: null, lookupEmail: null }, slack: "error" };
  }
}

async function readSheet(deps: OpsDeps, fresh: boolean): Promise<OpsSheet> {
  return (deps.readSheet ?? getOpsSheet)({ fresh });
}

function sheetFailure(error: unknown): "not-configured" | "sheet-error" {
  if (error instanceof OpsSheetNotConfiguredError) return "not-configured";
  console.error("ops pings: sheet read failed", error);
  return "sheet-error";
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export type OpsSyncResult =
  | {
      ok: true;
      /** Pings waiting in Slack after the sync. */
      scheduled: number;
      created: number;
      cancelled: number;
      failed: number;
      tooSoon: number;
      /** New pings held back because the old one couldn't be deleted. */
      deferred: number;
    }
  | {
      ok: false;
      reason: "no-token" | "not-configured" | "sheet-error" | "slack-error" | "error";
    };

type StoredOpsPing = {
  id: string;
  taskKey: string;
  postAt: Date;
  status: "scheduled" | "failed";
  slackChannel: string | null;
  scheduledMessageId: string | null;
  routeKey: string | null;
};

/**
 * Make Slack's scheduled DMs match the sheet: new pings scheduled, changed
 * ones replaced, removed ones deleted, unchanged ones left alone. Idempotent;
 * concurrent runs queue on a Postgres advisory lock. Never throws.
 */
export async function syncOpsPings(
  now: Date = new Date(),
  deps: OpsDeps = {},
): Promise<OpsSyncResult> {
  const token = slackToken(deps);
  if (!token) return { ok: false, reason: "no-token" };
  const fetchImpl = deps.fetch ?? fetch;

  let sheet: OpsSheet;
  try {
    sheet = await readSheet(deps, true);
  } catch (error) {
    return { ok: false, reason: sheetFailure(error) };
  }

  try {
    const { ctx, slack } = await ownerContext(sheet, now, { ...deps, token }, true);
    // Without the organizer list every owner would look unmatched: change
    // nothing rather than cancel everyone's pings.
    if (slack !== "connected") return { ok: false, reason: "slack-error" };
    const plan = await planOpsPings(sheet, ctx, now);

    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`);
      const stored = (await tx
        .select({
          id: opsPings.id,
          taskKey: opsPings.pingKey,
          postAt: opsPings.postAt,
          status: opsPings.status,
          slackChannel: opsPings.slackChannel,
          scheduledMessageId: opsPings.scheduledMessageId,
          routeKey: opsPings.routeKey,
        })
        .from(opsPings)
        .where(inArray(opsPings.status, ["scheduled", "failed"]))) as StoredOpsPing[];
      const diff = diffReminders<DesiredOpsPing, StoredOpsPing>(stored, plan.desired, now);

      if (diff.passed.length > 0) {
        await tx
          .update(opsPings)
          .set({ status: "sent-window-passed" })
          .where(inArray(opsPings.id, diff.passed));
      }
      if (diff.drop.length > 0) {
        await tx
          .update(opsPings)
          .set({ status: "cancelled" })
          .where(inArray(opsPings.id, diff.drop));
      }

      let cancelled = diff.drop.length;
      const stuck = new Set<string>();
      for (const row of diff.cancel) {
        const outcome = await cancelScheduledMessage(token, row, fetchImpl);
        await tx
          .update(opsPings)
          .set(
            outcome.status === "cancelled"
              ? { status: "cancelled", error: null }
              : outcome.status === "gone"
                ? { status: "cancelled", error: outcome.code }
                : { error: `cancel: ${outcome.code}`.slice(0, 255) },
          )
          .where(eq(opsPings.id, row.id));
        if (outcome.status === "stuck") stuck.add(row.taskKey);
        else cancelled++;
      }

      const dmChannels = new Map<string, string>();
      let created = 0;
      let failed = 0;
      let deferred = 0;
      for (const d of diff.create) {
        if (stuck.has(d.taskKey)) {
          deferred++;
          continue;
        }
        const res = await scheduleSlackMessage(
          token,
          { slackUserId: d.slackUserId, channel: null },
          d.postAt,
          d.text,
          dmChannels,
          fetchImpl,
        );
        if (res.ok) created++;
        else failed++;
        const row = {
          pingKey: d.taskKey,
          taskKey: d.groupKey,
          kind: d.kind,
          task: d.task,
          owner: d.owner.slice(0, 255),
          slackUserId: d.slackUserId,
          postAt: d.postAt,
          routeKey: d.routeKey,
          slackChannel: res.slackChannel,
          ...(res.ok
            ? { status: "scheduled" as const, scheduledMessageId: res.scheduledMessageId, error: null }
            : { status: "failed" as const, scheduledMessageId: null, error: res.code }),
        };
        if (d.retryId) {
          await tx.update(opsPings).set(row).where(eq(opsPings.id, d.retryId));
        } else {
          await tx.insert(opsPings).values(row);
        }
      }

      const [counted] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(opsPings)
        .where(and(eq(opsPings.status, "scheduled"), gt(opsPings.postAt, now)));
      return {
        ok: true as const,
        scheduled: counted?.count ?? 0,
        created,
        cancelled,
        failed,
        tooSoon: diff.tooSoon.length,
        deferred,
      };
    });
  } catch (error) {
    console.error("ops pings: sync failed", error);
    return { ok: false, reason: "error" };
  }
}

// ---------------------------------------------------------------------------
// Organizer page
// ---------------------------------------------------------------------------

export type DeliveryStatus =
  | "scheduled"
  | "sent"
  | "failed"
  | "pending"
  | "too-soon"
  | "passed";

export type PingView = {
  kind: PingKind;
  postAt: Date;
  text: string;
  deliveries: { name: string; slackUserId: string; status: DeliveryStatus; error: string | null }[];
};

export type TaskView = Omit<OpsTask, "owners"> & {
  key: string;
  owners: OwnerResolution[];
  pings: PingView[];
};

export type OpsOverview =
  | {
      ok: true;
      slack: SlackState;
      sheetUrl: string | null;
      readAt: string;
      tasks: TaskView[];
      issues: OpsIssue[];
      flagged: number;
      sponRosterFound: boolean;
    }
  | { ok: false; reason: "not-configured" | "sheet-error"; sheetUrl: string | null };

type StoredRow = {
  pingKey: string;
  status: "scheduled" | "cancelled" | "failed" | "sent-window-passed";
  postAt: Date;
  error: string | null;
  createdAt: Date;
};

/** What the page says about one DM: from its stored row, else the plan. */
export function deliveryStatus(
  row: Pick<StoredRow, "status" | "postAt" | "error"> | undefined,
  postAt: Date,
  now: Date,
): { status: DeliveryStatus; error: string | null } {
  if (row?.status === "scheduled") {
    return { status: row.postAt <= now ? "sent" : "scheduled", error: null };
  }
  if (row?.status === "sent-window-passed") return { status: "sent", error: null };
  if (row?.status === "failed") return { status: "failed", error: row.error };
  if (postAt <= now) return { status: "passed", error: null };
  if (postAt.getTime() < now.getTime() + MIN_SCHEDULE_AHEAD_MS) {
    return { status: "too-soon", error: null };
  }
  return { status: "pending", error: null };
}

/** Rank of a stored row: the live one wins over older ones. */
const rank: Record<StoredRow["status"], number> = {
  scheduled: 3,
  "sent-window-passed": 2,
  failed: 1,
  cancelled: 0,
};

/** Organizer-only data for /internal/ops-pings. Reads Slack via caches only. */
export async function getOpsOverview(
  now: Date = new Date(),
  deps: OpsDeps = {},
): Promise<OpsOverview> {
  let sheet: OpsSheet;
  try {
    sheet = await readSheet(deps, false);
  } catch (error) {
    return { ok: false, reason: sheetFailure(error), sheetUrl: opsSheetUrl() };
  }
  const { ctx, slack } = await ownerContext(sheet, now, deps, false);
  const plan = await planOpsPings(sheet, ctx, now);

  const keys = plan.tasks.map((t) => t.key);
  const rows: (StoredRow & { taskKey: string })[] =
    keys.length === 0
      ? []
      : await db
          .select({
            pingKey: opsPings.pingKey,
            taskKey: opsPings.taskKey,
            status: opsPings.status,
            postAt: opsPings.postAt,
            error: opsPings.error,
            createdAt: opsPings.createdAt,
          })
          .from(opsPings)
          .where(inArray(opsPings.taskKey, keys));
  const best = new Map<string, StoredRow>();
  for (const r of rows) {
    const cur = best.get(r.pingKey);
    if (
      !cur ||
      rank[r.status] > rank[cur.status] ||
      (rank[r.status] === rank[cur.status] && r.createdAt > cur.createdAt)
    ) {
      best.set(r.pingKey, r);
    }
  }

  const tasks: TaskView[] = plan.tasks.map((t) => ({
    ...t.task,
    key: t.key,
    owners: t.owners,
    pings: t.pings.map((p) => ({
      ...p,
      deliveries: t.recipients.map((r) => {
        const pingKey = sha256(JSON.stringify([t.key, p.kind, r.slackUserId]));
        const row = best.get(pingKey);
        return {
          name: r.name,
          slackUserId: r.slackUserId,
          ...deliveryStatus(row?.status === "cancelled" ? undefined : row, p.postAt, now),
        };
      }),
    })),
  }));

  return {
    ok: true,
    slack,
    sheetUrl: opsSheetUrl(),
    readAt: sheet.readAt,
    tasks,
    issues: sheet.parsed.issues,
    flagged: plan.tasks.reduce((n, t) => n + flaggedOwners(t.owners), 0),
    sponRosterFound: sheet.sponRoster !== null,
  };
}
