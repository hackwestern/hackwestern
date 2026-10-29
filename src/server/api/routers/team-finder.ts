import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { env } from "~/env";
import { db } from "~/server/db";
import { sendViaMailjet } from "~/server/mail-mailjet";
import {
  applications,
  teamFinderCards,
  teamFinderReports,
} from "~/server/db/schema";
import { getTeamFinderAccess } from "~/server/api/utils/team-finder-access";
import {
  type CardInput,
  type Skill,
  CONTACT_LIMITS,
  REPORTS_PER_DAY,
  canShow,
  cardInput,
  cleanCard,
  displayName,
  schoolLabel,
  yearLabel,
} from "~/lib/team-finder";
import { type ContactKind, type Contacts, formatPhone } from "~/lib/socials";
import {
  deletePhoto,
  newPhotoKey,
  photosConfigured,
  presignPhotoGet,
  putPhoto,
} from "~/server/storage/team-finder-photos";

const MAX_PHOTO_BYTES = 200 * 1024;
// A small file can still declare a huge picture; sharp refuses past this.
const MAX_PHOTO_PIXELS = 4096 * 4096;

export type CardView = {
  // The card's own random id, never the user id (the hacker pass QR payload).
  id: string;
  isMine: boolean;
  shown: boolean;
  hiddenByOrganizer: boolean;
  name: string;
  school?: string;
  year?: string;
  horseId: number | null;
  photoUrl?: string;
  needs: 1 | 2 | null;
  skills: Skill[];
  firstHackathon: boolean;
  lookingFor: string;
  idea: string | null;
  contacts: Contacts;
};

type CardRow = typeof teamFinderCards.$inferSelect;
type ApplicationRow = Pick<
  typeof applications.$inferSelect,
  | "firstName"
  | "lastName"
  | "school"
  | "schoolOther"
  | "yearOfStudy"
  | "horseId"
>;

function toView(
  card: CardRow,
  app: ApplicationRow | undefined,
  isMine: boolean,
  photoUrl?: string,
): CardView {
  const contacts: Contacts = {};
  if (card.discord) contacts.discord = card.discord;
  if (card.instagram) contacts.instagram = card.instagram;
  if (card.linkedin) contacts.linkedin = card.linkedin;
  if (card.github) contacts.github = card.github;
  if (card.phone) contacts.phone = card.phone;

  return {
    id: card.id,
    isMine,
    shown: card.shown,
    hiddenByOrganizer: !!card.hiddenByOrganizerAt,
    name: displayName(app?.firstName ?? null, app?.lastName ?? null),
    school: card.showSchool
      ? schoolLabel(app?.school ?? null, app?.schoolOther ?? null)
      : undefined,
    year: card.showYear ? yearLabel(app?.yearOfStudy ?? null) : undefined,
    horseId: app?.horseId ?? null,
    photoUrl,
    needs: card.needs === 1 || card.needs === 2 ? card.needs : null,
    skills: card.skills as Skill[],
    firstHackathon: card.firstHackathon,
    lookingFor: card.lookingFor,
    idea: card.idea,
    contacts,
  };
}

const appColumnsSelect = {
  firstName: applications.firstName,
  lastName: applications.lastName,
  school: applications.school,
  schoolOther: applications.schoolOther,
  yearOfStudy: applications.yearOfStudy,
  horseId: applications.horseId,
};

const appColumns = {
  firstName: true,
  lastName: true,
  school: true,
  schoolOther: true,
  yearOfStudy: true,
  horseId: true,
} as const;

/** Every procedure starts here; refusals carry the access reason. */
async function requireAccess(userId: string) {
  const access = await getTeamFinderAccess(userId);
  if (!access.ok) {
    throw new TRPCError({ code: "FORBIDDEN", message: access.reason });
  }
  return access;
}

async function requireHacker(userId: string) {
  const access = await requireAccess(userId);
  if (access.role !== "hacker") {
    throw new TRPCError({ code: "FORBIDDEN", message: "not-allowed" });
  }
}

async function requireOrganizer(userId: string) {
  const access = await requireAccess(userId);
  if (access.role !== "organizer") {
    throw new TRPCError({ code: "FORBIDDEN", message: "not-allowed" });
  }
}

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const shownAndConfirmed = and(
  eq(teamFinderCards.shown, true),
  sql`${applications.status} = 'CONFIRMED'`,
);

// What other people can see on the board.
const onBoard = and(
  shownAndConfirmed,
  isNull(teamFinderCards.hiddenByOrganizerAt),
);

const cardValues = (userId: string, input: CardInput) => {
  const clean = cleanCard(input);
  // The input allows 300 characters a contact; the columns hold less.
  for (const [kind, value] of Object.entries(clean.contacts)) {
    if (value && value.length > CONTACT_LIMITS[kind as ContactKind]) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${kind}-too-long` });
    }
  }
  return {
    userId,
    // Only a complete card can be shown. An organizer's hide is a separate
    // column, so unhiding brings back what the owner chose.
    shown: clean.shown && canShow(clean),
    needs: clean.needs,
    skills: clean.skills,
    firstHackathon: clean.firstHackathon,
    lookingFor: clean.lookingFor,
    idea: clean.idea,
    showSchool: clean.showSchool,
    showYear: clean.showYear,
    discord: clean.contacts.discord ?? null,
    instagram: clean.contacts.instagram ?? null,
    linkedin: clean.contacts.linkedin ?? null,
    github: clean.contacts.github ?? null,
    phone: clean.contacts.phone ?? null,
    updatedAt: new Date(),
  };
};

/** A one-hour link to the card's photo, or undefined when there is none or photos are off. */
async function photoUrlFor(card: CardRow) {
  if (!card.photoKey || !photosConfigured()) return undefined;
  return presignPhotoGet(card.photoKey);
}

async function setHidden(cardId: string, at: Date | null) {
  const [updated] = await db
    .update(teamFinderCards)
    .set({ hiddenByOrganizerAt: at })
    .where(eq(teamFinderCards.id, cardId))
    .returning({ id: teamFinderCards.id });
  if (!updated) {
    throw new TRPCError({ code: "NOT_FOUND", message: "no-card" });
  }
}

async function viewMine(userId: string, card: CardRow) {
  const app = await db.query.applications.findFirst({
    where: eq(applications.userId, userId),
    columns: appColumns,
  });
  return toView(card, app, true, await photoUrlFor(card));
}

export const teamFinderRouter = createTRPCRouter({
  getMine: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await requireHacker(userId);

    const [card, app] = await Promise.all([
      db.query.teamFinderCards.findFirst({
        where: eq(teamFinderCards.userId, userId),
      }),
      db.query.applications.findFirst({
        where: eq(applications.userId, userId),
        columns: { ...appColumns, phoneNumber: true },
      }),
    ]);

    return {
      card: card ? toView(card, app, true, await photoUrlFor(card)) : null,
      prefill: {
        phone: app?.phoneNumber ? formatPhone(app.phoneNumber) : null,
        school: schoolLabel(app?.school ?? null, app?.schoolOther ?? null),
        year: yearLabel(app?.yearOfStudy ?? null),
        horseId: app?.horseId ?? null,
        name: displayName(app?.firstName ?? null, app?.lastName ?? null),
      },
      hiddenByOrganizer: !!card?.hiddenByOrganizerAt,
    };
  }),

  saveMine: protectedProcedure
    .input(cardInput)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await requireHacker(userId);

      const values = cardValues(userId, input);

      const [card] = await db
        .insert(teamFinderCards)
        .values(values)
        .onConflictDoUpdate({ target: teamFinderCards.userId, set: values })
        .returning();
      return viewMine(userId, card!);
    }),

  setShown: protectedProcedure
    .input(z.object({ shown: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await requireHacker(userId);

      const card = await db.query.teamFinderCards.findFirst({
        where: eq(teamFinderCards.userId, userId),
      });
      if (!card) {
        throw new TRPCError({ code: "NOT_FOUND", message: "no-card" });
      }

      const shown =
        input.shown &&
        canShow({
          lookingFor: card.lookingFor,
          contacts: toView(card, undefined, true).contacts,
        });
      const [updated] = await db
        .update(teamFinderCards)
        .set({ shown, updatedAt: new Date() })
        .where(eq(teamFinderCards.userId, userId))
        .returning();
      return viewMine(userId, updated!);
    }),

  uploadPhoto: protectedProcedure
    .input(z.object({ photoBase64: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await requireHacker(userId);
      if (!photosConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "photos-unavailable",
        });
      }

      const bytes = Buffer.from(input.photoBase64, "base64");
      const isWebp =
        bytes.length >= 12 &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
      // Safari can't encode WebP, so the browser sends JPEG there.
      const isJpeg =
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff;
      if ((!isWebp && !isJpeg) || bytes.length > MAX_PHOTO_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "invalid-photo" });
      }

      // Store only our own output: the same 256px WebP the page makes.
      let photo: Buffer;
      try {
        photo = await sharp(bytes, { limitInputPixels: MAX_PHOTO_PIXELS })
          .resize(256, 256, { fit: "cover" })
          .webp({ quality: 85 })
          .toBuffer();
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "invalid-photo" });
      }

      const card = await db.query.teamFinderCards.findFirst({
        where: eq(teamFinderCards.userId, userId),
      });
      if (!card) {
        throw new TRPCError({ code: "NOT_FOUND", message: "no-card" });
      }

      const key = newPhotoKey("webp");
      await putPhoto(key, photo, "image/webp");
      const [updated] = await db
        .update(teamFinderCards)
        .set({ photoKey: key, updatedAt: new Date() })
        .where(eq(teamFinderCards.userId, userId))
        .returning();
      // The previous key comes from the caller's own row, so it's theirs.
      if (card.photoKey) await deletePhoto(card.photoKey);
      return viewMine(userId, updated!);
    }),

  removePhoto: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await requireHacker(userId);

    const card = await db.query.teamFinderCards.findFirst({
      where: eq(teamFinderCards.userId, userId),
    });
    if (!card) {
      throw new TRPCError({ code: "NOT_FOUND", message: "no-card" });
    }

    const [updated] = await db
      .update(teamFinderCards)
      .set({ photoKey: null, updatedAt: new Date() })
      .where(eq(teamFinderCards.userId, userId))
      .returning();
    if (card.photoKey && photosConfigured()) await deletePhoto(card.photoKey);
    return viewMine(userId, updated!);
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const { role } = await requireAccess(userId);

    const rows = await db
      .select({
        card: teamFinderCards,
        app: appColumnsSelect,
      })
      .from(teamFinderCards)
      .innerJoin(applications, eq(applications.userId, teamFinderCards.userId))
      .where(
        role === "organizer"
          ? // Organizers also get the cards they hid, so they can unhide them.
            shownAndConfirmed
          : or(eq(teamFinderCards.userId, userId), onBoard),
      )
      .orderBy(desc(teamFinderCards.updatedAt));

    return Promise.all(
      rows.map(async ({ card, app }) =>
        toView(card, app, card.userId === userId, await photoUrlFor(card)),
      ),
    );
  }),

  report: protectedProcedure
    .input(z.object({ cardId: z.string().uuid(), note: z.string().max(500) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await requireHacker(userId);

      const [row] = await db
        .select({ card: teamFinderCards, app: appColumnsSelect })
        .from(teamFinderCards)
        .innerJoin(
          applications,
          eq(applications.userId, teamFinderCards.userId),
        )
        .where(and(eq(teamFinderCards.id, input.cardId), onBoard));
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "no-card" });
      }
      if (row.card.userId === userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "own-card" });
      }

      const [counted] = await db
        .select({ sent: count() })
        .from(teamFinderReports)
        .where(
          and(
            eq(teamFinderReports.reporterId, userId),
            gt(teamFinderReports.createdAt, sql`now() - interval '24 hours'`),
          ),
        );
      if ((counted?.sent ?? 0) >= REPORTS_PER_DAY) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "report-limit",
        });
      }
      // Reporting the same card again is a success that sends nothing.
      const inserted = await db
        .insert(teamFinderReports)
        .values({ reporterId: userId, cardId: row.card.id })
        .onConflictDoNothing()
        .returning();
      if (inserted.length === 0) return;

      const view = toView(row.card, row.app, false);
      const lines = [
        `Reported card: ${view.name} (card ${view.id})`,
        `Reported by: ${ctx.session.user.name ?? "unknown"} <${ctx.session.user.email}>`,
        "",
        `Looking for: ${view.lookingFor}`,
        `Idea: ${view.idea ?? ""}`,
        `Needs: ${view.needs ?? "solo"}`,
        `Skills: ${view.skills.join(", ")}`,
        `First hackathon: ${view.firstHackathon ? "yes" : "no"}`,
        `School: ${view.school ?? ""}`,
        `Year: ${view.year ?? ""}`,
        ...Object.entries(view.contacts).map(([k, v]) => `${k}: ${v}`),
        "",
        `Note: ${input.note}`,
      ];
      const text = lines.join("\n");

      const res = await sendViaMailjet(
        {
          from: "Hack Western Team <hello@hackwestern.com>",
          to: "hello@hackwestern.com",
          replyTo: ctx.session.user.email ?? undefined,
          subject: `Team finder report: ${view.name}`,
          html: `<pre style="font-family:inherit">${escapeHtml(text)}</pre>`,
          text,
        },
        { apiKey: env.MAILJET_API_KEY, secretKey: env.MAILJET_SECRET_KEY },
      );
      if (res.error) {
        // Free the slot so they can retry.
        await db
          .delete(teamFinderReports)
          .where(
            and(
              eq(teamFinderReports.reporterId, userId),
              eq(teamFinderReports.cardId, row.card.id),
            ),
          );
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "report-failed",
        });
      }
    }),

  hideCard: protectedProcedure
    .input(z.object({ cardId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireOrganizer(ctx.session.user.id);
      await setHidden(input.cardId, new Date());
    }),

  unhideCard: protectedProcedure
    .input(z.object({ cardId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireOrganizer(ctx.session.user.id);
      await setHidden(input.cardId, null);
    }),
});
