import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
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
  uuid,
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
 * The realm each hacker's horse companion belongs to, chosen during the
 * application flow. Drives themed visuals across the portal.
 */
export const realm = pgEnum("realm", ["safari", "mountain", "desert", "ocean"]);

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
  "Other",
]);

/**
 * T-Shirt size for the applicant
 */
export const shirtSize = pgEnum("shirt_size", ["S", "M", "L", "XL"]);

export const dietaryRestrictions = pgEnum("dietary_restrictions", [
  "None",
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

export const roundTypeEnum = pgEnum("round_type", ["regular", "sponsored"]);

/**
 * Where one stop on a judge's list stands. `assigned` -> `in_progress` ->
 * `done` (score submitted) or `team_absent` (nobody at the table).
 * `cancelled` is an organizer removing the stop before it happened.
 */
export const judgingAssignmentStatusEnum = pgEnum("judging_assignment_status", [
  "assigned",
  "in_progress",
  "done",
  "team_absent",
  "cancelled",
]);

/**
 * Live judging state of a physical table, for the table map. `empty`: no
 * team seated. `waiting`: team seated with stops still to come (or none yet).
 * `being_judged`: a judge is there now. `finished`: every stop is done,
 * absent or cancelled. Kept in sync by triggers (see triggers.sql).
 * Switched-off tables use `judging_table.is_active`.
 */
export const judgingTableStatusEnum = pgEnum("judging_table_status", [
  "empty",
  "waiting",
  "being_judged",
  "finished",
]);

/**
 * The lifecycle of an automated cheat-check sweep across every eligible team.
 */
export const cheatSweepStatusEnum = pgEnum("cheat_sweep_status", [
  "running",
  "completed",
  "failed",
]);

/**
 * What caused a sweep to start: judging finishing (every stop closed), or an
 * organizer kicking one off by hand.
 */
export const cheatSweepTriggerEnum = pgEnum("cheat_sweep_trigger", [
  "judging_complete",
  "manual",
]);

/**
 * The state of a single team's slot in a sweep's work list.
 */
export const cheatSweepItemStatusEnum = pgEnum("cheat_sweep_item_status", [
  "pending",
  "running",
  "done",
  "failed",
]);

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
 * One note from the Devpost import about a team's members (`team.import_flags`).
 * - not_hacker: one per team, listing every entered ID that matches no hacker
 *   (a typo or a well-formed ID nobody has). If the team entered no IDs at
 *   all, `members` holds the Devpost names instead.
 * - duplicate: the hacker is listed on more than one project; they're linked
 *   to the earliest-submitted one (`linkedHere`)
 * - incorrect_team_size: more than 4 hackers matched (`matched` = how many)
 */
export type ImportFlag =
  | {
      reason: "duplicate";
      rawId: string;
      name: string | null;
      otherProjects: string[];
      linkedHere: boolean;
    }
  | { reason: "not_hacker"; members: string[] }
  | { reason: "incorrect_team_size"; matched: number };

/**
 * The table for storing hacker teams formed during the event.
 * Also serves as the project submission record (devpostUrl, githubUrl, submissionStatus).
 */
export const teams = pgTable(
  "team",
  {
    id: varchar("id", { length: 12 }).notNull().primaryKey(),
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
    techStack: text("tech_stack").array(),

    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
    joinCode: varchar("joinCode", { length: 6 }).notNull().unique(),
    // The physical table the team is seated at for judging. One team per table.
    judgingTableId: integer("judging_table_id")
      .unique()
      .references(() => judgingTables.id, { onDelete: "set null" }),
    // Set by the Devpost import when a member's hacker ID didn't match
    // cleanly; null when every member matched. Notes only: flagged teams are
    // still seated and judged.
    importFlags: jsonb("import_flags").$type<ImportFlag[]>(),
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
  // Nullable: pre-existing rows have no token (their confirmation already sent);
  // new signups generate one so the updates email can carry an unsubscribe link.
  unsubscribeToken: varchar("unsubscribe_token", { length: 64 }).unique(),
  unsubscribedAt: timestamp("unsubscribed_at", { mode: "date", precision: 3 }),
  bouncedAt: timestamp("bounced_at", { mode: "date", precision: 3 }),
});

export const emailSubscribers = pgTable("email_subscriber", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).unique().notNull(),
  source: varchar("source", { length: 16 }).notNull(), // 'hw11' | 'hw12'
  unsubscribeToken: varchar("unsubscribe_token", { length: 64 })
    .unique()
    .notNull(),
  unsubscribedAt: timestamp("unsubscribed_at", { mode: "date", precision: 3 }),
  bouncedAt: timestamp("bounced_at", { mode: "date", precision: 3 }),
  lastSentAt: timestamp("last_sent_at", { mode: "date", precision: 3 }),
  createdAt: timestamp("created_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
});

/**
 * `judge` is for public/guest judges: limited accounts that only judge, as
 * opposed to organizers. Being in the `judge` table is separate from this;
 * organizer accounts can be judges too.
 */
export const userType = pgEnum("user_type", [
  "hacker",
  "organizer",
  "sponsor",
  "judge",
]);

// Sponsor judging: maps a private UUID (handed to a sponsor as their URL) to
// the sponsor's name as spelled on the Sponsor Day-Of tab. The judging Google Sheet
// itself keeps storing the name in column A; the UUID never appears there.
export const sponsorJudgingSponsors = pgTable("sponsor_judging_sponsor", {
  id: uuid("id").defaultRandom().notNull().primaryKey(),
  // Must match the "Sponsor Name" spelling on the Sponsor Day-Of tab, since this is
  // what the judging sheet rows are keyed on.
  name: varchar("name", { length: 255 }).notNull().unique(),
  // v1 rep count; no longer read (v2 uses coffee_chat_style/per_slot).
  coffeeChatReps: smallint("coffee_chat_reps").default(1).notNull(),
  // The sponsor's coffee chat request (src/lib/coffee-chat-request.ts):
  // "oneOnOne" (per_slot = reps) or "group" (per_slot = group size). Both
  // null = not answered yet; then the Coffee Chats sheet row applies.
  coffeeChatStyle: varchar("coffee_chat_style", { length: 16 }),
  coffeeChatPerSlot: smallint("coffee_chat_per_slot"),
  // Saturday coffee chat room ("Rm 2241"-"Rm 2243"), set by organizers on
  // /internal/sponsor-schedule. Null = unassigned; then the Coffee Chats
  // sheet's ROOM value (if any) applies.
  coffeeChatRoom: varchar("coffee_chat_room", { length: 64 }),
  // Who on the sponsor team watches this sponsor's coffee chats (and so
  // that room). Free-text name set by organizers; sponsors see it as their
  // Hack Western contact for chats. Null = nobody yet.
  coffeeChatWatcher: varchar("coffee_chat_watcher", { length: 255 }),
  // When an organizer marked the sponsor's private portal link as handed
  // over (Friday, on /internal/sponsors). Null = not given yet.
  portalLinkGivenAt: timestamp("portal_link_given_at", {
    mode: "date",
    precision: 3,
  }),
  createdAt: timestamp("created_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
});

export const coffeeChatStatusEnum = pgEnum("coffee_chat_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
  // An organizer called it off (Cancel on /internal/sponsor-schedule).
  "cancelled",
]);

// A sponsor's coffee chat request to one hacker, in one room at one
// Saturday slot. The DB is the source of truth; the Coffee Chats sheet tab
// is a one-way mirror. See src/lib/coffee-chat-requests.ts for the rules.
export const coffeeChats = pgTable(
  "coffee_chat",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Room label as written in the sponsor's Coffee Chats sheet row (e.g.
    // "Rm 2241"), copied when the chat is offered; null until organizers
    // assign one. Organizers can move a chat with Move room. A sponsor's reps
    // run several chats at once in the same room.
    room: varchar("room", { length: 64 }),
    // Saturday start time "HH:MM" on the 15-minute grid, and length (15 or
    // 30, from the sponsor's FORMAT in the Coffee Chats sheet tab). A 30-min
    // chat blocks the hacker for two grid slots; overlap is checked when the
    // request is made (the unique index below only catches equal starts).
    slotTime: varchar("slot_time", { length: 5 }).notNull(),
    durationMinutes: smallint("duration_minutes").default(15).notNull(),
    status: coffeeChatStatusEnum("status").default("pending").notNull(),
    repName: varchar("rep_name", { length: 255 }),
    // Session model invites (track B): the rep-session this seat belongs
    // to; null = an old per-slot request.
    placementId: uuid("placement_id").references(
      () => coffeeChatPlacements.id,
      { onDelete: "cascade" },
    ),
    // A hacker invited to an organizer's room booking ("Book an event"):
    // the booking it belongs to. Null for every other chat. Removing the
    // booking cancels its live chats first (the link is then cleared).
    bookingId: uuid("booking_id").references(() => coffeeChatRoomBookings.id, {
      onDelete: "set null",
    }),
    // Invite round: 1 = Fri 10:00 PM batch, 2+ = Saturday 30-minute rounds.
    round: smallint("round"),
    // Pending invites expire at this time and the seat passes on.
    expiresAt: timestamp("expires_at", { mode: "date", precision: 3 }),
    // Why they were invited: "scanned" | "shortlist" | "interested".
    source: varchar("source", { length: 16 }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
    respondedAt: timestamp("responded_at", { mode: "date", precision: 3 }),
    // Session invites: when the DM or email about the current invite went
    // out. Null = not sent yet (or a send failed); the delivery sweep in
    // src/server/api/utils/coffee-chat-invites.ts claims and sends those.
    notifiedAt: timestamp("notified_at", { mode: "date", precision: 3 }),
  },
  (t) => [
    // A hacker can't hold two live (pending or accepted) chats in one slot.
    uniqueIndex("coffee_chat_user_slot_active_idx")
      .on(t.userId, t.slotTime)
      .where(sql`${t.status} in ('pending', 'accepted')`),
    index("coffee_chat_sponsor_slot_idx").on(t.sponsorId, t.slotTime),
    index("coffee_chat_user_idx").on(t.userId),
    index("coffee_chat_placement_idx").on(t.placementId),
    index("coffee_chat_booking_idx").on(t.bookingId),
  ],
);

// The Slack reminder DM'd to a hacker 15 minutes before an accepted coffee
// chat (src/server/api/utils/coffee-chat-reminder.ts). One row per chat.
// No foreign key on purpose: a chat deleted with its placement leaves its
// row, so the next sync can still delete the scheduled message in Slack.
export const coffeeChatReminders = pgTable("coffee_chat_reminder", {
  chatId: uuid("chat_id").notNull().primaryKey(),
  // The hacker's DM channel (conversations.open).
  slackChannel: varchar("slack_channel", { length: 32 }).notNull(),
  // chat.scheduleMessage's scheduled_message_id, or chat.postMessage's ts
  // when it was sent at once. Empty while a send-now is in flight.
  messageId: varchar("message_id", { length: 64 }).notNull(),
  // "scheduled" (Slack posts it at post_at) or "sent" (posted at once).
  kind: varchar("kind", { length: 16 }).notNull(),
  postAt: timestamp("post_at", { mode: "date", precision: 3 }).notNull(),
  // sha256 of what the reminder says (start, length, sponsor, room,
  // group): a change reschedules it.
  contentKey: varchar("content_key", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
});

// A Slack DM to a sponsor's HW lead before one of the sponsor's action
// items (their workshop, a coffee chat, a due step), kept in sync by
// src/server/slack/sponsor-lead-pings.ts. One row per sponsor + item +
// lead. No foreign key on purpose: a row outlives its placement, so the
// next sync can still delete the scheduled message in Slack.
export const sponsorLeadPings = pgTable("sponsor_lead_ping", {
  // "<sponsorId>:<item>:<lead email>"
  key: varchar("key", { length: 255 }).notNull().primaryKey(),
  sponsorId: uuid("sponsor_id").notNull(),
  slackChannel: varchar("slack_channel", { length: 32 }).notNull(),
  // chat.scheduleMessage's scheduled_message_id, or chat.postMessage's ts
  // when it was sent at once. Empty while a send-now is in flight.
  messageId: varchar("message_id", { length: 64 }).notNull(),
  // "scheduled" (Slack posts it at post_at) or "sent" (posted at once).
  kind: varchar("kind", { length: 16 }).notNull(),
  postAt: timestamp("post_at", { mode: "date", precision: 3 }).notNull(),
  // sha256 of what the ping says: a change reschedules it.
  contentKey: varchar("content_key", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
});

// An organizer's room hold: a coffee chat room set aside for one sponsor at
// one Saturday time, before any hacker is booked ("Needs a hacker"). A room
// can be held by different sponsors at different times; the server refuses
// a hold or chat from another sponsor in the same room at an overlapping
// time. Chats the sponsor offers inside the hold take its room. See
// src/lib/coffee-chat-holds.ts and docs/decisions.md (2026-11-17).
export const coffeeChatHolds = pgTable(
  "coffee_chat_hold",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    // One of the coffee chat rooms ("Rm 2241"-"Rm 2243").
    room: varchar("room", { length: 64 }).notNull(),
    // Saturday "HH:MM" on the 15-minute grid; end is exclusive.
    startTime: varchar("start_time", { length: 5 }).notNull(),
    endTime: varchar("end_time", { length: 5 }).notNull(),
    note: varchar("note", { length: 255 }),
    createdBy: varchar("created_by", { length: 255 }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("coffee_chat_hold_sponsor_idx").on(t.sponsorId),
    index("coffee_chat_hold_room_idx").on(t.room, t.startTime),
  ],
);

// A sponsor's "Ask for fewer": at most `hackers` per coffee chat slot
// starting from start_time (inclusive) to end_time (exclusive), e.g. a rep
// leaves at 11. 0 = no chat then. The lowest ask covering a slot wins. See
// src/lib/coffee-chat-request.ts.
export const coffeeChatLimits = pgTable(
  "coffee_chat_limit",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    startTime: varchar("start_time", { length: 5 }).notNull(),
    endTime: varchar("end_time", { length: 5 }).notNull(),
    hackers: smallint("hackers").notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("coffee_chat_limit_span_idx").on(
      t.sponsorId,
      t.startTime,
      t.endTime,
    ),
  ],
);

// Coffee chat sessions (docs/specs/coffee-chat-sessions.md): a sponsor's
// chatting preferences. One row per sponsor; submittedAt null = not
// submitted yet (organizers see "Not submitted" and can't schedule them).
export const coffeeChatPrefs = pgTable(
  "coffee_chat_pref",
  {
    sponsorId: uuid("sponsor_id")
      .notNull()
      .primaryKey()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    hackersPerChat: smallint("hackers_per_chat").default(1).notNull(),
    // 1-on-1s only: 30 minutes instead of 15.
    longerOneOnOne: boolean("longer_one_on_one").default(false).notNull(),
    submittedAt: timestamp("submitted_at", { mode: "date", precision: 3 }),
    // The separate Shortlist flow's Review & submit; null = not submitted
    // (at 10:00 PM Friday interested hackers fill their seats instead).
    shortlistSubmittedAt: timestamp("shortlist_submitted_at", {
      mode: "date",
      precision: 3,
    }),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    check(
      "coffee_chat_pref_hackers_check",
      sql`${t.hackersPerChat} between 1 and 5`,
    ),
  ],
);

// A sponsor's named rep for coffee chats. Exactly one primary contact (the
// crown) per sponsor; every rep has a phone (no email is collected). Each
// rep says how many chats they want; the sessions that needs follow from
// the sponsor's chat length (src/lib/coffee-chat-sessions.ts).
export const coffeeChatReps = pgTable(
  "coffee_chat_rep",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    // 0 = this rep doesn't chat (decisions 2026-11-19, Q1–Q11).
    chatsWanted: smallint("chats_wanted").default(1).notNull(),
    // Organizer cap in sessions from a "fewer chats" suggested fix; null =
    // what their chats need.
    maxSessions: smallint("max_sessions"),
    // Order the sponsor listed them in.
    position: smallint("position").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("coffee_chat_rep_sponsor_idx").on(t.sponsorId),
    check("coffee_chat_rep_chats_check", sql`${t.chatsWanted} >= 0`),
    uniqueIndex("coffee_chat_rep_primary_idx")
      .on(t.sponsorId)
      .where(sql`${t.isPrimary}`),
  ],
);

// The 1-hour sessions a rep ticked as free (session ids from
// src/lib/coffee-chat-sessions.ts: "10", "11", "13"-"16").
export const coffeeChatRepSessions = pgTable(
  "coffee_chat_rep_session",
  {
    repId: uuid("rep_id")
      .notNull()
      .references(() => coffeeChatReps.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 4 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.repId, t.sessionId] })],
);

export const coffeeChatPlacementStatusEnum = pgEnum(
  "coffee_chat_placement_status",
  ["draft", "sent"],
);

// One rep in one room for one session, from Auto-schedule or an organizer.
// Draft until Send; pinned = an organizer placed it (move, applied fix) and
// re-running Auto-schedule keeps it. A room holds one thing per session
// (also checked against room bookings in the router).
export const coffeeChatPlacements = pgTable(
  "coffee_chat_placement",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    repId: uuid("rep_id")
      .notNull()
      .references(() => coffeeChatReps.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 4 }).notNull(),
    room: varchar("room", { length: 8 }).notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    // Moved by hand to a session the rep didn't tick as free, after an
    // organizer contacted them (coffee board v12). Never flagged as a fix
    // for that; Auto-schedule keeps it. A normal move clears it.
    forced: boolean("forced").default(false).notNull(),
    status: coffeeChatPlacementStatusEnum("status").default("draft").notNull(),
    sentAt: timestamp("sent_at", { mode: "date", precision: 3 }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("coffee_chat_placement_room_idx").on(t.room, t.sessionId),
    uniqueIndex("coffee_chat_placement_rep_idx").on(t.repId, t.sessionId),
  ],
);

// An organizer's ad hoc room booking on the coffee chat board (e.g. a
// sponsor who wants a room last minute, or mentors). forSponsorId null =
// for organizers or someone else, named in `label`.
export const coffeeChatRoomBookings = pgTable(
  "coffee_chat_room_booking",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    sessionId: varchar("session_id", { length: 4 }).notNull(),
    room: varchar("room", { length: 8 }).notNull(),
    forSponsorId: uuid("for_sponsor_id").references(
      () => sponsorJudgingSponsors.id,
      { onDelete: "set null" },
    ),
    // What it's for (Book an event's Description; older rows: who it's for).
    label: varchar("label", { length: 255 }).notNull(),
    note: varchar("note", { length: 255 }),
    // Who on the sponsorship team booked it (an HW Contacts name). Null on
    // rows from before Book an event asked.
    bookedBy: varchar("booked_by", { length: 255 }),
    // The sponsor's reps in it (any number, maybe none). Their chats
    // elsewhere in this session are refused.
    repIds: uuid("rep_ids").array(),
    createdBy: varchar("created_by", { length: 255 }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("coffee_chat_room_booking_cell_idx").on(t.room, t.sessionId),
  ],
);

// Organizer edits to one sponsor's line of hackers for coffee chat seats
// (coffee board v12). kind "front": put first in line, newest first, ahead
// of booth, shortlist and interested hackers. kind "removed": an organizer
// took them off one of this sponsor's chats, so they're never offered this
// sponsor again (like a decline). One row per (sponsor, hacker).
export const coffeeChatLine = pgTable(
  "coffee_chat_line",
  {
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 8 }).$type<"front" | "removed">().notNull(),
    addedBy: varchar("added_by", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.sponsorId, t.userId] })],
);

// A hacker's interest ranking of the sponsors (1 = most interested). Feeds each
// sponsor's coffee-chat shortlist. One row per (hacker, sponsor), and a hacker
// can't give two sponsors the same rank.
export const sponsorInterests = pgTable(
  "sponsor_interest",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    rank: smallint("rank").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.sponsorId] }),
    uniqueIndex("sponsor_interest_user_rank_idx").on(t.userId, t.rank),
    index("sponsor_interest_sponsor_idx").on(t.sponsorId),
  ],
);

// A sponsor's coffee chat shortlist: hackers they picked from their
// "Interested hackers" list on /sponsors/[uuid]/coffee-chats. Organizers
// use it to set up chats. Only admitted hackers who agreed to share with
// sponsors and ranked this sponsor can be added (sponsorShortlist router).
export const sponsorShortlists = pgTable(
  "sponsor_shortlist",
  {
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.sponsorId, t.userId] })],
);

// A hacker a sponsor scanned at the Sponsor Bay ("Met at Hacker Fair").
// Scanned hackers are first choice for that sponsor's coffee chat seats,
// before the shortlist and interested hackers (decisions 2026-11-19).
export const sponsorScans = pgTable(
  "sponsor_scan",
  {
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The rep who scanned them, if picked.
    repName: varchar("rep_name", { length: 255 }),
    scannedAt: timestamp("scanned_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sponsorId, t.userId] }),
    index("sponsor_scan_user_idx").on(t.userId),
  ],
);

// A sponsor's review of one submitted team on /sponsors/[uuid]/picks
// ("Judging"): a 1-10 score, whether it's on their shortlist, and a short
// private note. One row per (sponsor, team), written by autosave. Only teams
// the sponsor can see (submitted, in their track) can be reviewed; see the
// sponsorScoring router and docs/decisions.md (2026-11-18).
export const sponsorTeamReviews = pgTable(
  "sponsor_team_review",
  {
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    teamId: varchar("team_id", { length: 12 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    // 1-10, null = not scored yet.
    score: smallint("score"),
    shortlisted: boolean("shortlisted").default(false).notNull(),
    note: varchar("note", { length: 280 }),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sponsorId, t.teamId] }),
    index("sponsor_team_review_team_idx").on(t.teamId),
    check(
      "sponsor_team_review_score_range",
      sql`${t.score} IS NULL OR (${t.score} BETWEEN 1 AND 10)`,
    ),
  ],
);

// One rep's score for one team ("Who's judging?"): several reps share a
// sponsor login, each scores separately, 1-10 in half points. Stored as
// halves (2-20) so it stays an integer. Track F, docs/decisions.md.
export const sponsorTeamScores = pgTable(
  "sponsor_team_score",
  {
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    teamId: varchar("team_id", { length: 12 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    judgeName: varchar("judge_name", { length: 255 }).notNull(),
    scoreHalves: smallint("score_halves").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sponsorId, t.teamId, t.judgeName] }),
    check("sponsor_team_score_range", sql`${t.scoreHalves} BETWEEN 2 AND 20`),
  ],
);

// A sponsor's submitted final ranking: exactly SPONSOR_FINAL_TOP team ids,
// best first (src/lib/sponsor-scoring.ts). Resubmitting replaces it. The
// same ids are also written to the judging sheet (Lucas's picks column);
// sheetSyncedAt is null while that write hasn't succeeded.
export const sponsorFinalPicks = pgTable("sponsor_final_pick", {
  sponsorId: uuid("sponsor_id")
    .primaryKey()
    .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
  teamIds: varchar("team_ids", { length: 12 }).array().notNull(),
  submittedAt: timestamp("submitted_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
  sheetSyncedAt: timestamp("sheet_synced_at", { mode: "date", precision: 3 }),
});

// Unsubmitted Top 5 progress. Null slots are represented by empty strings
// so the five-place order stays stable while a sponsor is choosing teams.
export const sponsorTop5Drafts = pgTable("sponsor_top5_draft", {
  sponsorId: uuid("sponsor_id")
    .primaryKey()
    .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
  teamIds: varchar("team_ids", { length: 12 }).array().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
});

// The shortlist a sponsor sent at the end of round 1: a snapshot of the
// shortlisted team ids, so later shortlist edits don't move the schedule
// until the sponsor sends again. Sending again replaces it
// (docs/flows/sponsor-judging.md).
export const sponsorShortlistSends = pgTable("sponsor_shortlist_send", {
  sponsorId: uuid("sponsor_id")
    .primaryKey()
    .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
  teamIds: varchar("team_ids", { length: 12 }).array().notNull(),
  sentAt: timestamp("sent_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
});

// The Sunday presentation schedule (src/lib/sponsor-presentations.ts): one
// row per (sponsor, sent-shortlist team). startMinute is minutes after
// midnight Eastern on judging day; null = couldn't fit (room set) or the
// sponsor had no room (room null). "Schedule presentations" replaces every
// row; who was told which times lives in sponsor_presentation_notice.
export const sponsorPresentations = pgTable(
  "sponsor_presentation",
  {
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    teamId: varchar("team_id", { length: 12 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    room: varchar("room", { length: 64 }),
    startMinute: smallint("start_minute"),
    scheduledAt: timestamp("scheduled_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sponsorId, t.teamId] }),
    index("sponsor_presentation_team_idx").on(t.teamId),
  ],
);

// One row per team member DM'd or emailed (or tried) about presentations.
// A notify claims the row atomically (status "sending") before sending, so
// a double click or retry can't message twice. A member Slack can't find
// is emailed instead (status "emailed"). slotsKey (slotsKey() in
// src/lib/sponsor-presentations.ts) is the set of times the member was
// sent: a member is up to date while it matches their team's slots, so
// rescheduling a team without changing its times keeps them notified.
export const sponsorPresentationNotices = pgTable(
  "sponsor_presentation_notice",
  {
    userId: varchar("user_id", { length: 255 })
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: varchar("team_id", { length: 12 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    // "sending" | "sent" (Slack) | "emailed" | "not-found" | "failed"
    status: varchar("status", { length: 16 }).notNull(),
    slotsKey: text("slots_key").notNull(),
    claimedAt: timestamp("claimed_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
    /** Last successful DM or email; null = never reached. */
    sentAt: timestamp("sent_at", { mode: "date", precision: 3 }),
  },
  (t) => [index("sponsor_presentation_notice_team_idx").on(t.teamId)],
);

// A sponsor's Sunday judging room as set by an organizer on the Judging
// board (room select or "Move to"). Wins over the sheets' room
// (judgingRoomsById). A room holds one sponsor, so `room` is unique; a swap
// rewrites both rows in one transaction. Remote sponsors never get a row.
export const sponsorJudgingRooms = pgTable(
  "sponsor_judging_room",
  {
    sponsorId: uuid("sponsor_id")
      .primaryKey()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    room: varchar("room", { length: 64 }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("sponsor_judging_room_room_idx").on(t.room)],
);

// A team accepted its presentation times (Jazz, 2026-11-19): one member
// tapped Confirm on the Slack DM or on /live, which covers the whole team.
// slotsKey is the team's times when they confirmed; new times (a room
// change) need a new confirm, so the board shows Waiting again.
export const sponsorPresentationConfirms = pgTable(
  "sponsor_presentation_confirm",
  {
    teamId: varchar("team_id", { length: 12 })
      .primaryKey()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 255 }).references(() => users.id, {
      onDelete: "set null",
    }),
    // "slack" | "live"
    via: varchar("via", { length: 8 }).notNull(),
    slotsKey: text("slots_key").notNull(),
    confirmedAt: timestamp("confirmed_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
);

// Sunday judging switches organizers flip (docs/flows/sponsor-judging.md).
// One row (id 1). round2OpenedAt set = round 2 is open: sponsors with a
// presentation slot rank the teams that presented and submit a top 5.
export const sponsorJudgingSettings = pgTable(
  "sponsor_judging_setting",
  {
    id: smallint("id").primaryKey().default(1),
    round2OpenedAt: timestamp("round2_opened_at", {
      mode: "date",
      precision: 3,
    }),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [check("sponsor_judging_setting_single_row", sql`${t.id} = 1`)],
);

export const sponsorHelpStatusEnum = pgEnum("sponsor_help_status", [
  "open",
  "claimed",
  "resolved",
  "cancelled",
]);

// A sponsor's "Need help" request. Posted to the sponsor team's Slack
// channel; the first reaction or thread reply claims it. Rules in
// src/lib/sponsor-help.ts, runbook docs/runbooks/slack-sponsor-help.md.
export const sponsorHelpRequests = pgTable(
  "sponsor_help_request",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsorJudgingSponsors.id, { onDelete: "cascade" }),
    // One of SPONSOR_HELP_REASONS (varchar so the list can change without a
    // migration).
    reason: varchar("reason", { length: 32 }).notNull(),
    note: varchar("note", { length: 500 }),
    // Booth location from the sponsor info sheet when the request was made,
    // shown in the Slack post. Null when the sheet had none.
    location: varchar("location", { length: 255 }),
    // Who to find and call, typed by the sponsor (0042). Required by the
    // router for new requests; nullable so rows from before 0042 stay valid.
    repName: varchar("rep_name", { length: 80 }),
    phone: varchar("phone", { length: 32 }),
    // Where they are right now, if they said. Slack falls back to `location`.
    locationNote: varchar("location_note", { length: 120 }),
    status: sponsorHelpStatusEnum("status").default("open").notNull(),
    // The bot's Slack post; null when Slack is off or the post failed.
    slackChannel: varchar("slack_channel", { length: 64 }),
    slackTs: varchar("slack_ts", { length: 32 }),
    claimedBySlackId: varchar("claimed_by_slack_id", { length: 64 }),
    claimedByName: varchar("claimed_by_name", { length: 255 }),
    // Re-pings sent in the Slack thread (0-2), see SPONSOR_HELP_REPING_MINUTES.
    pingCount: smallint("ping_count").default(0).notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
    claimedAt: timestamp("claimed_at", { mode: "date", precision: 3 }),
    // When it was resolved or cancelled.
    resolvedAt: timestamp("resolved_at", { mode: "date", precision: 3 }),
  },
  (t) => [
    // One live (open or claimed) request per sponsor.
    uniqueIndex("sponsor_help_request_sponsor_active_idx")
      .on(t.sponsorId)
      .where(sql`${t.status} in ('open', 'claimed')`),
    index("sponsor_help_request_slack_idx").on(t.slackChannel, t.slackTs),
    index("sponsor_help_request_status_idx").on(t.status),
  ],
);

export const users = pgTable(
  "user",
  {
    id: varchar("id", { length: 255 }).notNull().primaryKey(),
    name: varchar("name", { length: 255 }),
    password: varchar("password", { length: 255 }),
    // Stored canonical (trim+lowercase) — every read/write goes through
    // normalizeAuthEmail. The unique constraint is the backstop: HW12 shipped
    // without it and 7 people ended up with two accounts each.
    email: varchar("email", { length: 255 }).notNull().unique(),
    emailVerified: timestamp("emailVerified", {
      mode: "date",
    }).default(sql`CURRENT_TIMESTAMP`),
    image: varchar("image", { length: 255 }),
    type: userType("type").default("hacker"),

    teamId: varchar("team_id", { length: 255 }).references(() => teams.id, {
      onDelete: "set null",
    }),

    // Public, human-readable ID (e.g. "brave-otter-kite"). Printed under the
    // hacker's QR and typed into Devpost; user.id stays internal.
    hackerId: varchar("hacker_id", { length: 64 }).unique(),

    // Live-site checklist steps the hacker has done that we can't derive from
    // their application: "slack", "devpost", "wallet", "hide-checklist"
    // (see src/lib/onboarding.ts).
    onboardingSteps: text("onboarding_steps")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    // The email a hacker says their Slack account is on, set on /live when
    // it isn't their account email. Slack lookups try it first, then
    // `email`; email notices always go to `email` (src/lib/slack-email.ts).
    slackEmail: varchar("slack_email", { length: 255 }),
    // Keys of the /live notification center notices the hacker has seen
    // (src/lib/hacker-notifications.ts). A notice's key changes when its
    // status, time or room does, so a change shows as unread again.
    notificationsSeen: text("notifications_seen")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    scavengerHuntEarned: integer("scavenger_hunt_earned").default(0),
    scavengerHuntBalance: integer("scavenger_hunt_balance").default(0),

    // When the account was made, for stats. Accounts from before this column
    // existed are all stamped 2026-10-03 10:00 ET (see the migration).
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
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

// One row per reminder email sent, so a re-run never emails anyone twice
// (scripts/send-incomplete-reminder.ts).
export const emailReminderSent = pgTable(
  "email_reminder_sent",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 32 }).notNull(),
    sentAt: timestamp("sent_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind] })],
);

// Team finder: one card per hacker, which they choose to show to other
// confirmed hackers (src/server/api/routers/team-finder.ts). Name, school,
// year and horse come from the application at read time; contacts are stored
// already cleaned (src/lib/socials.ts). Deleted after the event (Dec 22).
export const teamFinderCards = pgTable(
  "team_finder_card",
  {
    // What the page and the board use to name a card. Never the user id: that
    // is the hacker pass QR payload.
    id: uuid("id").defaultRandom().notNull().unique(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    shown: boolean("shown").default(false).notNull(),
    // How many more people they want: null = solo, looking for a team to join.
    needs: smallint("needs"),
    skills: text("skills")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    firstHackathon: boolean("first_hackathon").default(false).notNull(),
    lookingFor: varchar("looking_for", { length: 280 }).notNull().default(""),
    idea: varchar("idea", { length: 280 }),
    showSchool: boolean("show_school").default(true).notNull(),
    showYear: boolean("show_year").default(false).notNull(),
    discord: varchar("discord", { length: 100 }),
    instagram: varchar("instagram", { length: 100 }),
    linkedin: varchar("linkedin", { length: 100 }),
    github: varchar("github", { length: 100 }),
    // Only saved when they choose to show it.
    phone: varchar("phone", { length: 32 }),
    // R2 object key; null = show their horse.
    photoKey: varchar("photo_key", { length: 255 }),
    hiddenByOrganizerAt: timestamp("hidden_by_organizer_at", {
      mode: "date",
      precision: 3,
    }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("team_finder_card_shown_idx").on(t.shown)],
);

// One row per report, so a hacker can't send unlimited mail to hello@ and each
// card is reported once per person. Deleted with the reporter or the card.
export const teamFinderReports = pgTable(
  "team_finder_report",
  {
    reporterId: varchar("reporter_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardId: uuid("card_id")
      .notNull()
      .references(() => teamFinderCards.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.reporterId, t.cardId] })],
);

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

    // Horse companion + realm (HW13 redesign). Columns are nullable in the
    // DB (see drizzle/0016_add_realm_and_horse_companion.sql) because
    // applications exist before the realm step is filled out.
    realm: realm("realm"),
    horseId: integer("horse_id"),
    horseFirstName: varchar("horse_first_name", { length: 255 }),
    horseLastName: varchar("horse_last_name", { length: 255 }),

    // About You
    firstName: varchar("first_name", { length: 255 }),
    lastName: varchar("last_name", { length: 255 }),
    age: integer("age"), // 18+
    phoneNumber: varchar("phone_number", { length: 42 }), // Frontend validation
    countryOfResidence: countrySelection("country_of_residence"),

    school: varchar("name", { length: 255 }),
    // What they typed when their school isn't in the list ("Other").
    schoolOther: varchar("school_other", { length: 255 }),
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

    // Emergency Contact Info
    emergencyContactName: varchar("emergency_contact_name", { length: 255 }),
    emergencyContactRelationship: emergencyContactRelationship(
      "emergency_contact_relationship",
    ),
    emergencyContactPhoneNumber: varchar("emergency_contact_phone_number", {
      length: 42,
    }),

    transportationMethod: transportationMethod("transportation_method"),
    // RSVP travel: only asked when transportationMethod is "None" (travelling on their own)
    travelReimbursement: boolean("travel_reimbursement"),
    travelFrom: varchar("travel_from", { length: 255 }),
    // When they confirmed their spot by attesting they're enrolled in a
    // college or university program (the RSVP checkbox). Null = never did.
    enrollmentConfirmedAt: timestamp("enrollment_confirmed_at", {
      mode: "date",
      precision: 3,
    }),

    // OLDER DEPREEACTED FIELDS <can clean up but might be good to keep the forms in the code base>
    avatarColour: avatarColour("avatar_colour"),
    avatarFace: integer("avatar_face"),
    avatarLeftHand: integer("avatar_left_hand"),
    avatarRightHand: integer("avatar_right_hand"),
    avatarHat: integer("avatar_hat"),

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
  noShow: boolean("no_show").default(false).notNull(),

  // Derived stats used for score normalization
  // markCount = n, markSum = S, markSquaredSum = S2
  // σ = √( (S2 / n) − (S / n)² )
  marksCount: integer("marks_count").default(0).notNull(),
  marksSum: real("marks_sum").default(0).notNull(),
  marksSquaredSum: real("marks_squared_sum").default(0).notNull(),
  // Calibration rating for score normalization; null until set.
  harshness: real("harshness"),
  // When they were added. Auto-assign hands out table sections in this order.
  createdAt: timestamp("created_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
});

export const judgesRelations = relations(judges, ({ one, many }) => ({
  user: one(users, {
    fields: [judges.id],
    references: [users.id],
  }),
  marks: many(teamMarks),
  assignments: many(judgingAssignments),
}));

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
    // The rubric behind `score`: each criterion rated 0-10 in half steps,
    // one column per criterion in src/lib/judging-criteria.ts. Null when the
    // judge used the single slider instead of the rubric.
    impactRating: real("impact_rating"),
    creativityRating: real("creativity_rating"),
    technicalRating: real("technical_rating"),
    designRating: real("design_rating"),
    adventurousRating: real("adventurous_rating"),
    notes: text("notes"),
    // The judge's "super like" for this team.
    superLike: boolean("super_like").default(false).notNull(),
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

/**
 * Which teams are in which track: one row per (team, track). Lets a track
 * list its teams without scanning `team.tracks`. Backfilled from
 * `team.tracks` by migration 0034; the array stays until its readers move
 * over to this table.
 */
export const teamTracks = pgTable(
  "team_track",
  {
    teamId: varchar("team_id", { length: 255 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    track: trackEnum("track").notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.track] }),
    index("team_track_track_idx").on(t.track),
  ],
);

export const teamTracksRelations = relations(teamTracks, ({ one }) => ({
  team: one(teams, {
    fields: [teamTracks.teamId],
    references: [teams.id],
  }),
}));

/**
 * A physical table in the judging hall, numbered along the snake (row 1 left
 * to right, row 2 right to left, ...). Created from `judging_settings`; each
 * submitted team is seated at one (`team.judging_table_id`). Inactive tables
 * (broken, unused) get no team and no judges.
 */
export const judgingTables = pgTable("judging_table", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull().unique(),
  zone: varchar("zone", { length: 64 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  // Kept in sync with seating and judging_assignment by triggers.
  status: judgingTableStatusEnum("status").default("empty").notNull(),
  statusUpdatedAt: timestamp("status_updated_at", {
    mode: "date",
    precision: 3,
  })
    .defaultNow()
    .notNull(),
});

export const judgingTablesRelations = relations(
  judgingTables,
  ({ one, many }) => ({
    team: one(teams, {
      fields: [judgingTables.id],
      references: [teams.judgingTableId],
    }),
    assignments: many(judgingAssignments),
  }),
);

/**
 * Where the timed judging rounds are. Round N is every judge's Nth stop
 * (`judging_assignment.position`). Judges can only start and score stops in the
 * current round while its timer runs; when the timer hits 0 the round closes
 * and an organizer starts the next one. See docs/judging-engine.md.
 *   idle    - no round is open (before round 1, or after a reset)
 *   running - the timer is counting down to `ends_at`
 *   paused  - the timer is stopped with `remaining_ms` left; scoring still works
 *   closed  - time ran out or an organizer ended it; no more scores
 * A running round whose `ends_at` has passed is treated as closed when read,
 * so nothing has to tick on the server.
 */
export const judgingRoundStatusEnum = pgEnum("judging_round_status", [
  "idle",
  "running",
  "paused",
  "closed",
]);

/**
 * The one row (id = 1) of round state. `rounds_enabled = false` turns the
 * rounds off so judges can go in any order (a safety valve for the day).
 */
export const judgingRound = pgTable(
  "judging_round",
  {
    id: integer("id").primaryKey().default(1),
    roundsEnabled: boolean("rounds_enabled").default(true).notNull(),
    // Whether hackers see the rounds board (/rounds and its menu link).
    // Organizers always do. Off until an organizer turns it on.
    showToHackers: boolean("show_to_hackers").default(false).notNull(),
    currentRound: integer("current_round").default(0).notNull(),
    status: judgingRoundStatusEnum("status").default("idle").notNull(),
    roundSeconds: integer("round_seconds").default(600).notNull(),
    endsAt: timestamp("ends_at", { mode: "date", precision: 3 }),
    remainingMs: integer("remaining_ms"),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [check("judging_round_singleton", sql`${t.id} = 1`)],
);

/**
 * The room layout and how many judges each table needs. One row (id = 1).
 * Tables per row = ceil(tableCount / rows); see docs/judging-engine.md.
 */
export const judgingSettings = pgTable(
  "judging_settings",
  {
    id: integer("id").primaryKey().default(1),
    tableCount: integer("table_count").default(70).notNull(),
    rows: integer("rows").default(5).notNull(),
    judgesPerTable: integer("judges_per_table").default(3).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [check("judging_settings_singleton", sql`${t.id} = 1`)],
);

/**
 * One stop on a judge's list: a table in their section of the snake. The team
 * judged is whoever is seated there, so swapping two teams' tables moves each
 * into the other's judges' lineup. Written by auto-assign (in walking order)
 * and by organizer fixes. Cancelled rows are kept for history and ignored by
 * the unique indexes.
 */
export const judgingAssignments = pgTable(
  "judging_assignment",
  {
    id: serial("id").primaryKey(),
    judgeId: varchar("judge_id", { length: 255 })
      .notNull()
      .references(() => judges.id, { onDelete: "cascade" }),
    judgingTableId: integer("judging_table_id")
      .notNull()
      .references(() => judgingTables.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    status: judgingAssignmentStatusEnum("status").default("assigned").notNull(),
    assignedBy: varchar("assigned_by", { length: 255 }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    assignedAt: timestamp("assigned_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
    startedAt: timestamp("started_at", { mode: "date", precision: 3 }),
    completedAt: timestamp("completed_at", { mode: "date", precision: 3 }),
    /** The team said their judge hadn't come (hacker Judging page). */
    missingReportedAt: timestamp("missing_reported_at", {
      mode: "date",
      precision: 3,
    }),
  },
  (t) => [
    uniqueIndex("judging_assignment_judge_position_idx")
      .on(t.judgeId, t.position)
      .where(sql`${t.status} <> 'cancelled'`),
    uniqueIndex("judging_assignment_judge_table_idx")
      .on(t.judgeId, t.judgingTableId)
      .where(sql`${t.status} <> 'cancelled'`),
    index("judging_assignment_table_idx").on(t.judgingTableId),
    // A judge is at one table at a time; backs the check in startStop when
    // two starts race.
    uniqueIndex("judging_assignment_one_in_progress_idx")
      .on(t.judgeId)
      .where(sql`${t.status} = 'in_progress'`),
  ],
);

export const judgingAssignmentsRelations = relations(
  judgingAssignments,
  ({ one }) => ({
    judge: one(judges, {
      fields: [judgingAssignments.judgeId],
      references: [judges.id],
    }),
    table: one(judgingTables, {
      fields: [judgingAssignments.judgingTableId],
      references: [judgingTables.id],
    }),
    assigner: one(users, {
      fields: [judgingAssignments.assignedBy],
      references: [users.id],
    }),
  }),
);

export const teamsRelations = relations(teams, ({ many, one }) => ({
  members: many(users),
  marks: many(teamMarks),
  checkResults: many(teamCheckResults),
  judgingTable: one(judgingTables, {
    fields: [teams.judgingTableId],
    references: [judgingTables.id],
  }),
  trackEntries: many(teamTracks),
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
// Cheat check sweeps
// ---------------------------------------------------------------------------

/**
 * One row per automated cheat-check sweep. A sweep is started when judging
 * completes (or manually by an organizer) and is worked off in slices by
 * `/api/cheat-check/sweep`, which re-invokes itself until every item is done.
 *
 * `lastHeartbeatAt` is bumped after every batch so a sweep whose worker died
 * mid-flight can be spotted and resumed.
 */
export const cheatCheckSweeps = pgTable(
  "cheat_check_sweep",
  {
    id: serial("id").primaryKey(),
    status: cheatSweepStatusEnum("status").default("running").notNull(),
    triggeredBy: cheatSweepTriggerEnum("triggered_by").notNull(),
    startedAt: timestamp("started_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", {
      mode: "date",
      precision: 3,
    })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { mode: "date", precision: 3 }),
    totalTeams: integer("total_teams").default(0).notNull(),
    // The two hacker checks are pure DB reads, so they run once per sweep in
    // bulk rather than per team.
    hackerChecksDone: boolean("hacker_checks_done").default(false).notNull(),
    // When false (the default) the sweep skips check types that already have a
    // cached result.
    forceRerun: boolean("force_rerun").default(false).notNull(),
    rateLimitedUntil: timestamp("rate_limited_until", {
      mode: "date",
      precision: 3,
    }),
    error: text("error"),
  },
  (t) => [
    // Partial unique index: at most one sweep may be `running` at a time. This
    // is what makes double-triggering impossible (two judges submitting their
    // final marks near-simultaneously) without application-level locking.
    uniqueIndex("cheat_check_sweep_active_idx")
      .on(t.status)
      .where(sql`status = 'running'`),
    index("cheat_check_sweep_finished_at_idx").on(t.finishedAt),
  ],
);

/**
 * One row per team in a sweep — the durable work list. It makes a sweep
 * resumable after a function timeout, caps retries so a permanently broken
 * repo can't loop forever, and gives per-team error visibility.
 */
export const cheatCheckSweepItems = pgTable(
  "cheat_check_sweep_item",
  {
    sweepId: integer("sweep_id")
      .notNull()
      .references(() => cheatCheckSweeps.id, { onDelete: "cascade" }),
    teamId: varchar("team_id", { length: 255 })
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    status: cheatSweepItemStatusEnum("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    error: text("error"),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sweepId, t.teamId] }),
    index("cheat_check_sweep_item_claim_idx").on(t.sweepId, t.status),
  ],
);

export const cheatCheckSweepsRelations = relations(
  cheatCheckSweeps,
  ({ many }) => ({
    items: many(cheatCheckSweepItems),
  }),
);

export const cheatCheckSweepItemsRelations = relations(
  cheatCheckSweepItems,
  ({ one }) => ({
    sweep: one(cheatCheckSweeps, {
      fields: [cheatCheckSweepItems.sweepId],
      references: [cheatCheckSweeps.id],
    }),
    team: one(teams, {
      fields: [cheatCheckSweepItems.teamId],
      references: [teams.id],
    }),
  }),
);

// ---------------------------------------------------------------------------
// Scavenger hunt
// ---------------------------------------------------------------------------

export const scavengerHuntItemType = pgEnum("scavenger_hunt_item_type", [
  "meal",
  "workshop",
  "sponsor_workshop",
  "activity",
  "bonus",
]);

export const scavengerHuntActivityType = pgEnum(
  "scavenger_hunt_activity_type",
  ["attendance", "win"],
);

export const scavengerHuntItemStatus = pgEnum("scavenger_hunt_item_status", [
  "draft",
  "active",
  "disabled",
]);

export const scavengerHuntItems = pgTable(
  "scavenger_hunt_item",
  {
    id: serial("id").primaryKey(),
    points: smallint("points").default(1).notNull(),
    name: text("name").notNull(),
    type: scavengerHuntItemType("type").notNull(),
    winPoints: smallint("win_points"),
    startsAt: timestamp("starts_at", { mode: "date", precision: 3 }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date", precision: 3 }).notNull(),
    room: varchar("room", { length: 255 }),
    status: scavengerHuntItemStatus("status").default("active").notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date", precision: 3 }),
  },
  (t) => [
    check(
      "scavenger_hunt_item_win_points_activity_only",
      sql`${t.winPoints} IS NULL OR ${t.type} = 'activity'`,
    ),
    uniqueIndex("scavenger_hunt_item_name_unique")
      .on(sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

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
    activityType: scavengerHuntActivityType("activity_type")
      .default("attendance")
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.itemId, t.activityType] }),
    index("scan_user_idx").on(t.userId),
    index("scan_scanner_idx").on(t.scannerId),
  ],
);

export const scavengerHuntRewards = pgTable(
  "scavenger_hunt_reward",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    costPoints: smallint("cost_points").notNull(),
    description: text("description"),
    quantity: integer("quantity"),
    status: scavengerHuntItemStatus("status").default("active").notNull(),
    deletedAt: timestamp("deleted_at", { mode: "date", precision: 3 }),
  },
  (t) => [
    uniqueIndex("scavenger_hunt_reward_name_unique")
      .on(sql`lower(${t.name})`)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);

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
    costPoints: smallint("cost_points").notNull(),
    scannerId: varchar("scanner_id", { length: 255 }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("redemption_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Run-of-show task reminders (T49)
// ---------------------------------------------------------------------------

// Who a sheet "Owner" name is on Slack. Organizers type the email on the
// Team tasks tab; the Slack user id is looked up once (users.lookupByEmail)
// and cached until the email changes.
export const taskOwnerContacts = pgTable("task_owner_contact", {
  // Owner name trimmed, spaces collapsed, lower-cased ("jazz gu").
  ownerKey: varchar("owner_key", { length: 255 }).primaryKey(),
  // Owner name as the sheet writes it, for display.
  ownerName: varchar("owner_name", { length: 255 }).notNull(),
  slackEmail: varchar("slack_email", { length: 255 }),
  // Null until looked up, or when Slack has no account for the email.
  slackUserId: varchar("slack_user_id", { length: 32 }),
  // When the email was last looked up; null = not checked yet.
  lookedUpAt: timestamp("looked_up_at", { mode: "date", precision: 3 }),
  updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
});

export const taskReminderStatusEnum = pgEnum("task_reminder_status", [
  "scheduled",
  "cancelled",
  "failed",
  "sent-window-passed",
]);

// One Slack scheduled message for a task, at its start time: a DM to the
// owner, or a team channel post when nobody owns it on Slack (slackUserId
// null).
// Synced from the run-of-show sheet (src/server/api/utils/task-reminders.ts).
export const taskReminders = pgTable(
  "task_reminder",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    // sha256 of day + start + task + owner: a changed task is a new key.
    taskKey: varchar("task_key", { length: 64 }).notNull(),
    owner: varchar("owner", { length: 255 }).notNull(),
    // Task text and Slack user, so a failure can be shown and an owner's new
    // Slack account reschedules the DM.
    task: text("task").notNull(),
    slackUserId: varchar("slack_user_id", { length: 32 }),
    postAt: timestamp("post_at", { mode: "date", precision: 3 }).notNull(),
    // DM channel id from conversations.open.
    slackChannel: varchar("slack_channel", { length: 32 }),
    scheduledMessageId: varchar("scheduled_message_id", { length: 64 }),
    // sha256 of where and what was scheduled (DM user or channel, and the
    // full text with its mention): a change reschedules. Null on rows from
    // before 0047, which are rescheduled once.
    routeKey: varchar("route_key", { length: 64 }),
    status: taskReminderStatusEnum("status").notNull(),
    error: varchar("error", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("task_reminder_key_idx").on(t.taskKey),
    index("task_reminder_status_idx").on(t.status),
  ],
);

// One row ("run-of-show"): when reminders were last synced and the hash of
// the tasks they were synced from. The automatic sync after a sheet read is
// throttled with lastAttemptAt.
export const taskReminderSync = pgTable("task_reminder_sync", {
  id: varchar("id", { length: 32 }).primaryKey(),
  tasksHash: varchar("tasks_hash", { length: 64 }),
  lastSyncedAt: timestamp("last_synced_at", { mode: "date", precision: 3 }),
  lastAttemptAt: timestamp("last_attempt_at", { mode: "date", precision: 3 }),
});

// Marketing notification bot (Allison/Brittney/Anson/Jamie). One Slack
// scheduled DM per recipient and notify-time, with all tasks at that time
// grouped into one message.
export const marketingNotificationStatusEnum = pgEnum(
  "marketing_notification_status",
  ["scheduled", "cancelled", "failed", "sent-window-passed"],
);

export const marketingNotificationReminders = pgTable(
  "marketing_notification_reminder",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    reminderKey: varchar("reminder_key", { length: 64 }).notNull().unique(),
    recipientName: varchar("recipient_name", { length: 32 }).notNull(),
    slackUserId: varchar("slack_user_id", { length: 32 }),
    postAt: timestamp("post_at", { mode: "date", precision: 3 }).notNull(),
    taskIds: text("task_ids").array().notNull(),
    text: text("text").notNull(),
    routeKey: varchar("route_key", { length: 64 }).notNull(),
    slackChannel: varchar("slack_channel", { length: 32 }),
    scheduledMessageId: varchar("scheduled_message_id", { length: 64 }),
    status: marketingNotificationStatusEnum("status").notNull(),
    error: varchar("error", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("marketing_notification_post_idx").on(t.postAt),
    index("marketing_notification_status_idx").on(t.status),
  ],
);

// Small text values the Slack bots keep between Vercel cron runs: the last
// sheet-check DM, pending heartbeat DMs, cached Slack ids
// (src/server/slack/bot-state-db.ts).
export const botState = pgTable("bot_state", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
});

// One row (id 1) of settings for the venue broadcast display (/broadcast),
// edited by organizers at /internal/broadcast.
export const broadcastSettings = pgTable("broadcast_settings", {
  id: integer("id").primaryKey().default(1),
  hackingStartsAt: timestamp("hacking_starts_at", {
    mode: "date",
    precision: 3,
  }),
  hackingEndsAt: timestamp("hacking_ends_at", { mode: "date", precision: 3 }),
  photoSeconds: integer("photo_seconds").notNull().default(8),
  videoSeconds: integer("video_seconds").notNull().default(20),
  // Google Drive folder (shared "anyone with the link") the photos come from
  driveFolderId: varchar("drive_folder_id", { length: 200 }),
  // Lower third on the live interview screen (/broadcast/interview)
  interviewName: varchar("interview_name", { length: 120 }),
  interviewRole: varchar("interview_role", { length: 120 }),
  updatedAt: timestamp("updated_at", { mode: "date", precision: 3 })
    .defaultNow()
    .notNull(),
});
