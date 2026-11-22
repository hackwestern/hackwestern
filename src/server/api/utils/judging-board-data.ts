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
  judgesOnBoard,
  prizeTrackOf,
  fixedSponsorJudgingRoom,
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
import { round2OpenedAt } from "~/server/api/utils/sponsor-judging-settings";
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
    sponsors: registered.filter((s) => judgesOnBoard(s.name, prizeTracks)),
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
  const [rooms, sends, rows, scores, finals, reps, notices, openedAt] =
    await Promise.all([
      judgingRoomsWithSource(sponsors),
      db.select().from(sponsorShortlistSends),
      // Only board sponsors' slots: one that lost its prize track since the
      // last rebuild drops out on the next one, so it doesn't show now.
      ids.length > 0
        ? db
            .select()
            .from(sponsorPresentations)
            .where(inArray(sponsorPresentations.sponsorId, ids))
        : [],
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
      round2OpenedAt(),
    ]);
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
  const fixedRooms = new Map(
    sponsors.map((s) => [s.id, fixedSponsorJudgingRoom(s.name)]),
  );
  const lastSent = notices
    .map((n) => n.sentAt?.getTime() ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  return {
    round2Open: openedAt !== null,
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
        reps: orderReps(reps.filter((r) => r.sponsorId === s.id)).map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          isPrimary: r.isPrimary,
        })),
      };
    }),
    slots: placed
      .map((r) => ({
        sponsorId: r.sponsorId,
        teamId: r.teamId,
        teamName: names.get(r.teamId) ?? r.teamId,
        room: fixedRooms.get(r.sponsorId) ?? r.room ?? "",
        start: r.startMinute!,
        status: status.get(r.teamId) ?? ("not-sent" as const),
      }))
      .sort((a, b) => a.start - b.start || a.room.localeCompare(b.room)),
    /**
     * On a sent shortlist but no slot: no time left that keeps its gaps
     * (or past the cap). A sponsor without a room still gets times.
     */
    waiting: rows
      .filter((r) => r.startMinute === null)
      .map((r) => ({
        sponsorId: r.sponsorId,
        teamId: r.teamId,
        teamName: names.get(r.teamId) ?? r.teamId,
        reason: "full" as const,
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
  const [members, rows] = await Promise.all([
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
    /** One member checked in is enough (Jazz, 2026-11-20). */
    checkedIn: members.some((m) => m.signedInAt !== null),
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
      room: fixedSponsorJudgingRoom(r.sponsorName) ?? r.room ?? "",
      start: r.startMinute!,
    })),
  };
}

/**
 * Board sponsors with no judging room yet (remote ones always have one).
 * Notify teams waits until this is empty (Jazz, 2026-11-20).
 */
export async function sponsorsWithoutRoom() {
  const { sponsors } = await boardSponsors();
  const rooms = await judgingRoomsWithSource(sponsors);
  return sponsors.filter((s) => !rooms.has(s.id)).map((s) => s.name);
}

/**
 * Set a sponsor's judging room from the board's typed room box.
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
  const { sponsors } = await boardSponsors();
  const me = sponsors.find((s) => s.id === input.sponsorId);
  if (!me || remoteJudgingRoom(me.name) !== null) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  const fixedRoom = fixedSponsorJudgingRoom(me.name);
  if (fixedRoom) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `${me.name} judging is in ${fixedRoom}.`,
    });
  }
  // The sheets are slow: read them before the lock. The board's own rooms
  // are read again under it, so two organizers can't both take a room.
  const fromSheets = await judgingRoomsWithSource(sponsors);
  const onBoard = new Set(sponsors.map((s) => s.id));
  const same = (a: string | null | undefined, b: string) =>
    a?.toLowerCase() === b.toLowerCase();

  const result = await db.transaction(async (tx) => {
    await scheduleLock(tx);
    const picked = await tx.select().from(sponsorJudgingRooms);
    const roomOf = new Map(
      [...fromSheets].map(([id, r]) => [id, r.room] as const),
    );
    for (const p of picked) roomOf.set(p.sponsorId, p.room);
    for (const sponsor of sponsors) {
      const fixed = fixedSponsorJudgingRoom(sponsor.name);
      if (fixed) roomOf.set(sponsor.id, fixed);
    }
    // One spelling per room: "rm 2110" is Rm 2110, "foo" is a held "Foo".
    const room =
      JUDGING_ROOMS.find((r) => same(r, typed)) ??
      [...roomOf.values()].find((r) => same(r, typed)) ??
      typed;
    const holder = sponsors.find(
      (s) => s.id !== me.id && same(roomOf.get(s.id), room),
    );
    const mine = roomOf.get(me.id) ?? null;
    if (
      holder &&
      (!input.swap || !mine || fixedSponsorJudgingRoom(holder.name))
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: copy.room.takenError(
          roomOf.get(holder.id) ?? room,
          holder.name,
        ),
      });
    }
    const ids = holder ? [me.id, holder.id] : [me.id];
    await tx
      .delete(sponsorJudgingRooms)
      .where(inArray(sponsorJudgingRooms.sponsorId, ids));
    // A sponsor no longer on the board (no prize track now) gives up a
    // room it still held; it doesn't present.
    const stale = picked
      .filter((p) => !onBoard.has(p.sponsorId) && same(p.room, room))
      .map((p) => p.sponsorId);
    if (stale.length > 0) {
      await tx
        .delete(sponsorJudgingRooms)
        .where(inArray(sponsorJudgingRooms.sponsorId, stale));
    }
    await tx
      .insert(sponsorJudgingRooms)
      .values([
        { sponsorId: me.id, room },
        ...(holder && mine ? [{ sponsorId: holder.id, room: mine }] : []),
      ]);
    return { room, swappedWith: holder?.name ?? null };
  });
  if (!(await rebuildPresentationScheduleQuietly())) {
    await mirrorSponsorJudgingSoon();
  }
  return result;
}
