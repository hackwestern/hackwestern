import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "~/server/db";
import { applications, teamFinderCards } from "~/server/db/schema";
import { getTeamFinderAccess } from "~/server/api/utils/team-finder-access";
import {
  type CardInput,
  type Skill,
  canShow,
  cardInput,
  cleanCard,
  displayName,
  schoolLabel,
  yearLabel,
} from "~/lib/team-finder";
import { type Contacts, formatPhone } from "~/lib/socials";
import {
  deletePhoto,
  newPhotoKey,
  ownsPhotoKey,
  photosConfigured,
  presignPhotoGet,
  putPhoto,
} from "~/server/storage/team-finder-photos";

const MAX_PHOTO_BYTES = 200 * 1024;

export type CardView = {
  userId: string;
  isMine: boolean;
  shown: boolean;
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
    userId: card.userId,
    isMine,
    shown: card.shown,
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

const cardValues = (userId: string, input: CardInput, hidden: boolean) => {
  const clean = cleanCard(input);
  return {
    userId,
    // A card goes on the board only if it is complete and not hidden by an organizer.
    shown: clean.shown && canShow(clean) && !hidden,
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

      const existing = await db.query.teamFinderCards.findFirst({
        where: eq(teamFinderCards.userId, userId),
        columns: { hiddenByOrganizerAt: true },
      });
      const values = cardValues(userId, input, !!existing?.hiddenByOrganizerAt);

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
        !card.hiddenByOrganizerAt &&
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

  deleteMine: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    await requireHacker(userId);

    const card = await db.query.teamFinderCards.findFirst({
      where: eq(teamFinderCards.userId, userId),
      columns: { photoKey: true },
    });
    if (!card) return;

    await db.delete(teamFinderCards).where(eq(teamFinderCards.userId, userId));
    if (card.photoKey && photosConfigured()) await deletePhoto(card.photoKey);
  }),

  uploadPhoto: protectedProcedure
    .input(z.object({ webpBase64: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      await requireHacker(userId);
      if (!photosConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "photos-unavailable",
        });
      }

      const bytes = Buffer.from(input.webpBase64, "base64");
      const isWebp =
        bytes.length >= 12 &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
      if (!isWebp || bytes.length > MAX_PHOTO_BYTES) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "invalid-photo" });
      }

      const card = await db.query.teamFinderCards.findFirst({
        where: eq(teamFinderCards.userId, userId),
      });
      if (!card) {
        throw new TRPCError({ code: "NOT_FOUND", message: "no-card" });
      }

      const key = newPhotoKey(userId);
      await putPhoto(key, bytes);
      const [updated] = await db
        .update(teamFinderCards)
        .set({ photoKey: key, updatedAt: new Date() })
        .where(eq(teamFinderCards.userId, userId))
        .returning();
      if (card.photoKey && ownsPhotoKey(userId, card.photoKey)) {
        await deletePhoto(card.photoKey);
      }
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
    await requireAccess(userId);

    const rows = await db
      .select({
        card: teamFinderCards,
        app: {
          firstName: applications.firstName,
          lastName: applications.lastName,
          school: applications.school,
          schoolOther: applications.schoolOther,
          yearOfStudy: applications.yearOfStudy,
          horseId: applications.horseId,
        },
      })
      .from(teamFinderCards)
      .innerJoin(applications, eq(applications.userId, teamFinderCards.userId))
      .where(
        or(
          eq(teamFinderCards.userId, userId),
          and(
            eq(teamFinderCards.shown, true),
            isNull(teamFinderCards.hiddenByOrganizerAt),
            sql`${applications.status} = 'CONFIRMED'`,
          ),
        ),
      )
      .orderBy(desc(teamFinderCards.updatedAt));

    return Promise.all(
      rows.map(async ({ card, app }) =>
        toView(card, app, card.userId === userId, await photoUrlFor(card)),
      ),
    );
  }),
});
