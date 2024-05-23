import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  serial,
  integer,
  pgEnum,
  pgTableCreator,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

/**
 * This is the prefix for tables from this year's hack western!
 * Please change it every year so we have separate tables for each year.
 * Make sure to also change the `tableFilter` in drizzle-config.ts.
 *
 * @see https://orm.drizzle.team/kit-docs/config-reference#tablesfilters
 */
const TABLE_PREFIX = "hackwestern2024";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `${TABLE_PREFIX}_${name}`);

/**
 * The status of a hacker application, from when it's first started (`IN_PROGRESS`).
 */
export const applicationStatus = pgEnum("application_status", [
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "IN_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "WAITLISTED",
  "DECLINED",
]);

/**
 * The school/university year that the hacker applicant is in.
 */
export const levelOfStudy = pgEnum("level_of_study", [
  "Less than Secondary / High School",
  "Secondary / High School",
  "Undergraduate University (2 year - community college etc.)",
  "Undergraduate University (3+ year)",
  "Graduate University (Masters, Professional, Doctoral, etc)",
  "Code School / Bootcamp",
  "Other Vocational / Trade Program or Apprenticeship",
  "Post Doctorate",
  "Other",
  "Not currently a student",
  "Prefer not to answer",
]);

/**
 * The subject that the applicant is mainly studying in university.
 */
export const major = pgEnum("major", [
  "Computer Science",
  "Computer Engineering",
  "Software Engineering",
  "Other Engineering Discipline",
  "Information Systems",
  "Information Technology",
  "System Administration",
  "Natural Sciences (Biology, Chemistry, Physics, etc.)",
  "Mathematics/Statistics",
  "Web Development/Web Design",
  "Business Administration",
  "Humanities",
  "Social Science",
  "Fine Arts/Performing Arts",
  "Other",
]);

/**
 * The number of hackathons the hacker applicant has attended before.
 */
export const numOfHackathons = pgEnum("num_of_hackathons", [
  "0",
  "1-3",
  "4-6",
  "7+",
]);

/**
 * The gender identity that the applicant identifies themselves with.
 */
export const gender = pgEnum("gender", [
  "Female",
  "Male",
  "Non-Binary",
  "Other",
]);

/**
 * The race/ethnicity of the applicant.
 */
export const ethnicity = pgEnum("race/ethnicity", [
  "American Indian or Alaskan Native",
  "Asian / Pacific Islander",
  "Black or African American",
  "Hispanic",
  "White / Caucasian",
  "Multiple ethnicity / Other",
]);

/**
 * The sexual orientation that the applicant identifies themselves with.
 */
export const sexualOrientation = pgEnum("sexual_orientation", [
  "Asexual / Aromantic",
  "Pansexual, Demisexual or Omnisexual",
  "Bisexual",
  "Queer",
  "Gay / Lesbian",
  "Heterosexual / Straight",
  "Other",
]);

/**
 * The table for storing hacker pre-registration, to be used as an email list
 * for when the actual application starts.
 */
export const preregistrations = createTable("preregistration", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  })
    .defaultNow()
    .notNull(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
});

/**
 * The table for storing hacker applications while the hacker is completing the application,
 * and during the review process.
 */
export const applications = createTable("application", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  userId: varchar("id", { length: 255 })
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  })
    .defaultNow()
    .notNull(),
  status: applicationStatus("status").default("IN_PROGRESS").notNull(),

  // About You
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  dateOfBirth: timestamp("date_of_birth").defaultNow().notNull(),
  phoneNumber: varchar("phone_number", { length: 42 }),
  countryOfResidence: smallint("country_of_residence"),

  school: varchar("name", { length: 255 }),
  levelOfStudy: levelOfStudy("level_of_study"),
  major: major("major"),

  attendedBefore: boolean("attended").default(false).notNull(),
  numOfHackathons: numOfHackathons("num_of_hackathons").default("0").notNull(),

  // Your Story
  ideaToLife: text("idea_to_life"),
  interestsAndPassions: text("interest_and_passions"),
  technologyInspires: text("technology_inspires"),

  // Profile Links
  resumeLink: varchar("resume_link", { length: 2048 }),
  githubLink: varchar("github_link", { length: 2048 }),
  linkedInLink: varchar("linkedin_link", { length: 2048 }),
  otherLink: varchar("other_link", { length: 2048 }),

  // Agreements
  agreeCodeOfConduct: boolean("agree_code_of_conduct").default(false).notNull(),
  agreeShareWithSponsors: boolean("agree_share_with_sponsors")
    .default(false)
    .notNull(),
  agreeShareWithMLH: boolean("agree_share_with_mlh").default(false).notNull(),
  agreeEmailsFromMLH: boolean("agree_emails_from_mlh").default(false).notNull(),
  agreeWillBe18: boolean("agree_will_be_18").default(false).notNull(),

  // Optional Questions
  underrepGroup: boolean("underrep_group"),
  gender: gender("gender"),
  ethnicity: ethnicity("ethnicity"),
  sexualOrientation: sexualOrientation("sexual_orientation"),
});

/**
 * Applications have a one-to-one relationship with Users,
 * ie. A user can only make one application, and an application can only be associated
 * with one user.
 */
export const applicationsRelation = relations(applications, ({ one }) => ({
  users: one(users),
}));

export const users = createTable("user", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("emailVerified", {
    mode: "date",
  }).default(sql`CURRENT_TIMESTAMP`),
  image: varchar("image", { length: 255 }),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

export const accounts = createTable(
  "account",
  {
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index("account_userId_idx").on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar("sessionToken", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_userId_idx").on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verificationToken",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export const resetPasswordTokens = createTable("resetPasswordToken", {
  userId: varchar("userId", { length: 255 })
    .references(() => users.id)
    .primaryKey(),
  token: varchar("token", { length: 255 }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});
