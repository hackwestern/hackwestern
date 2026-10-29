import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";

import { db, type Transaction } from "~/server/db";
import {
  judges,
  judgingAssignments,
  judgingRound,
  judgingTables,
  teamMarks,
  teams,
} from "~/server/db/schema";
import {
  type SaveLayoutInput,
  type SaveRoundSettingsInput,
} from "~/schemas/judging-plan";

type Tx = Transaction | typeof db;
type Round = typeof judgingRound.$inferSelect;

export const ELIGIBLE_STATUSES = ["submitted", "late"] as const;
const ROUND_ID = 1;
const MINUTE = 60_000;

// ---------------------------------------------------------------------------
// Round state
// ---------------------------------------------------------------------------

export async function getRound(tx: Tx = db): Promise<Round | undefined> {
  return tx.query.judgingRound.findFirst({
    where: eq(judgingRound.id, ROUND_ID),
  });
}

/** Venue, seating and judge visits can only change while the plan is a draft. */
async function requireDraft(tx: Tx): Promise<Round | undefined> {
  const round = await getRound(tx);
  if (round?.status === "published") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "The judging plan is published. Use absent flags or reassignment instead.",
    });
  }
  return round;
}

async function requireRound(tx: Tx): Promise<Round> {
  const round = await getRound(tx);
  if (!round) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Save the round settings first.",
    });
  }
  return round;
}

/** Start and end of a 1-based general judging slot. */
export function slotWindow(
  round: Pick<Round, "startsAt" | "slotMinutes">,
  slot: number,
): { startsAt: Date; endsAt: Date } {
  const start =
    round.startsAt.getTime() + (slot - 1) * round.slotMinutes * MINUTE;
  return {
    startsAt: new Date(start),
    endsAt: new Date(start + round.slotMinutes * MINUTE),
  };
}

export async function saveRoundSettings(input: SaveRoundSettingsInput) {
  return db.transaction(async (tx) => {
    await requireDraft(tx);
    const [row] = await tx
      .insert(judgingRound)
      .values({ id: ROUND_ID, ...input })
      .onConflictDoUpdate({ target: judgingRound.id, set: input })
      .returning();
    return row;
  });
}

// ---------------------------------------------------------------------------
// Venue
// ---------------------------------------------------------------------------

type TableDraft = Omit<typeof judgingTables.$inferInsert, "id" | "isActive">;

/**
 * Expand zone grids into tables. `number` runs in reading order (the printed
 * labels); `walkOrder` snakes row by row (left to right, then right to left)
 * and continues from one zone into the next, so neighbouring walk positions
 * are always physically adjacent.
 */
export function buildLayout(
  zones: SaveLayoutInput["zones"],
  startNumber = 1,
): TableDraft[] {
  const tables: TableDraft[] = [];
  let number = startNumber;
  let walk = 0;
  for (const z of zones) {
    const zoneTables: TableDraft[] = [];
    for (let row = 0; row < z.rows; row++) {
      for (let col = 0; col < z.cols; col++) {
        zoneTables.push({
          number: number++,
          zone: z.zone,
          walkOrder: 0,
          mapX: col,
          mapY: row,
        });
      }
    }
    for (let row = 0; row < z.rows; row++) {
      const cols = Array.from({ length: z.cols }, (_, c) => c);
      if (row % 2 === 1) cols.reverse();
      for (const col of cols) {
        const t = zoneTables[row * z.cols + col];
        if (t) t.walkOrder = walk++;
      }
    }
    tables.push(...zoneTables);
  }
  return tables;
}

/** Replace the whole layout. Clears seating and visits, which depend on it. */
export async function saveLayout(input: SaveLayoutInput) {
  const drafts = buildLayout(input.zones, input.startNumber);
  return db.transaction(async (tx) => {
    await requireDraft(tx);
    await tx.delete(judgingAssignments).where(sql`true`);
    await tx
      .update(teams)
      .set({ judgingTableId: null })
      .where(isNotNull(teams.judgingTableId));
    await tx.delete(judgingTables).where(sql`true`);
    await tx.insert(judgingTables).values(drafts);
    return { tables: drafts.length };
  });
}

export async function setTableActive(tableId: number, isActive: boolean) {
  return db.transaction(async (tx) => {
    await requireDraft(tx);
    if (!isActive) {
      const seated = await tx.query.teams.findFirst({
        where: eq(teams.judgingTableId, tableId),
        columns: { id: true },
      });
      if (seated) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "A team is seated at this table. Re-seat teams after turning it off.",
        });
      }
    }
    const [row] = await tx
      .update(judgingTables)
      .set({ isActive })
      .where(eq(judgingTables.id, tableId))
      .returning();
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Table not found." });
    }
    return row;
  });
}

// ---------------------------------------------------------------------------
// Seating
// ---------------------------------------------------------------------------

/**
 * Teams sharing a sponsor track sit next to each other along the walk, so a
 * sponsor's shortlist is clustered and general judges' runs stay within a
 * track. Teams with only "General" go last.
 */
function seatingKey(t: { tracks: string[] | null; name: string; id: string }) {
  const sponsor = (t.tracks ?? []).filter((x) => x !== "General").sort()[0];
  return [sponsor ?? "~", t.name.toLowerCase(), t.id] as const;
}

export async function seatTeams() {
  return db.transaction(async (tx) => {
    await requireDraft(tx);
    const eligible = await tx
      .select({ id: teams.id, name: teams.name, tracks: teams.tracks })
      .from(teams)
      .where(inArray(teams.submissionStatus, [...ELIGIBLE_STATUSES]));
    const tables = await tx
      .select({ id: judgingTables.id })
      .from(judgingTables)
      .where(eq(judgingTables.isActive, true))
      .orderBy(asc(judgingTables.walkOrder));

    if (eligible.length > tables.length) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${eligible.length} teams to seat but only ${tables.length} active tables.`,
      });
    }

    eligible.sort((a, b) => {
      const ka = seatingKey(a);
      const kb = seatingKey(b);
      for (let i = 0; i < ka.length; i++) {
        const c = ka[i]!.localeCompare(kb[i]!);
        if (c !== 0) return c;
      }
      return 0;
    });

    await tx.delete(judgingAssignments).where(sql`true`);
    await tx
      .update(teams)
      .set({ judgingTableId: null })
      .where(isNotNull(teams.judgingTableId));
    for (const [i, team] of eligible.entries()) {
      await tx
        .update(teams)
        .set({ judgingTableId: tables[i]!.id })
        .where(eq(teams.id, team.id));
    }
    return { seated: eligible.length, tables: tables.length };
  });
}

// ---------------------------------------------------------------------------
// Visit generation
// ---------------------------------------------------------------------------

export type Visit = { judgeId: string; teamId: string; slot: number };

/**
 * Lay the walk-ordered teams end to end `judgesPerTeam` times and cut the
 * sequence into runs of `slotCount`; each run is one judge's route, visited in
 * slot order. Neighbouring teams on the walk are neighbouring tables, so each
 * judge walks a short contiguous stretch.
 *
 * Between passes the sequence is padded (idle slots) so each pass is shifted
 * by `floor(slots / judgesPerTeam)` slots. That guarantees a team's judges
 * come in different slots, and since a pass is at least one route long, no
 * judge sees the same team twice.
 */
export function buildVisits(
  teamIds: string[],
  judgeIds: string[],
  slotCount: number,
  judgesPerTeam: number,
): Visit[] {
  const n = teamIds.length;
  if (n === 0) return [];
  if (n < judgesPerTeam) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Need at least ${judgesPerTeam} seated teams to give each team ${judgesPerTeam} different judges.`,
    });
  }
  const route = Math.min(slotCount, n);
  const shift = Math.max(1, Math.floor(route / judgesPerTeam));
  const pad = (((shift - (n % route)) % route) + route) % route;
  const period = n + pad;
  const length = (judgesPerTeam - 1) * period + n;
  const routesNeeded = Math.ceil(length / route);

  if (routesNeeded > judgeIds.length) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `${n} teams × ${judgesPerTeam} judges at ${route} visits per judge needs ${routesNeeded} judges; only ${judgeIds.length} available.`,
    });
  }

  const visits: Visit[] = [];
  for (let q = 0; q < length; q++) {
    const i = q % period;
    if (i >= n) continue;
    visits.push({
      judgeId: judgeIds[Math.floor(q / route)]!,
      teamId: teamIds[i]!,
      slot: (q % route) + 1,
    });
  }
  return visits;
}

function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Generate (or, with `reshuffle`, regenerate with a random judge order and a
 * random starting table) every general judging visit. Overwrites the draft.
 * Only organizer-type judges do general judging; sponsored judges stay in
 * their sponsor rooms.
 */
export async function generateVisits({ reshuffle = false } = {}) {
  return db.transaction(async (tx) => {
    await requireDraft(tx);
    const round = await requireRound(tx);

    const seated = await tx
      .select({ id: teams.id })
      .from(teams)
      .innerJoin(judgingTables, eq(teams.judgingTableId, judgingTables.id))
      .where(inArray(teams.submissionStatus, [...ELIGIBLE_STATUSES]))
      .orderBy(asc(judgingTables.walkOrder));
    if (seated.length === 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Seat teams before generating visits.",
      });
    }

    const generalJudges = await tx
      .select({ id: judges.id })
      .from(judges)
      .where(eq(judges.type, "organizer"))
      .orderBy(asc(judges.id));

    let teamIds = seated.map((t) => t.id);
    let judgeIds = generalJudges.map((j) => j.id);
    if (reshuffle) {
      const start = Math.floor(Math.random() * teamIds.length);
      teamIds = [...teamIds.slice(start), ...teamIds.slice(0, start)];
      judgeIds = shuffled(judgeIds);
    }

    const visits = buildVisits(
      teamIds,
      judgeIds,
      round.slotCount,
      round.judgesPerTeam,
    );
    await tx.delete(judgingAssignments).where(sql`true`);
    if (visits.length > 0) await tx.insert(judgingAssignments).values(visits);

    return {
      visits: visits.length,
      teams: teamIds.length,
      judgesUsed: new Set(visits.map((v) => v.judgeId)).size,
      judgesAvailable: judgeIds.length,
    };
  });
}

export async function publishPlan() {
  return db.transaction(async (tx) => {
    const round = await requireDraft(tx);
    if (!round) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Save the round settings first.",
      });
    }
    const [visits] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(judgingAssignments);
    if ((visits?.count ?? 0) === 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Generate visits before publishing.",
      });
    }
    const [row] = await tx
      .update(judgingRound)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(judgingRound.id, ROUND_ID))
      .returning();
    return row;
  });
}

// ---------------------------------------------------------------------------
// Day-of fixes
// ---------------------------------------------------------------------------

async function requireLiveAssignment(tx: Tx, assignmentId: number) {
  const row = await tx.query.judgingAssignments.findFirst({
    where: eq(judgingAssignments.id, assignmentId),
  });
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Visit not found." });
  }
  if (row.status === "reassigned") {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This visit was already reassigned.",
    });
  }
  return row;
}

export async function setAssignmentAbsent(
  assignmentId: number,
  absent: boolean,
) {
  return db.transaction(async (tx) => {
    await requireLiveAssignment(tx, assignmentId);
    const [row] = await tx
      .update(judgingAssignments)
      .set({ status: absent ? "team_absent" : "scheduled" })
      .where(eq(judgingAssignments.id, assignmentId))
      .returning();
    return row;
  });
}

/**
 * Hand a visit to another judge: the old row is retired as `reassigned` and a
 * new one is created in the same slot. The new judge must be free in that
 * slot and must not already be visiting the team.
 */
export async function reassignVisit(assignmentId: number, judgeId: string) {
  return db.transaction(async (tx) => {
    const visit = await requireLiveAssignment(tx, assignmentId);
    if (visit.judgeId === judgeId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That judge already has this visit.",
      });
    }
    const judge = await tx.query.judges.findFirst({
      where: eq(judges.id, judgeId),
    });
    if (!judge) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Judge not found." });
    }
    const clash = await tx.query.judgingAssignments.findFirst({
      where: and(
        eq(judgingAssignments.judgeId, judgeId),
        ne(judgingAssignments.status, "reassigned"),
        sql`(${judgingAssignments.slot} = ${visit.slot} or ${judgingAssignments.teamId} = ${visit.teamId})`,
      ),
    });
    if (clash) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          clash.teamId === visit.teamId
            ? "That judge is already visiting this team."
            : `That judge is busy in slot ${visit.slot}.`,
      });
    }

    await tx
      .update(judgingAssignments)
      .set({ status: "reassigned" })
      .where(eq(judgingAssignments.id, assignmentId));
    const [row] = await tx
      .insert(judgingAssignments)
      .values({ judgeId, teamId: visit.teamId, slot: visit.slot })
      .returning();
    return row;
  });
}

/**
 * A judge scores one of their planned visits. Once scored, changes go through
 * the existing `editTeamMark`.
 */
export async function submitVisitMark(
  judgeId: string,
  assignmentId: number,
  score: number,
) {
  return db.transaction(async (tx) => {
    const round = await getRound(tx);
    if (round?.status !== "published") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "The judging plan is not published yet.",
      });
    }
    const visit = await requireLiveAssignment(tx, assignmentId);
    if (visit.judgeId !== judgeId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This visit is not yours.",
      });
    }
    if (visit.status === "team_absent") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This team was flagged absent for this visit.",
      });
    }
    const existing = await tx.query.teamMarks.findFirst({
      where: and(
        eq(teamMarks.teamId, visit.teamId),
        eq(teamMarks.judgeId, judgeId),
      ),
      columns: { id: true },
    });
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "You already scored this team. Edit the existing mark instead.",
      });
    }
    const [mark] = await tx
      .insert(teamMarks)
      .values({ teamId: visit.teamId, judgeId, score, roundType: "regular" })
      .returning();
    return mark;
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Live (non-retired) visits, each with whether its judge has scored the team. */
async function liveVisits(tx: Tx, where?: ReturnType<typeof and>) {
  return tx
    .select({
      id: judgingAssignments.id,
      judgeId: judgingAssignments.judgeId,
      teamId: judgingAssignments.teamId,
      slot: judgingAssignments.slot,
      status: judgingAssignments.status,
      markId: teamMarks.id,
    })
    .from(judgingAssignments)
    .leftJoin(
      teamMarks,
      and(
        eq(teamMarks.teamId, judgingAssignments.teamId),
        eq(teamMarks.judgeId, judgingAssignments.judgeId),
      ),
    )
    .where(and(ne(judgingAssignments.status, "reassigned"), where))
    .orderBy(asc(judgingAssignments.slot));
}

export async function getSetup() {
  const [round, tables, eligible, generalJudges, visits] = await Promise.all([
    getRound(),
    db.query.judgingTables.findMany({
      orderBy: asc(judgingTables.walkOrder),
      with: { team: { columns: { id: true, name: true } } },
    }),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(teams)
      .where(inArray(teams.submissionStatus, [...ELIGIBLE_STATUSES])),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(judges)
      .where(eq(judges.type, "organizer")),
    db.select({ count: sql<number>`count(*)::int` }).from(judgingAssignments),
  ]);

  const teamCount = eligible[0]?.count ?? 0;
  const judgesPerTeam = round?.judgesPerTeam ?? 3;
  const slotCount = round?.slotCount ?? 6;
  return {
    round: round ?? null,
    tables,
    readiness: {
      eligibleTeams: teamCount,
      activeTables: tables.filter((t) => t.isActive).length,
      seatedTeams: tables.filter((t) => t.team).length,
      generalJudges: generalJudges[0]?.count ?? 0,
      judgesNeeded: Math.ceil((teamCount * judgesPerTeam) / slotCount),
      visits: visits[0]?.count ?? 0,
    },
  };
}

/** Counts for the organizer console, the big screen and hacker Home. */
export async function getProgress(now = new Date()) {
  const round = await getRound();
  const visits = await liveVisits(db);
  const perTeam = new Map<string, number>();
  for (const v of visits) {
    if (v.markId != null)
      perTeam.set(v.teamId, (perTeam.get(v.teamId) ?? 0) + 1);
  }
  const teamsPlanned = new Set(visits.map((v) => v.teamId)).size;
  const judgesPerTeam = round?.judgesPerTeam ?? 3;

  let currentSlot: number | null = null;
  if (round) {
    const elapsed = now.getTime() - round.startsAt.getTime();
    const slot = Math.floor(elapsed / (round.slotMinutes * MINUTE)) + 1;
    if (slot >= 1 && slot <= round.slotCount) currentSlot = slot;
  }

  return {
    status: round?.status ?? "draft",
    currentSlot,
    visitsPlanned: visits.length,
    visitsDone: visits.filter((v) => v.markId != null).length,
    visitsAbsent: visits.filter((v) => v.status === "team_absent").length,
    teamsPlanned,
    teamsComplete: [...perTeam.values()].filter((c) => c >= judgesPerTeam)
      .length,
  };
}

/** A judge's route, for the judge dashboard. Empty until published. */
export async function getJudgeVisits(judgeId: string) {
  const round = await getRound();
  if (round?.status !== "published") return { published: false, visits: [] };

  const visits = await liveVisits(
    db,
    and(eq(judgingAssignments.judgeId, judgeId)),
  );
  const teamRows = visits.length
    ? await db.query.teams.findMany({
        where: inArray(
          teams.id,
          visits.map((v) => v.teamId),
        ),
        columns: { id: true, name: true, devpostUrl: true, githubUrl: true },
        with: { judgingTable: { columns: { number: true, zone: true } } },
      })
    : [];
  const byId = new Map(teamRows.map((t) => [t.id, t]));

  return {
    published: true,
    visits: visits.map((v) => {
      const team = byId.get(v.teamId);
      return {
        assignmentId: v.id,
        slot: v.slot,
        ...slotWindow(round, v.slot),
        status: v.status,
        done: v.markId != null,
        team: team
          ? {
              id: team.id,
              name: team.name,
              devpostUrl: team.devpostUrl,
              githubUrl: team.githubUrl,
            }
          : null,
        table: team?.judgingTable ?? null,
      };
    }),
  };
}

/** What a hacker's Home shows: table, judges left and when, sponsor pitches. */
export async function getTeamJudging(teamId: string) {
  const round = await getRound();
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { id: true },
    with: {
      judgingTable: {
        columns: { number: true, zone: true, mapX: true, mapY: true },
      },
      pitches: {
        columns: { track: true, startsAt: true, endsAt: true },
        with: { room: { columns: { name: true, location: true } } },
      },
    },
  });
  if (round?.status !== "published" || !team) {
    return { published: false as const };
  }

  const visits = await liveVisits(
    db,
    and(eq(judgingAssignments.teamId, teamId)),
  );
  const pending = visits.filter(
    (v) => v.markId == null && v.status === "scheduled",
  );
  const next = pending[0];
  return {
    published: true as const,
    table: team.judgingTable,
    judgesTotal: visits.length,
    judgesDone: visits.filter((v) => v.markId != null).length,
    judgesLeft: pending.length,
    nextVisitAt: next ? slotWindow(round, next.slot).startsAt : null,
    visits: visits.map((v) => ({
      slot: v.slot,
      ...slotWindow(round, v.slot),
      done: v.markId != null,
      status: v.status,
    })),
    pitches: team.pitches
      .filter((p) => p.startsAt != null)
      .map((p) => ({
        track: p.track,
        room: p.room.name,
        location: p.room.location,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
      })),
  };
}
