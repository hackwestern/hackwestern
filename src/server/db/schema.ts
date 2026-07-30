import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  uniqueIndex,
  serial,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
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
  "CONFIRMED",
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
 * T-Shirt size for the applicant
 */
export const shirtSize = pgEnum("shirt_size", ["S", "M", "L", "XL"]);

export const dietaryRestrictions = pgEnum("dietary_restrictions", [
  "Vegetarian",
  "Vegan",
  "Kosher",
  "Halal",
  "Other",
]);

/**
 * Relationship of the emergency contact to the applicant
 */
export const emergencyContactRelationship = pgEnum(
  "emergency_contact_relationship",
  ["Parent", "Sibling", "Other family member", "Friend", "Coworker", "Other"],
);

/**
 * Status of applicants method of transportation
 */
export const transportationMethod = pgEnum("transportation_method", [
  "Waterloo",
  "Toronto",
  "Hamilton",
  "None",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "draft",
  "submitted",
  "late",
]);

export const judgeTypeEnum = pgEnum("judge_type", ["organizer", "sponsored"]);

export const judgingQueueStatusEnum = pgEnum("judging_queue_status", [
  "waiting",
  "assigned",
]);

export const roundTypeEnum = pgEnum("round_type", ["regular", "sponsored"]);

export const trackEnum = pgEnum("track", [
  "Best Use of Cohere",
  "Best Use of AntiGravity",
  "Best Domain",
  "General",
]);

/**
 * The type of cheat check run against an individual hacker.
 */
export const hackerCheckType = pgEnum("hacker_check_type", [
  "IS_OF_AGE",
  "IS_REGISTERED",
]);

/**
 * The type of cheat check run against a team submission.
 */
export const teamCheckType = pgEnum("team_check_type", [
  "COMMIT_WITHIN_ALLOTTED_TIME",
  "ONLY_TEAM_MEMBER_COMMITS",
  "DEVPOST_MEMBERS_REGISTERED",
]);

// ---------------------------------------------------------------------------
// Teams — defined before users so users can FK into it
// ---------------------------------------------------------------------------

/**
 * The table for storing hacker teams formed during the event.
 * Also serves as the project submission record (devpostUrl, githubUrl, submissionStatus).
 */
export const teams = pgTable(
  "team",
  {
    id: varchar("id", { length: 6 }).notNull().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),

    // Project submission
    devpostUrl: varchar("devpost_url", { length: 2048 }),
    githubUrl: varchar("github_url", { length: 2048 }),
    submissionStatus: submissionStatusEnum("submission_status")
      .default("draft")
      .notNull(),
    submittedAt: timestamp("submitted_at", { mode: "date", precision: 3 }),
    tracks: trackEnum("tracks").array(),
    memberGithubUsernames: text("member_github_usernames").array(),
    memberDevpostUsernames: text("member_devpost_usernames").array(),

    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("team_created_at_idx").on(t.createdAt)],
);

// ---------------------------------------------------------------------------
// Core auth / user tables
// ---------------------------------------------------------------------------

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

    teamId: varchar("team_id", { length: 255 }).references(() => teams.id, {
      onDelete: "set null",
    }),

    scavengerHuntEarned: integer("scavenger_hunt_earned").default(0),
    scavengerHuntBalance: integer("scavenger_hunt_balance").default(0),
  },
  (user) => [
    index("user_scavenger_hunt_earned_idx").on(user.scavengerHuntEarned),
    index("user_scavenger_hunt_balance_idx").on(user.scavengerHuntBalance),
    index("user_team_id_idx").on(user.teamId),
  ],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  accounts: many(accounts),
  application: one(applications),
  team: one(teams, {
    fields: [users.teamId],
    references: [teams.id],
  }),
  hackerCheckResults: many(hackerCheckResults, {
    relationName: "hacker_check_hacker",
  }),
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

// ---------------------------------------------------------------------------
// Applications & reviews
// ---------------------------------------------------------------------------

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

    shirtSize: shirtSize("shirt_size"),
    dietaryRestrictions: dietaryRestrictions("dietary_restrictions"),
    dietaryRestrictionsOther: varchar("dietary_restrictions_other", {
      length: 255,
    }),

    attendedBefore: boolean("attended"),
    numOfHackathons: numOfHackathons("num_of_hackathons"),

    // Your Story
    question1: text("question1"),
    question2: text("question2"),
    question3: text("question3"),

    // Profile Links — mandatory for cheat checks
    githubLink: varchar("github_link", { length: 2048 }).notNull(),
    linkedInLink: varchar("linkedin_link", { length: 2048 }).notNull(),
    devpostLink: varchar("devpost_link", { length: 255 }).notNull(),
    resumeLink: varchar("resume_link", { length: 2048 }),
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

    // Optional demographic questions
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

    // Emergency Contact Info
    emergencyContactName: varchar("emergency_contact_name", { length: 255 }),
    emergencyContactRelationship: emergencyContactRelationship(
      "emergency_contact_relationship",
    ),
    emergencyContactPhoneNumber: varchar("emergency_contact_phone_number", {
      length: 42,
    }),

    transportationMethod: transportationMethod("transportation_method"),
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

/**
 * Day-of check-in record created by an organizer after verifying a hacker's ID at the door.
 * Separate from the application so check-in state doesn't pollute the pre-event record.
 */
export const dayOfRegistrations = pgTable("day_of_registration", {
  userId: varchar("user_id", { length: 255 })
    .notNull()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  approved: boolean("approved").default(false).notNull(),
  signedInAt: timestamp("signed_in_at", {
    mode: "date",
    precision: 3,
  }),
  dateOfBirth: timestamp("date_of_birth", {
    mode: "date",
  }),
});

export const dayOfRegistrationsRelations = relations(
  dayOfRegistrations,
  ({ one }) => ({
    user: one(users, {
      fields: [dayOfRegistrations.userId],
      references: [users.id],
    }),
  }),
);

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

// ---------------------------------------------------------------------------
// Judging portal
// ---------------------------------------------------------------------------

export const judges = pgTable("judge", {
  id: varchar("id", { length: 255 })
    .notNull()
    .primaryKey()
    .references(() => users.id),
  type: judgeTypeEnum("type").default("organizer").notNull(),
  track: trackEnum("track").array(), // array of tracks for sponsored judges

  // Derived stats used for score normalization
  // markCount = n, markSum = S, markSquaredSum = S2
  // σ = √( (S2 / n) − (S / n)² )
  marksCount: integer("marks_count").default(0).notNull(),
  marksSum: real("marks_sum").default(0).notNull(),
  marksSquaredSum: real("marks_squared_sum").default(0).notNull(),
});

export const judgesRelations = relations(judges, ({ one, many }) => ({
  user: one(users, {
    fields: [judges.id],
    references: [users.id],
  }),
  marks: many(teamMarks),
  skips: many(judgingSkips),
}));

export const judgingQueue = pgTable(
  "judging_queue",
  {
    teamId: varchar("team_id", { length: 255 })
      .notNull()
      .primaryKey()
      .references(() => teams.id, { onDelete: "cascade" }),
    seenJudges: integer("seen_judges").default(0).notNull(),
    roundsRemaining: integer("rounds_remaining").default(0).notNull(),
    enqueuedAt: timestamp("enqueued_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
    status: judgingQueueStatusEnum("status").default("waiting").notNull(),
    // The judge currently holding this team (sequential, one judge at a
    // time). NULL when the team is waiting. `assignedAt` is stamped on
    // assignment and used to reclaim teams abandoned by a judge who walked
    // away (see STALE_ASSIGNMENT_MINUTES in the queue helpers).
    currentJudgeId: varchar("current_judge_id", { length: 255 }).references(
      () => judges.id,
    ),
    assignedAt: timestamp("assigned_at", { mode: "date", precision: 3 }),
  },
  (t) => [
    index("judging_queue_priority_idx").on(
      t.roundsRemaining.desc(),
      t.enqueuedAt.asc(),
    ),
    index("judging_queue_current_judge_idx").on(t.currentJudgeId),
  ],
);

export const teamMarks = pgTable(
  "team_mark",
  {
    id: serial("id").primaryKey(),
    teamId: varchar("team_id", { length: 255 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    judgeId: varchar("judge_id", { length: 255 })
      .notNull()
      .references(() => judges.id),
    score: real("score").notNull(),
    roundType: roundTypeEnum("round_type").default("regular").notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("team_mark_team_idx").on(t.teamId),
    index("team_mark_judge_idx").on(t.judgeId),
  ],
);

export const teamMarksRelations = relations(teamMarks, ({ one }) => ({
  team: one(teams, {
    fields: [teamMarks.teamId],
    references: [teams.id],
  }),
  judge: one(judges, {
    fields: [teamMarks.judgeId],
    references: [judges.id],
  }),
}));

export const judgingSkips = pgTable(
  "judging_skip",
  {
    teamId: varchar("team_id", { length: 255 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    judgeId: varchar("judge_id", { length: 255 })
      .notNull()
      .references(() => judges.id),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.judgeId] })],
);

export const judgingSkipsRelations = relations(judgingSkips, ({ one }) => ({
  team: one(teams, {
    fields: [judgingSkips.teamId],
    references: [teams.id],
  }),
  judge: one(judges, {
    fields: [judgingSkips.judgeId],
    references: [judges.id],
  }),
}));

export const teamsRelations = relations(teams, ({ many, one }) => ({
  members: many(users),
  marks: many(teamMarks),
  skips: many(judgingSkips),
  checkResults: many(teamCheckResults),
}));

// ---------------------------------------------------------------------------
// Cheat check results
// ---------------------------------------------------------------------------

/**
 * Cached results for per-hacker cheat checks (isOfAge, isRegistered, isApproved).
 * Upserted on (userId, checkType) — re-running a check overwrites the previous result.
 * `details` is a typed JSONB blob specific to each check type.
 */
export const hackerCheckResults = pgTable(
  "hacker_check_result",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    checkType: hackerCheckType("check_type").notNull(),
    passed: boolean("passed").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull(),
    checkedAt: timestamp("checked_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
    checkedByUserId: varchar("checked_by_user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    manualOverride: boolean("manual_override"),
    notes: text("notes"),
  },
  (t) => [
    index("hacker_check_user_idx").on(t.userId),
    uniqueIndex("hacker_check_unique_idx").on(t.userId, t.checkType),
  ],
);

export const hackerCheckResultsRelations = relations(
  hackerCheckResults,
  ({ one }) => ({
    user: one(users, {
      relationName: "hacker_check_hacker",
      fields: [hackerCheckResults.userId],
      references: [users.id],
    }),
    checkedBy: one(users, {
      relationName: "hacker_check_reviewer",
      fields: [hackerCheckResults.checkedByUserId],
      references: [users.id],
    }),
  }),
);

/**
 * Cached results for per-team cheat checks (commit timing, contributors, DevPost, cross-post).
 * Upserted on (teamId, checkType).
 */
export const teamCheckResults = pgTable(
  "team_check_result",
  {
    id: serial("id").primaryKey(),
    teamId: varchar("team_id", { length: 255 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    checkType: teamCheckType("check_type").notNull(),
    passed: boolean("passed").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull(),
    checkedAt: timestamp("checked_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
    checkedByUserId: varchar("checked_by_user_id", { length: 255 })
      .notNull()
      .references(() => users.id),
    manualOverride: boolean("manual_override"),
    notes: text("notes"),
  },
  (t) => [
    index("team_check_team_idx").on(t.teamId),
    uniqueIndex("team_check_unique_idx").on(t.teamId, t.checkType),
  ],
);

export const teamCheckResultsRelations = relations(
  teamCheckResults,
  ({ one }) => ({
    team: one(teams, {
      fields: [teamCheckResults.teamId],
      references: [teams.id],
    }),
    checkedBy: one(users, {
      fields: [teamCheckResults.checkedByUserId],
      references: [users.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Scavenger hunt
// ---------------------------------------------------------------------------

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
