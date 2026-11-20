import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";

import {
  JUDGING_ROOMS,
  sponsorJudgingBoardCopy,
} from "~/content/sponsor-judging-board";
import { DIGITAL_JUDGING_SPONSORS } from "~/content/sponsor-prize-tracks";
import { teamStatus, type TeamStatus } from "~/lib/judging-board";
import { orderReps } from "~/lib/sponsor-organizer";
import { normalizeRoom } from "~/lib/sponsor-presentations";
import {
  hasPrizeTrack,
  isDigitalJudging,
  prizeTrackOf,
  remoteJudgingRoom,
} from "~/lib/sponsor-prize-tracks";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";
import {
  hasCurrentTimes,
  keysByTeam,
  rebuildPresentationScheduleQuietly,
  scheduleLock,
} from "~/server/api/utils/presentation-schedule";
import { judgingRoomsWithSource } from "~/server/api/utils/sponsor-judging-board";
import { safeProfileUrl } from "~/server/api/utils/sponsor-shortlist";
import { mirrorSponsorJudgingSoon } from "~/server/api/utils/sponsor-judging-sheet-mirror";
import { prizeTrackSponsors } from "~/server/api/utils/sponsor-prize-track-sheet";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatReps,
  dayOfRegistrations,
  sponsorFinalPicks,
  sponsorJudgingRooms,
  sponsorJudgingSponsors,
  sponsorPresentationConfirms,
  sponsorPresentationNotices,
  sponsorPresentations,
  sponsorShortlistSends,
  sponsorTeamScores,
  teams,
  users,
} from "~/server/db/schema";

const copy = sponsorJudgingBoardCopy;

/** The prize track sponsors on the board: in a room or remote, not digital. */
async function boardSponsors() {
  const prizeTracks = await prizeTrackSponsors();
  const registered = await db
    .select({
      id: sponsorJudgingSponsors.id,
      name: sponsorJudgingSponsors.name,
    })
    .from(sponsorJudgingSponsors)
    .orderBy(sponsorJudgingSponsors.name);
  return {
    registered,
    sponsors: registered.filter(
      (s) => hasPrizeTrack(s.name, prizeTracks) && !isDigitalJudging(s.name),
    ),
  };
}

/** Each team's status: Invite not sent, Waiting or Accepted. */
async function statusByTeam(
  rows: readonly {
    sponsorId: string;
    teamId: string;
    room: string | null;
    startMinute: number | null;
  }[],
) {
  const keys = keysByTeam(rows);
  const teamIds = [...keys.keys()];
  if (teamIds.length === 0) return new Map<string, TeamStatus>();
  const [notices, confirms] = await Promise.all([
    db
      .select({
        teamId: sponsorPresentationNotices.teamId,
        slotsKey: sponsorPresentationNotices.slotsKey,
        sentAt: sponsorPresentationNotices.sentAt,
        memberTeam: users.teamId,
      })
      .from(sponsorPresentationNotices)
      .innerJoin(users, eq(users.id, sponsorPresentationNotices.userId))
      .where(inArray(sponsorPresentationNotices.teamId, teamIds)),
    db
      .select()
      .from(sponsorPresentationConfirms)
      .where(inArray(sponsorPresentationConfirms.teamId, teamIds)),
  ]);
  const told = new Set(
    notices
      .filter((n) => n.memberTeam === n.teamId && hasCurrentTimes(n, keys))
      .map((n) => n.teamId),
  );
  const confirmed = new Set(
    confirms
      .filter((c) => keys.get(c.teamId) === c.slotsKey)
      .map((c) => c.teamId),
  );
  return new Map(
    teamIds.map((id) => [
      id,
      teamStatus({ told: told.has(id), confirmed: confirmed.has(id) }),
    ]),
  );
}

/**
 * Everything the organizer Judging board shows except the team modal:
 * each sponsor's room, shortlist, reps (with the head rep first), scoring
 * progress and top 5; every presentation with its team's status; teams
 * without a room or slot; who's still to be told; digital sponsors.
 */
export async function loadJudgingBoard() {
  const { registered, sponsors } = await boardSponsors();
  const ids = sponsors.map((s) => s.id);
  const [rooms, sends, rows, scores, finals, reps, notices] = await Promise.all(
    [
      judgingRoomsWithSource(sponsors),
      db.select().from(sponsorShortlistSends),
      db.select().from(sponsorPresentations),
      db
        .select({
          sponsorId: sponsorTeamScores.sponsorId,
          teamId: sponsorTeamScores.teamId,
          judgeName: sponsorTeamScores.judgeName,
        })
        .from(sponsorTeamScores),
      db.select().from(sponsorFinalPicks),
      ids.length > 0
        ? db
            .select({
              id: coffeeChatReps.id,
              sponsorId: coffeeChatReps.sponsorId,
              name: coffeeChatReps.name,
              phone: coffeeChatReps.phone,
              isPrimary: coffeeChatReps.isPrimary,
              position: coffeeChatReps.position,
            })
            .from(coffeeChatReps)
            .where(inArray(coffeeChatReps.sponsorId, ids))
        : [],
      db
        .select({ sentAt: sponsorPresentationNotices.sentAt })
        .from(sponsorPresentationNotices),
    ],
  );
  const status = await statusByTeam(rows);
  const teamIds = [...new Set(rows.map((r) => r.teamId))];
  const names = new Map(
    teamIds.length > 0
      ? (
          await db
            .select({ id: teams.id, name: teams.name })
            .from(teams)
            .where(inArray(teams.id, teamIds))
        ).map((t) => [t.id, t.name])
      : [],
  );
  const sendOf = new Map(sends.map((s) => [s.sponsorId, s]));
  const finalOf = new Map(finals.map((f) => [f.sponsorId, f]));
  const placed = rows.filter((r) => r.startMinute !== null);
  const lastSent = notices
    .map((n) => n.sentAt?.getTime() ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  return {
    finalTop: SPONSOR_FINAL_TOP,
    sponsors: sponsors.map((s) => {
      const send = sendOf.get(s.id);
      const shortlist = new Set(send?.teamIds ?? []);
      const mine = scores.filter((x) => x.sponsorId === s.id);
      const starts = placed
        .filter((r) => r.sponsorId === s.id)
        .map((r) => r.startMinute!);
      const room = rooms.get(s.id) ?? null;
      return {
        sponsorId: s.id,
        name: s.name,
        mode:
          remoteJudgingRoom(s.name) !== null
            ? ("remote" as const)
            : ("room" as const),
        room: room?.room ?? null,
        roomSource: room?.source ?? null,
        shortlistSentAt: send?.sentAt ?? null,
        teams: shortlist.size,
        repsJudging: new Set(mine.map((x) => x.judgeName.toLowerCase())).size,
        scored: new Set(
          mine.filter((x) => shortlist.has(x.teamId)).map((x) => x.teamId),
        ).size,
        topInAt: finalOf.get(s.id)?.submittedAt ?? null,
        firstStart: starts.length > 0 ? Math.min(...starts) : null,
        reps: orderReps(reps.filter((r) => r.sponsorId === s.id)).map(
          (r) => ({
            id: r.id,
            name: r.name,
            phone: r.phone,
            isPrimary: r.isPrimary,
          }),
        ),
      };
    }),
    slots: placed
      .map((r) => ({
        sponsorId: r.sponsorId,
        teamId: r.teamId,
        teamName: names.get(r.teamId) ?? r.teamId,
        room: r.room ?? "",
        start: r.startMinute!,
        status: status.get(r.teamId) ?? ("not-sent" as const),
      }))
      .sort((a, b) => a.start - b.start || a.room.localeCompare(b.room)),
    /** On a sent shortlist but no slot: the sponsor has no room, or full. */
    waiting: rows
      .filter((r) => r.startMinute === null)
      .map((r) => ({
        sponsorId: r.sponsorId,
        teamId: r.teamId,
        teamName: names.get(r.teamId) ?? r.teamId,
        reason: r.room ? ("full" as const) : ("no-room" as const),
      })),
    /** Scheduled teams with no member sent their current times. */
    teamsNotTold: [...status.values()].filter((v) => v === "not-sent").length,
    lastNotifiedAt: lastSent > 0 ? new Date(lastSent) : null,
    digital: DIGITAL_JUDGING_SPONSORS.map((entry) => {
      const row = registered.find((r) => prizeTrackOf(r.name, [entry]));
      return {
        name: row?.name ?? entry,
        topInAt: row ? (finalOf.get(row.id)?.submittedAt ?? null) : null,
      };
    }),
  };
}

/** Blank text is none. */
const link = (url: string | null | undefined) =>
  url?.trim() ? url.trim() : null;

/**
 * One team for the board's modal: links, members (check-in, school,
 * program, year, links), where and when it presents, its status, and
 * scores so far per sponsor.
 */
export async function loadBoardTeam(teamId: string) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    columns: { id: true, name: true, devpostUrl: true, githubUrl: true },
  });
  if (!team) throw new TRPCError({ code: "NOT_FOUND" });
  const [members, rows, scores] = await Promise.all([
    db
      .select({
        userId: users.id,
        userName: users.name,
        firstName: applications.firstName,
        lastName: applications.lastName,
        school: applications.school,
        schoolOther: applications.schoolOther,
        major: applications.major,
        year: applications.yearOfStudy,
        linkedin: applications.linkedInLink,
        github: applications.githubLink,
        resume: applications.resumeLink,
        website: applications.otherLink,
        signedInAt: dayOfRegistrations.signedInAt,
      })
      .from(users)
      .leftJoin(applications, eq(applications.userId, users.id))
      .leftJoin(dayOfRegistrations, eq(dayOfRegistrations.userId, users.id))
      .where(eq(users.teamId, teamId)),
    db
      .select({
        sponsorId: sponsorPresentations.sponsorId,
        teamId: sponsorPresentations.teamId,
        sponsorName: sponsorJudgingSponsors.name,
        room: sponsorPresentations.room,
        startMinute: sponsorPresentations.startMinute,
      })
      .from(sponsorPresentations)
      .innerJoin(
        sponsorJudgingSponsors,
        eq(sponsorJudgingSponsors.id, sponsorPresentations.sponsorId),
      )
      .where(eq(sponsorPresentations.teamId, teamId)),
    db
      .select({
        sponsorId: sponsorTeamScores.sponsorId,
        scoreHalves: sponsorTeamScores.scoreHalves,
      })
      .from(sponsorTeamScores)
      .where(eq(sponsorTeamScores.teamId, teamId)),
  ]);
  const status = (await statusByTeam(rows)).get(teamId) ?? "not-sent";
  const placed = rows
    .filter((r) => r.startMinute !== null)
    .sort((a, b) => a.startMinute! - b.startMinute!);
  return {
    teamId: team.id,
    name: team.name,
    // Typed by hackers: http(s) only, never a javascript: href.
    devpostUrl: safeProfileUrl(team.devpostUrl),
    githubUrl: safeProfileUrl(team.githubUrl),
    status,
    members: members
      .map((m) => {
        const name =
          [m.firstName, m.lastName]
            .filter((p): p is string => Boolean(p?.trim()))
            .map((p) => p.trim())
            .join(" ") ||
          (m.userName?.trim() ?? "");
        return {
          userId: m.userId,
          name,
          checkedIn: m.signedInAt !== null,
          school: link(m.schoolOther) ?? link(m.school),
          program: m.major ?? null,
          year:
            m.year && m.year !== "N/A" && m.year !== "Prefer not to answer"
              ? m.year
              : null,
          links: {
            linkedin: safeProfileUrl(m.linkedin),
            github: safeProfileUrl(m.github),
            resume: safeProfileUrl(m.resume),
            website: safeProfileUrl(m.website),
          },
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    presentsTo: placed.map((r) => ({
      sponsorId: r.sponsorId,
      sponsorName: r.sponsorName,
      room: r.room ?? "",
      start: r.startMinute!,
    })),
    scores: placed.map((r) => {
      const mine = scores.filter((s) => s.sponsorId === r.sponsorId);
      return {
        sponsorId: r.sponsorId,
        sponsorName: r.sponsorName,
        start: r.startMinute!,
        /** 1-10 in half points; null = no score yet. */
        average:
          mine.length > 0
            ? mine.reduce((n, s) => n + s.scoreHalves, 0) / mine.length / 2
            : null,
        reps: mine.length,
      };
    }),
  };
}

/**
 * Set a sponsor's judging room from the board (select, Other… or Move to).
 * A room holds one sponsor: a room another sponsor has is refused
 * (CONFLICT, "Rm 2230 is Canada Life's. Pick another.") unless `swap`,
 * which gives that sponsor this one's old room. Remote sponsors take no
 * room. Then the schedule is rebuilt: times stay, rooms change, and the
 * teams whose rooms changed need telling again.
 */
export async function setJudgingRoom(input: {
  sponsorId: string;
  room: string;
  swap: boolean;
}) {
  const typed = normalizeRoom(input.room);
  if (!typed) throw new TRPCError({ code: "BAD_REQUEST" });
  // "rm 2110" typed in Other… is Rm 2110.
  const room =
    JUDGING_ROOMS.find((r) => r.toLowerCase() === typed.toLowerCase()) ??
    typed;
  const { sponsors } = await boardSponsors();
  const me = sponsors.find((s) => s.id === input.sponsorId);
  if (!me || remoteJudgingRoom(me.name) !== null) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  const current = await judgingRoomsWithSource(sponsors);
  const sameRoom = (a: string | undefined, b: string) =>
    a?.toLowerCase() === b.toLowerCase();
  const holder = sponsors.find(
    (s) => s.id !== me.id && sameRoom(current.get(s.id)?.room, room),
  );
  const mine = current.get(me.id)?.room ?? null;
  if (holder && (!input.swap || !mine)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: copy.room.takenError(
        current.get(holder.id)?.room ?? room,
        holder.name,
      ),
    });
  }
  await db.transaction(async (tx) => {
    await scheduleLock(tx);
    const ids = holder ? [me.id, holder.id] : [me.id];
    await tx
      .delete(sponsorJudgingRooms)
      .where(inArray(sponsorJudgingRooms.sponsorId, ids));
    // Whoever else held this exact room on the board (e.g. a sponsor whose
    // sheet room now differs) gives it up; the unique index needs that.
    await tx.delete(sponsorJudgingRooms).where(eq(sponsorJudgingRooms.room, room));
    await tx.insert(sponsorJudgingRooms).values([
      { sponsorId: me.id, room },
      ...(holder && mine ? [{ sponsorId: holder.id, room: mine }] : []),
    ]);
  });
  if (!(await rebuildPresentationScheduleQuietly())) {
    await mirrorSponsorJudgingSoon();
  }
  return { room, swappedWith: holder?.name ?? null };
}
