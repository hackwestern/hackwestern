// Devpost export -> teams.
//
// Reads the Devpost "Projects data (with personal info)" CSV, creates or
// updates one team per submitted project, links each hacker whose hacker ID
// matches an account, and notes anything that didn't match in
// `team.import_flags`. Flags are notes only: every team is seated and judged.
//
// parse* and planImport are pure; applyImport writes. The CLI lives in
// scripts/import-devpost-teams.ts.
import { randomBytes } from "crypto";
import { and, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { customAlphabet } from "nanoid";

import { type Transaction, db } from "~/server/db";
import {
  type ImportFlag,
  teamTracks,
  teams,
  trackEnum,
  users,
} from "~/server/db/schema";
import { ADJECTIVES, ANIMALS, THINGS } from "~/server/api/utils/hacker-id";
import { isJudgingStarted, lockPlanExclusive } from "~/server/judging/shared";

export type Track = (typeof trackEnum.enumValues)[number];

/** Same cap as the in-app team flow (`teams.joinTeam`). */
export const MAX_TEAM_SIZE = 4;

/**
 * Devpost prize name -> track. Prize names that equal a track exactly
 * ("Best Use of Cohere") map on their own; list the HW13 prize names that
 * don't here once Devpost is final.
 */
export const PRIZE_TRACKS: Record<string, Track> = {};

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** RFC 4180: quoted fields may hold commas, quotes ("") and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Hacker IDs in free text
// ---------------------------------------------------------------------------

const ADJ = new Set<string>(ADJECTIVES);
const ANI = new Set<string>(ANIMALS);
const THI = new Set<string>(THINGS);
const LIST_WORD = (w: string) => ADJ.has(w) || ANI.has(w) || THI.has(w);

/**
 * Picks hacker IDs (adjective-animal-thing) out of whatever a team typed:
 * any mix of commas, new lines, spaces, dashes or underscores, any case.
 * Leftover runs of 2-4 words that include an ID word are returned as typos
 * ("brave-oter-kite"); other text ("N/A", "see above") is ignored.
 */
export function extractHackerIds(text: string): {
  ids: string[];
  typos: string[];
} {
  const ids: string[] = [];
  const typos: string[] = [];
  for (const chunk of text.split(/[,;|\n\r]+/)) {
    const words = chunk.toLowerCase().match(/[a-z]+/g) ?? [];
    let run: string[] = [];
    const flush = () => {
      if (run.length >= 2 && run.length <= 4 && run.some(LIST_WORD)) {
        typos.push(run.join("-"));
      }
      run = [];
    };
    for (let i = 0; i < words.length; ) {
      const [a, b, c] = [words[i]!, words[i + 1], words[i + 2]];
      if (ADJ.has(a) && b && ANI.has(b) && c && THI.has(c)) {
        flush();
        ids.push(`${a}-${b}-${c}`);
        i += 3;
      } else {
        run.push(a);
        i += 1;
      }
    }
    flush();
  }
  return { ids: [...new Set(ids)], typos: [...new Set(typos)] };
}

// ---------------------------------------------------------------------------
// Rows -> projects
// ---------------------------------------------------------------------------

export interface ParsedProject {
  /** 1-based line in the CSV (the header is line 1). */
  line: number;
  title: string;
  devpostUrl: string;
  submittedAt: Date | null;
  githubUrl: string | null;
  tracks: Track[];
  unknownPrizes: string[];
  ids: string[];
  typos: string[];
  /** Names Devpost lists for the team (submitter first). Never emails. */
  members: string[];
}

export interface ParseResult {
  projects: ParsedProject[];
  drafts: { line: number; title: string }[];
  rejected: { line: number; reason: string }[];
}

const COL = {
  title: "Project Title",
  url: "Submission Url",
  status: "Project Status",
  submittedAt: "Project Submitted At",
  links: '"Try it out" Links',
  prizes: "Opt-In Prizes",
  submitterFirst: "Submitter First Name",
  submitterLast: "Submitter Last Name",
  member1First: "Team Member 1 First Name",
} as const;

/** Headers of the Devpost question(s) where teams paste hacker IDs. */
const ID_HEADER = /hacker\s*id/i;

const clean = (s: string | undefined) => (s ?? "").trim();
const normalizeUrl = (s: string) => s.trim().replace(/\/+$/, "");

/** Devpost writes "11/23/2025 04:02:56" with no zone; read as UTC. */
export function parseDevpostDate(raw: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/.exec(
    raw.trim(),
  );
  if (!m) return null;
  const [mo = 0, d = 0, y = 0, h = 0, mi = 0, s = 0] = m.slice(1).map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** First http(s) github.com link among a team's "Try it out" links. */
export function pickGithubUrl(links: string): string | null {
  for (const part of links.split(/[\s,]+/)) {
    try {
      const url = new URL(part);
      const host = url.hostname.toLowerCase();
      if (
        (url.protocol === "https:" || url.protocol === "http:") &&
        (host === "github.com" || host === "www.github.com")
      ) {
        return url.toString();
      }
    } catch {
      // not a URL
    }
  }
  return null;
}

/**
 * Maps a team's opt-in prizes to tracks by looking for each known prize name,
 * so a prize name that contains a comma can't be split in half.
 */
export function mapPrizes(raw: string): {
  tracks: Track[];
  unknown: string[];
} {
  const known: [string, Track][] = [
    ...trackEnum.enumValues.map((t) => [t, t] as [string, Track]),
    ...Object.entries(PRIZE_TRACKS),
  ].sort((a, b) => b[0].length - a[0].length);

  let rest = raw;
  const tracks = new Set<Track>();
  for (const [name, track] of known) {
    if (rest.includes(name)) {
      tracks.add(track);
      rest = rest.split(name).join(",");
    }
  }
  const unknown = rest
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return { tracks: [...tracks], unknown };
}

export function parseDevpostExport(text: string): ParseResult {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error("The CSV is empty.");

  const find = (name: string) =>
    header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const at = Object.fromEntries(
    Object.entries(COL).map(([k, name]) => [k, find(name)]),
  ) as Record<keyof typeof COL, number>;
  const missing = Object.entries(at)
    .filter(([, i]) => i < 0)
    .map(([k]) => COL[k as keyof typeof COL]);
  if (missing.length > 0) {
    throw new Error(`The CSV is missing columns: ${missing.join(", ")}.`);
  }
  const idCols = header
    .map((h, i) => (ID_HEADER.test(h) ? i : -1))
    .filter((i) => i >= 0);
  if (idCols.length === 0) {
    throw new Error(
      'No hacker ID column found (expected a header containing "hacker ID").',
    );
  }

  const result: ParseResult = { projects: [], drafts: [], rejected: [] };
  const seenUrls = new Set<string>();

  rows.forEach((row, i) => {
    const line = i + 2;
    if (row.every((cell) => cell.trim() === "")) return;

    const title = clean(row[at.title]);
    const devpostUrl = normalizeUrl(clean(row[at.url]));
    if (!clean(row[at.status]).toLowerCase().startsWith("submitted")) {
      result.drafts.push({ line, title: title || "(untitled)" });
      return;
    }
    if (!title) {
      result.rejected.push({ line, reason: "No project title." });
      return;
    }
    if (!devpostUrl) {
      result.rejected.push({
        line,
        reason: `"${title}" has no Submission Url.`,
      });
      return;
    }
    if (seenUrls.has(devpostUrl)) {
      result.rejected.push({
        line,
        reason: `"${title}" repeats a Submission Url already in the file.`,
      });
      return;
    }
    seenUrls.add(devpostUrl);

    // Submitter, then Team Member 1.., each a (first, last, email) group;
    // members after the first have no header names.
    const members: string[] = [];
    const submitter =
      `${clean(row[at.submitterFirst])} ${clean(row[at.submitterLast])}`.trim();
    if (submitter) members.push(submitter);
    for (let c = at.member1First; c + 1 < row.length; c += 3) {
      if (idCols.includes(c) || idCols.includes(c + 1)) continue;
      const name = `${clean(row[c])} ${clean(row[c + 1])}`.trim();
      if (name) members.push(name);
    }

    const { ids, typos } = extractHackerIds(
      idCols.map((c) => row[c] ?? "").join("\n"),
    );
    const { tracks, unknown } = mapPrizes(clean(row[at.prizes]));

    result.projects.push({
      line,
      title,
      devpostUrl,
      submittedAt: parseDevpostDate(clean(row[at.submittedAt])),
      githubUrl: pickGithubUrl(clean(row[at.links])),
      tracks,
      unknownPrizes: unknown,
      ids,
      typos,
      members,
    });
  });

  return result;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export interface HackerAccount {
  userId: string;
  name: string | null;
}

export interface PlannedTeam {
  project: ParsedProject;
  /** Accounts to link to this team. */
  linkUserIds: string[];
  flags: ImportFlag[];
}

/**
 * Decides who goes on which team. Every hacker whose ID matches an account
 * is linked, flags or not. A hacker listed on more than one project can only
 * hold one team, so they're linked to the earliest-submitted one (file order
 * breaks ties) and flagged as a duplicate on every project that lists them.
 * IDs with no account (not_hacker) have nobody to link; they're only
 * noted in the flags.
 */
export function planImport(
  projects: ParsedProject[],
  accounts: Map<string, HackerAccount>,
): PlannedTeam[] {
  const projectsByUser = new Map<string, ParsedProject[]>();
  for (const p of projects) {
    for (const id of p.ids) {
      const account = accounts.get(id);
      if (!account) continue;
      const list = projectsByUser.get(account.userId) ?? [];
      list.push(p);
      projectsByUser.set(account.userId, list);
    }
  }
  const time = (p: ParsedProject) =>
    p.submittedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const homeOf = (list: ParsedProject[]) =>
    list.reduce((best, p) => (time(p) < time(best) ? p : best));

  return projects.map((project) => {
    const flags: ImportFlag[] = [];
    const linkUserIds: string[] = [];
    let matched = 0;

    const notHacker = [...project.typos];
    for (const id of project.ids) {
      const account = accounts.get(id);
      if (!account) {
        notHacker.push(id);
        continue;
      }
      matched += 1;
      const on = projectsByUser.get(account.userId) ?? [project];
      if (on.length > 1) {
        flags.push({
          reason: "duplicate",
          rawId: id,
          name: account.name,
          otherProjects: on.filter((p) => p !== project).map((p) => p.title),
          linkedHere: homeOf(on) === project,
        });
      }
      if (homeOf(on) === project) linkUserIds.push(account.userId);
    }

    // No IDs entered at all: nobody to list by ID, so list the Devpost names.
    if (project.ids.length === 0 && project.typos.length === 0) {
      notHacker.push(...project.members);
    }
    if (notHacker.length > 0 || matched === 0) {
      flags.unshift({ reason: "not_hacker", members: notHacker });
    }
    if (matched > MAX_TEAM_SIZE) {
      flags.push({ reason: "incorrect_team_size", matched });
    }
    return { project, linkUserIds, flags };
  });
}

/** Accounts for every hacker ID the file mentions, keyed by ID. */
export async function loadAccounts(
  projects: ParsedProject[],
  tx: Transaction | typeof db = db,
): Promise<Map<string, HackerAccount>> {
  const ids = [...new Set(projects.flatMap((p) => p.ids))];
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select({ id: users.id, name: users.name, hackerId: users.hackerId })
    .from(users)
    .where(inArray(users.hackerId, ids));
  return new Map(
    rows.map((r) => [r.hackerId!, { userId: r.id, name: r.name }]),
  );
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

export interface ApplySummary {
  created: number;
  updated: number;
  linked: number;
  unlinked: number;
  flaggedTeams: number;
  /** True when tables are already seated: new teams need seating re-run. */
  reseatNeeded: boolean;
}

const genJoinCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

/**
 * Writes the plan in one transaction. Holds the same lock as seating and
 * auto-assign, and refuses once judging has started. Teams missing from the
 * file are left alone; nothing is ever deleted.
 */
export async function applyImport(plan: PlannedTeam[]): Promise<ApplySummary> {
  return db.transaction(async (tx) => {
    await lockPlanExclusive(tx);
    if (await isJudgingStarted(tx)) {
      throw new Error(
        "Judging has started, so the import can't change teams any more.",
      );
    }

    const urls = plan.map((p) => p.project.devpostUrl);
    const existing =
      urls.length === 0
        ? []
        : await tx
            .select({ id: teams.id, devpostUrl: teams.devpostUrl })
            .from(teams)
            .where(inArray(teams.devpostUrl, urls));
    const idByUrl = new Map(existing.map((t) => [t.devpostUrl!, t.id]));
    const seated = await tx
      .select({ id: teams.id })
      .from(teams)
      .where(isNotNull(teams.judgingSeatId))
      .limit(1);

    const summary: ApplySummary = {
      created: 0,
      updated: 0,
      linked: 0,
      unlinked: 0,
      flaggedTeams: 0,
      reseatNeeded: false,
    };

    for (const { project, linkUserIds, flags } of plan) {
      const values = {
        name: project.title,
        devpostUrl: project.devpostUrl,
        githubUrl: project.githubUrl,
        submissionStatus: "submitted" as const,
        submittedAt: project.submittedAt,
        tracks: project.tracks,
        importFlags: flags.length > 0 ? flags : null,
      };
      if (flags.length > 0) summary.flaggedTeams += 1;

      let teamId = idByUrl.get(project.devpostUrl);
      if (teamId) {
        await tx.update(teams).set(values).where(eq(teams.id, teamId));
        summary.updated += 1;
      } else {
        for (;;) {
          const id = randomBytes(6).toString("hex");
          const [row] = await tx
            .insert(teams)
            .values({ ...values, id, joinCode: genJoinCode() })
            .onConflictDoNothing()
            .returning({ id: teams.id });
          if (row) {
            teamId = row.id;
            break;
          }
        }
        summary.created += 1;
        if (seated.length > 0) summary.reseatNeeded = true;
      }

      await tx.delete(teamTracks).where(eq(teamTracks.teamId, teamId));
      if (project.tracks.length > 0) {
        await tx
          .insert(teamTracks)
          .values(project.tracks.map((track) => ({ teamId: teamId, track })));
      }

      // Devpost is the source of truth for imported teams: drop anyone no
      // longer listed, then link everyone matched.
      const dropped = await tx
        .update(users)
        .set({ teamId: null })
        .where(
          linkUserIds.length > 0
            ? and(eq(users.teamId, teamId), notInArray(users.id, linkUserIds))
            : eq(users.teamId, teamId),
        )
        .returning({ id: users.id });
      summary.unlinked += dropped.length;
      if (linkUserIds.length > 0) {
        await tx
          .update(users)
          .set({ teamId })
          .where(inArray(users.id, linkUserIds));
        summary.linked += linkUserIds.length;
      }
    }
    return summary;
  });
}
