import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  serial,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";
import type { CanvasPaths } from "~/types/canvas";

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

export const avatarColour = pgEnum("avatar_colour", [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
]);

/**
 * Year of study for the hacker
 */
export const yearOfStudy = pgEnum("year_of_study", [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th+",
  "N/A",
  "Pefer not to answer",
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
  "Prefer not to answer",
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
  "Prefer not to answer",
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
  "Prefer not to answer",
]);

/**
 * Country of residence for the applicant.
 */
export const countrySelection = pgEnum("country", [
  "Canada",
  "United States",
  "India",
  "Other",
]);

/**
 * The table for storing hacker pre-registration, to be used as an email list
 * for when the actual application starts.
 */
export const preregistrations = pgTable("preregistration", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  })
    .defaultNow()
    .notNull(),
  email: varchar("email", { length: 320 }).unique().notNull(),
});

/**
 * The table for storing organizer reviews of an application, to be used for the
 * application review portal.
 */
export const reviews = pgTable(
  "review",
  {
    reviewerUserId: varchar("reviewer_user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    applicantUserId: varchar("applicant_user_id", { length: 255 })
      .notNull()
      .references(() => applications.userId)
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
    originalityRating: smallint("originality_rating").default(0),
    technicalityRating: smallint("technicality_rating").default(0),
    passionRating: smallint("passion_rating").default(0),
    comments: text("comments"),
    completed: boolean("completed").default(false),
    referral: boolean("referral").default(false),
  },
  (review) => [
    primaryKey({
      columns: [review.reviewerUserId, review.applicantUserId],
    }),
    index("applicant_user_id_idx").on(review.applicantUserId),
  ],
);

/**
 * Reviews have a many-to-one relationship with users for reviewer and applicant.
 * ie. a review only has one reviewer and one applicant user.
 *
 * Reviews have a many-to-one relationship with applications.
 * ie. a review is for one application, but an application can have many reveiws.
 */
export const reviewsRelations = relations(reviews, ({ one }) => ({
  reviewer: one(users, {
    fields: [reviews.reviewerUserId],
    references: [users.id],
  }),
  applicant: one(users, {
    fields: [reviews.applicantUserId],
    references: [users.id],
  }),
  application: one(applications, {
    fields: [reviews.applicantUserId],
    references: [applications.userId],
  }),
}));

/**
 * The table for storing hacker applications while the hacker is completing the application,
 * and during the review process.
 */
export const applications = pgTable(
  "application",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
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

    // Avatar
    avatarColour: avatarColour("avatar_colour"),
    avatarFace: integer("avatar_face"),
    avatarLeftHand: integer("avatar_left_hand"),
    avatarRightHand: integer("avatar_right_hand"),
    avatarHat: integer("avatar_hat"),

    // About You
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    age: integer("age"), // 18+
    phoneNumber: varchar("phone_number", { length: 42 }), // Frontend validation
    countryOfResidence: countrySelection("country_of_residence"),

    school: varchar("name", { length: 255 }),
    yearOfStudy: yearOfStudy("year_of_study"),
    major: major("major"),

    attendedBefore: boolean("attended"),
    numOfHackathons: numOfHackathons("num_of_hackathons"),

    // Your Story
    question1: text("question1"),
    question2: text("question2"),
    question3: text("question3"),

    // Profile Links
    resumeLink: varchar("resume_link", { length: 2048 }),
    githubLink: varchar("github_link", { length: 2048 }),
    linkedInLink: varchar("linkedin_link", { length: 2048 }),
    otherLink: varchar("other_link", { length: 2048 }),

    // Agreements
    agreeCodeOfConduct: boolean("agree_code_of_conduct") // Need
      .default(false)
      .notNull(),
    agreeShareWithSponsors: boolean("agree_share_with_sponsors") // Optional
      .default(false)
      .notNull(),
    agreeShareWithMLH: boolean("agree_share_with_mlh") // Need
      .default(false)
      .notNull(),
    agreeEmailsFromMLH: boolean("agree_emails_from_mlh") // Optional
      .default(false)
      .notNull(),
    agreeWillBe18: boolean("agree_will_be_18") // Need
      .default(false)
      .notNull(),

    // Optional Questions
    underrepGroup: boolean("underrep_group"),
    gender: gender("gender"),
    ethnicity: ethnicity("ethnicity"),
    sexualOrientation: sexualOrientation("sexual_orientation"),

    // Canvas - default to an empty but well-typed structure so new rows are valid
    canvasData: jsonb("canvas_data")
      .$type<{
        paths: CanvasPaths;
        timestamp: number;
        version: string;
      }>()
      .default(sql`'{"paths":[],"timestamp":0,"version":""}'::jsonb`)
      .notNull(),
  },
  (application) => [index("user_id_idx").on(application.userId)],
);

/**
 * Applications have a one-to-one relationship with Users,
 * ie. A user can only make one application, and an application can only be associated
 * with one user.
 *
 * Applications have a one-to-many relationship with Reviews,
 * ie. An application can have many reviews, but a review is only for one application.
 */
export const applicationsRelations = relations(
  applications,
  ({ one, many }) => ({
    user: one(users, {
      fields: [applications.userId],
      references: [users.id],
    }),
    reviews: many(reviews),
  }),
);

export const userType = pgEnum("user_type", ["hacker", "organizer", "sponsor"]);

export const users = pgTable(
  "user",
  {
    id: varchar("id", { length: 255 }).notNull().primaryKey(),
    name: varchar("name", { length: 255 }),
    password: varchar("password", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: timestamp("emailVerified", {
      mode: "date",
    }).default(sql`CURRENT_TIMESTAMP`),
    image: varchar("image", { length: 255 }),
    type: userType("type").default("hacker"),

    scavengerHuntEarned: integer("scavenger_hunt_earned").default(0),
    scavengerHuntBalance: integer("scavenger_hunt_balance").default(0),
  },
  (user) => [
    index("user_scavenger_hunt_earned_idx").on(user.scavengerHuntEarned),
    index("user_scavenger_hunt_balance_idx").on(user.scavengerHuntBalance),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  accounts: many(accounts),
  application: one(applications),
}));

export const accounts = pgTable(
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
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    index("account_userId_idx").on(account.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = pgTable(
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
  (session) => [index("session_userId_idx").on(session.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

export const resetPasswordTokens = pgTable("reset_password_token", {
  userId: varchar("userId", { length: 255 })
    .references(() => users.id)
    .primaryKey(),
  token: varchar("token", { length: 255 }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const scavengerHuntItems = pgTable("scavenger_hunt_item", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 12 }).unique().notNull(),
  points: smallint("points").default(1).notNull(),
  description: text("description"),
  deletedAt: timestamp("deleted_at", { mode: "date", precision: 3 }),
});

export const scavengerHuntScans = pgTable(
  "scavenger_hunt_scan",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    scannerId: varchar("scanner_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    itemId: integer("item_id")
      .notNull()
      .references(() => scavengerHuntItems.id),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.itemId] }),
    index("scan_user_idx").on(t.userId),
    index("scan_scanner_idx").on(t.scannerId),
  ],
);

export const scavengerHuntRewards = pgTable("scavenger_hunt_reward", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  costPoints: smallint("cost_points").notNull(),
  description: text("description"),
  quantity: integer("quantity"),
});

export const scavengerHuntRedemptions = pgTable(
  "scavenger_hunt_redemption",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    rewardId: integer("reward_id")
      .notNull()
      .references(() => scavengerHuntRewards.id),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("redemption_user_idx").on(t.userId)],
);
