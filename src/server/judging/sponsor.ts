import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import {
  judges,
  judgingAssignments,
  sponsorPitches,
  sponsorRooms,
  teams,
  users,
} from "~/server/db/schema";
import { sendViaMailjet } from "~/server/mail-mailjet";
import {
  sponsorPitchJudgeTemplate,
  sponsorPitchTeamTemplate,
} from "~/server/api/routers/email-templates";
import {
  type SetShortlistInput,
  type UpsertSponsorRoomInput,
} from "~/schemas/judging-plan";
import { ELIGIBLE_STATUSES, getRound, slotWindow } from "./plan";

const MINUTE = 60_000;
const MAX_SLOT_SEARCH = 500;
const HACK_WESTERN_EMAIL = "Hack Western Team <hello@hackwestern.com>";

type Interval = { start: number; end: number };

function overlaps(list: Interval[] | undefined, iv: Interval) {
  return (list ?? []).some((x) => x.start < iv.end && iv.start < x.end);
}

function push(map: Map<string, Interval[]>, key: string, iv: Interval) {
  const list = map.get(key);
  if (list) list.push(iv);
  else map.set(key, [iv]);
}

async function requireNothingSent(where?: ReturnType<typeof and>) {
  const sent = await db.query.sponsorPitches.findFirst({
    where: and(isNotNull(sponsorPitches.notifiedAt), where),
    columns: { track: true },
  });
  if (sent) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Room messages have already gone out, so the pitch schedule is frozen.",
    });
  }
}

export async function upsertSponsorRoom(input: UpsertSponsorRoomInput) {
  const [row] = await db
    .insert(sponsorRooms)
    .values(input)
    .onConflictDoUpdate({
      target: sponsorRooms.track,
      set: {
        name: input.name,
        location: input.location,
        slotMinutes: input.slotMinutes,
      },
    })
    .returning();
  return row;
}

/**
 * Replace a track's shortlist. Teams dropped from the list lose their pitch,
 * and every pitch in the track loses its time, since the order changed.
 */
export async function setShortlist(
  input: SetShortlistInput,
  submittedBy: string,
) {
  const room = await db.query.sponsorRooms.findFirst({
    where: eq(sponsorRooms.track, input.track),
  });
  if (!room) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Set up the room for ${input.track} first.`,
    });
  }
  await requireNothingSent(and(eq(sponsorPitches.track, input.track)));

  const teamIds = input.teams.map((t) => t.teamId);
  if (new Set(teamIds).size !== teamIds.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A team appears twice in the shortlist.",
    });
  }
  if (teamIds.length > 0) {
    const found = await db
      .select({ id: teams.id })
      .from(teams)
      .where(
        and(
          inArray(teams.id, teamIds),
          inArray(teams.submissionStatus, [...ELIGIBLE_STATUSES]),
        ),
      );
    if (found.length !== teamIds.length) {
      const known = new Set(found.map((f) => f.id));
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Not submitted teams: ${teamIds.filter((id) => !known.has(id)).join(", ")}`,
      });
    }
  }

  return db.transaction(async (tx) => {
    await tx
      .delete(sponsorPitches)
      .where(
        and(
          eq(sponsorPitches.track, input.track),
          teamIds.length > 0
            ? notInArray(sponsorPitches.teamId, teamIds)
            : undefined,
        ),
      );
    for (const t of input.teams) {
      await tx
        .insert(sponsorPitches)
        .values({
          track: input.track,
          teamId: t.teamId,
          rank: t.rank,
          submittedBy,
        })
        .onConflictDoUpdate({
          target: [sponsorPitches.track, sponsorPitches.teamId],
          set: { rank: t.rank, submittedBy, startsAt: null, endsAt: null },
        });
    }
    await tx
      .update(sponsorPitches)
      .set({ startsAt: null, endsAt: null })
      .where(eq(sponsorPitches.track, input.track));
    return { track: input.track, teams: input.teams.length };
  });
}

/**
 * Give every shortlisted team a time in its track's room, starting at
 * `startsAt` and stepping in the room's slot length. Pitches are placed in
 * rank order, round-robin across rooms, at the earliest time where:
 *  - the room is free,
 *  - the team is not pitching in another room and has no general judging
 *    visit scheduled then,
 *  - none of the room's judges (sponsored judges on that track) is in
 *    another room.
 * Requires the general plan to be published, since those visits are part of
 * the conflict check.
 */
export async function schedulePitches(startsAt: Date) {
  const round = await getRound();
  if (round?.status !== "published") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Publish the general judging plan before scheduling pitches.",
    });
  }
  await requireNothingSent();

  const [rooms, pitches, sponsorJudges, visits] = await Promise.all([
    db.query.sponsorRooms.findMany(),
    db.query.sponsorPitches.findMany({
      orderBy: [asc(sponsorPitches.rank), asc(sponsorPitches.track)],
    }),
    db
      .select({ id: judges.id, track: judges.track })
      .from(judges)
      .where(eq(judges.type, "sponsored")),
    db
      .select({
        teamId: judgingAssignments.teamId,
        slot: judgingAssignments.slot,
      })
      .from(judgingAssignments)
      .where(ne(judgingAssignments.status, "reassigned")),
  ]);

  const roomByTrack = new Map(rooms.map((r) => [r.track, r]));
  const judgesByTrack = new Map<string, string[]>();
  for (const j of sponsorJudges) {
    for (const t of j.track ?? []) {
      judgesByTrack.set(t, [...(judgesByTrack.get(t) ?? []), j.id]);
    }
  }

  const roomBusy = new Map<string, Interval[]>();
  const teamBusy = new Map<string, Interval[]>();
  const judgeBusy = new Map<string, Interval[]>();
  for (const v of visits) {
    const w = slotWindow(round, v.slot);
    push(teamBusy, v.teamId, {
      start: w.startsAt.getTime(),
      end: w.endsAt.getTime(),
    });
  }

  const base = startsAt.getTime();
  const placed: {
    track: (typeof pitches)[number]["track"];
    teamId: string;
    start: number;
    end: number;
  }[] = [];
  for (const p of pitches) {
    const room = roomByTrack.get(p.track);
    if (!room) continue;
    const len = room.slotMinutes * MINUTE;
    const roomJudges = judgesByTrack.get(p.track) ?? [];

    let found: Interval | null = null;
    for (let k = 0; k < MAX_SLOT_SEARCH && !found; k++) {
      const iv = { start: base + k * len, end: base + (k + 1) * len };
      if (overlaps(roomBusy.get(p.track), iv)) continue;
      if (overlaps(teamBusy.get(p.teamId), iv)) continue;
      if (roomJudges.some((j) => overlaps(judgeBusy.get(j), iv))) continue;
      found = iv;
    }
    if (!found) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Could not find a free time for team ${p.teamId} in ${p.track}.`,
      });
    }
    push(roomBusy, p.track, found);
    push(teamBusy, p.teamId, found);
    for (const j of roomJudges) push(judgeBusy, j, found);
    placed.push({ track: p.track, teamId: p.teamId, ...found });
  }

  await db.transaction(async (tx) => {
    for (const p of placed) {
      await tx
        .update(sponsorPitches)
        .set({ startsAt: new Date(p.start), endsAt: new Date(p.end) })
        .where(
          and(
            eq(sponsorPitches.track, p.track),
            eq(sponsorPitches.teamId, p.teamId),
          ),
        );
    }
  });
  return { scheduled: placed.length };
}

export async function getSponsorSchedule() {
  return db.query.sponsorRooms.findMany({
    with: {
      pitches: {
        orderBy: [asc(sponsorPitches.startsAt), asc(sponsorPitches.rank)],
        with: { team: { columns: { id: true, name: true } } },
      },
    },
  });
}

/**
 * Email each scheduled team its room and time, and each room's judges their
 * pitch list. Rows already marked notified are skipped, so re-running only
 * retries what failed.
 */
export async function sendRoomMessages() {
  const creds = {
    apiKey: env.MAILJET_API_KEY,
    secretKey: env.MAILJET_SECRET_KEY,
  };
  const failures: string[] = [];
  let teamsNotified = 0;
  let roomsNotified = 0;

  const pending = await db.query.sponsorPitches.findMany({
    where: and(
      isNotNull(sponsorPitches.startsAt),
      isNull(sponsorPitches.notifiedAt),
    ),
    with: {
      room: true,
      team: {
        columns: { id: true, name: true },
        with: { members: { columns: { email: true } } },
      },
    },
  });
  for (const p of pending) {
    const to = p.team.members.map((m) => m.email);
    if (to.length === 0 || !p.startsAt) continue;
    const { error } = await sendViaMailjet(
      {
        from: HACK_WESTERN_EMAIL,
        to,
        subject: `Hack Western 13: your ${p.track} pitch`,
        html: sponsorPitchTeamTemplate({
          teamName: p.team.name,
          track: p.track,
          room: p.room.name,
          location: p.room.location,
          startsAt: p.startsAt,
        }),
      },
      creds,
    );
    if (error) {
      failures.push(`team ${p.team.id}: ${error.message}`);
      continue;
    }
    await db
      .update(sponsorPitches)
      .set({ notifiedAt: new Date() })
      .where(
        and(
          eq(sponsorPitches.track, p.track),
          eq(sponsorPitches.teamId, p.teamId),
        ),
      );
    teamsNotified++;
  }

  const rooms = await db.query.sponsorRooms.findMany({
    where: isNull(sponsorRooms.judgesNotifiedAt),
    with: {
      pitches: {
        where: isNotNull(sponsorPitches.startsAt),
        orderBy: asc(sponsorPitches.startsAt),
        with: { team: { columns: { name: true } } },
      },
    },
  });
  for (const room of rooms) {
    if (room.pitches.length === 0) continue;
    const roomJudges = await db
      .select({ email: users.email })
      .from(judges)
      .innerJoin(users, eq(users.id, judges.id))
      .where(
        and(
          eq(judges.type, "sponsored"),
          sql`${room.track} = any(${judges.track})`,
        ),
      );
    if (roomJudges.length === 0) continue;
    const { error } = await sendViaMailjet(
      {
        from: HACK_WESTERN_EMAIL,
        to: roomJudges.map((j) => j.email),
        subject: `Hack Western 13: ${room.track} pitch schedule`,
        html: sponsorPitchJudgeTemplate({
          track: room.track,
          room: room.name,
          location: room.location,
          pitches: room.pitches.map((p) => ({
            teamName: p.team.name,
            startsAt: p.startsAt!,
          })),
        }),
      },
      creds,
    );
    if (error) {
      failures.push(`room ${room.track}: ${error.message}`);
      continue;
    }
    await db
      .update(sponsorRooms)
      .set({ judgesNotifiedAt: new Date() })
      .where(eq(sponsorRooms.track, room.track));
    roomsNotified++;
  }

  return { teamsNotified, roomsNotified, failures };
}
