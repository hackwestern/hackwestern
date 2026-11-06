CREATE TYPE "public"."application_status" AS ENUM('IN_PROGRESS', 'PENDING_REVIEW', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'DECLINED', 'CONFIRMED');--> statement-breakpoint
CREATE TYPE "public"."avatar_colour" AS ENUM('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink');--> statement-breakpoint
CREATE TYPE "public"."cheat_sweep_item_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."cheat_sweep_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."cheat_sweep_trigger" AS ENUM('queue_drain', 'manual');--> statement-breakpoint
CREATE TYPE "public"."country" AS ENUM('Canada', 'United States', 'Other');--> statement-breakpoint
CREATE TYPE "public"."dietary_restrictions" AS ENUM('None', 'Vegetarian', 'Vegan', 'Kosher', 'Halal', 'Other');--> statement-breakpoint
CREATE TYPE "public"."emergency_contact_relationship" AS ENUM('Parent', 'Sibling', 'Other family member', 'Friend', 'Coworker', 'Other');--> statement-breakpoint
CREATE TYPE "public"."race/ethnicity" AS ENUM('American Indian or Alaskan Native', 'Asian / Pacific Islander', 'Black or African American', 'Hispanic', 'White / Caucasian', 'Multiple ethnicity / Other', 'Prefer not to answer');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('Female', 'Male', 'Non-Binary', 'Other', 'Prefer not to answer');--> statement-breakpoint
CREATE TYPE "public"."hacker_check_type" AS ENUM('IS_OF_AGE', 'IS_REGISTERED');--> statement-breakpoint
CREATE TYPE "public"."judge_type" AS ENUM('organizer', 'sponsored');--> statement-breakpoint
CREATE TYPE "public"."judging_queue_status" AS ENUM('waiting', 'assigned');--> statement-breakpoint
CREATE TYPE "public"."major" AS ENUM('Computer Science', 'Computer Engineering', 'Software Engineering', 'Other Engineering Discipline', 'Information Systems', 'Information Technology', 'System Administration', 'Natural Sciences (Biology, Chemistry, Physics, etc.)', 'Mathematics/Statistics', 'Web Development/Web Design', 'Business Administration', 'Humanities', 'Social Science', 'Fine Arts/Performing Arts', 'Other');--> statement-breakpoint
CREATE TYPE "public"."num_of_hackathons" AS ENUM('0', '1-3', '4-6', '7+');--> statement-breakpoint
CREATE TYPE "public"."realm" AS ENUM('safari', 'mountain', 'desert', 'ocean');--> statement-breakpoint
CREATE TYPE "public"."round_type" AS ENUM('regular', 'sponsored');--> statement-breakpoint
CREATE TYPE "public"."sexual_orientation" AS ENUM('Asexual / Aromantic', 'Pansexual, Demisexual or Omnisexual', 'Bisexual', 'Queer', 'Gay / Lesbian', 'Heterosexual / Straight', 'Other', 'Prefer not to answer');--> statement-breakpoint
CREATE TYPE "public"."shirt_size" AS ENUM('S', 'M', 'L', 'XL');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'submitted', 'late');--> statement-breakpoint
CREATE TYPE "public"."team_check_type" AS ENUM('COMMIT_WITHIN_ALLOTTED_TIME', 'ONLY_TEAM_MEMBER_COMMITS', 'DEVPOST_MEMBERS_REGISTERED');--> statement-breakpoint
CREATE TYPE "public"."track" AS ENUM('Best Use of Cohere', 'Best Use of AntiGravity', 'Best Domain', 'General');--> statement-breakpoint
CREATE TYPE "public"."transportation_method" AS ENUM('Waterloo', 'Toronto', 'Hamilton', 'None');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('hacker', 'organizer', 'sponsor');--> statement-breakpoint
CREATE TYPE "public"."year_of_study" AS ENUM('1st', '2nd', '3rd', '4th', '5th+', 'N/A', 'Prefer not to answer');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "application" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"status" "application_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"realm" realm,
	"horse_id" integer,
	"horse_first_name" varchar(255),
	"horse_last_name" varchar(255),
	"first_name" varchar(255),
	"last_name" varchar(255),
	"age" integer,
	"phone_number" varchar(42),
	"country_of_residence" "country",
	"name" varchar(255),
	"school_other" varchar(255),
	"year_of_study" "year_of_study",
	"major" "major",
	"shirt_size" "shirt_size",
	"dietary_restrictions" "dietary_restrictions",
	"dietary_restrictions_other" varchar(255),
	"attended" boolean,
	"num_of_hackathons" "num_of_hackathons",
	"question1" text,
	"question2" text,
	"question3" text,
	"github_link" varchar(2048) NOT NULL,
	"linkedin_link" varchar(2048) NOT NULL,
	"devpost_link" varchar(255) NOT NULL,
	"resume_link" varchar(2048),
	"other_link" varchar(2048),
	"agree_code_of_conduct" boolean DEFAULT false NOT NULL,
	"agree_share_with_sponsors" boolean DEFAULT false NOT NULL,
	"agree_share_with_mlh" boolean DEFAULT false NOT NULL,
	"agree_emails_from_mlh" boolean DEFAULT false NOT NULL,
	"agree_will_be_18" boolean DEFAULT false NOT NULL,
	"underrep_group" boolean,
	"gender" "gender",
	"ethnicity" "race/ethnicity",
	"sexual_orientation" "sexual_orientation",
	"emergency_contact_name" varchar(255),
	"emergency_contact_relationship" "emergency_contact_relationship",
	"emergency_contact_phone_number" varchar(42),
	"transportation_method" "transportation_method",
	"travel_reimbursement" boolean,
	"travel_from" varchar(255),
	"enrollment_confirmed_at" timestamp (3),
	"avatar_colour" "avatar_colour",
	"avatar_face" integer,
	"avatar_left_hand" integer,
	"avatar_right_hand" integer,
	"avatar_hat" integer,
	"canvas_data" jsonb DEFAULT '{"paths":[],"timestamp":0,"version":""}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheat_check_sweep_item" (
	"sweep_id" integer NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"status" "cheat_sweep_item_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "cheat_check_sweep_item_sweep_id_team_id_pk" PRIMARY KEY("sweep_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "cheat_check_sweep" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" "cheat_sweep_status" DEFAULT 'running' NOT NULL,
	"triggered_by" "cheat_sweep_trigger" NOT NULL,
	"started_at" timestamp (3) DEFAULT now() NOT NULL,
	"last_heartbeat_at" timestamp (3) DEFAULT now() NOT NULL,
	"finished_at" timestamp (3),
	"total_teams" integer DEFAULT 0 NOT NULL,
	"hacker_checks_done" boolean DEFAULT false NOT NULL,
	"force_rerun" boolean DEFAULT false NOT NULL,
	"rate_limited_until" timestamp (3),
	"error" text
);
--> statement-breakpoint
CREATE TABLE "day_of_registration" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"signed_in_at" timestamp (3),
	"date_of_birth" timestamp
);
--> statement-breakpoint
CREATE TABLE "email_reminder_sent" (
	"user_id" varchar(255) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"sent_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "email_reminder_sent_user_id_kind_pk" PRIMARY KEY("user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "email_subscriber" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"source" varchar(16) NOT NULL,
	"unsubscribe_token" varchar(64) NOT NULL,
	"unsubscribed_at" timestamp (3),
	"bounced_at" timestamp (3),
	"last_sent_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "email_subscriber_email_unique" UNIQUE("email"),
	CONSTRAINT "email_subscriber_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE "hacker_check_result" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"check_type" "hacker_check_type" NOT NULL,
	"passed" boolean NOT NULL,
	"details" jsonb NOT NULL,
	"checked_at" timestamp (3) DEFAULT now() NOT NULL,
	"checked_by_user_id" varchar(255) NOT NULL,
	"manual_override" boolean,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "judge" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"type" "judge_type" DEFAULT 'organizer' NOT NULL,
	"track" "track"[],
	"marks_count" integer DEFAULT 0 NOT NULL,
	"marks_sum" real DEFAULT 0 NOT NULL,
	"marks_squared_sum" real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judging_queue" (
	"team_id" varchar(255) PRIMARY KEY NOT NULL,
	"seen_judges" integer DEFAULT 0 NOT NULL,
	"rounds_remaining" integer DEFAULT 0 NOT NULL,
	"enqueued_at" timestamp (3) DEFAULT now() NOT NULL,
	"status" "judging_queue_status" DEFAULT 'waiting' NOT NULL,
	"current_judge_id" varchar(255),
	"assigned_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "judging_skip" (
	"team_id" varchar(255) NOT NULL,
	"judge_id" varchar(255) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "judging_skip_team_id_judge_id_pk" PRIMARY KEY("team_id","judge_id")
);
--> statement-breakpoint
CREATE TABLE "preregistration" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"email" varchar(320) NOT NULL,
	"unsubscribe_token" varchar(64),
	"unsubscribed_at" timestamp (3),
	"bounced_at" timestamp (3),
	CONSTRAINT "preregistration_email_unique" UNIQUE("email"),
	CONSTRAINT "preregistration_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
CREATE TABLE "reset_password_token" (
	"userId" varchar(255) PRIMARY KEY NOT NULL,
	"token" varchar(255),
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"reviewer_user_id" varchar(255) NOT NULL,
	"applicant_user_id" varchar(255) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"originality_rating" smallint DEFAULT 0,
	"technicality_rating" smallint DEFAULT 0,
	"passion_rating" smallint DEFAULT 0,
	"comments" text,
	"completed" boolean DEFAULT false,
	"referral" boolean DEFAULT false,
	CONSTRAINT "review_reviewer_user_id_applicant_user_id_pk" PRIMARY KEY("reviewer_user_id","applicant_user_id")
);
--> statement-breakpoint
CREATE TABLE "scavenger_hunt_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(12) NOT NULL,
	"points" smallint DEFAULT 1 NOT NULL,
	"description" text,
	"deleted_at" timestamp (3),
	CONSTRAINT "scavenger_hunt_item_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "scavenger_hunt_redemption" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"reward_id" integer NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scavenger_hunt_reward" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"cost_points" smallint NOT NULL,
	"description" text,
	"quantity" integer
);
--> statement-breakpoint
CREATE TABLE "scavenger_hunt_scan" (
	"user_id" varchar(255) NOT NULL,
	"scanner_id" varchar(255) NOT NULL,
	"item_id" integer NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "scavenger_hunt_scan_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_judging_sponsor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_judging_sponsor_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "team_check_result" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"check_type" "team_check_type" NOT NULL,
	"passed" boolean NOT NULL,
	"details" jsonb NOT NULL,
	"checked_at" timestamp (3) DEFAULT now() NOT NULL,
	"checked_by_user_id" varchar(255) NOT NULL,
	"manual_override" boolean,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "team_finder_card" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"shown" boolean DEFAULT false NOT NULL,
	"needs" smallint,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"first_hackathon" boolean DEFAULT false NOT NULL,
	"looking_for" varchar(280) DEFAULT '' NOT NULL,
	"idea" varchar(280),
	"show_school" boolean DEFAULT true NOT NULL,
	"show_year" boolean DEFAULT false NOT NULL,
	"discord" varchar(100),
	"instagram" varchar(100),
	"linkedin" varchar(100),
	"github" varchar(100),
	"phone" varchar(32),
	"photo_key" varchar(255),
	"hidden_by_organizer_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "team_finder_card_id_unique" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "team_finder_report" (
	"reporter_id" varchar(255) NOT NULL,
	"card_id" uuid NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "team_finder_report_reporter_id_card_id_pk" PRIMARY KEY("reporter_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "team_mark" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"judge_id" varchar(255) NOT NULL,
	"score" real NOT NULL,
	"round_type" "round_type" DEFAULT 'regular' NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" varchar(12) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"devpost_url" varchar(2048),
	"github_url" varchar(2048),
	"submission_status" "submission_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp (3),
	"tracks" "track"[],
	"member_github_usernames" text[],
	"member_devpost_usernames" text[],
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"joinCode" varchar(6) NOT NULL,
	CONSTRAINT "team_joinCode_unique" UNIQUE("joinCode")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"password" varchar(255),
	"email" varchar(255) NOT NULL,
	"emailVerified" timestamp DEFAULT CURRENT_TIMESTAMP,
	"image" varchar(255),
	"type" "user_type" DEFAULT 'hacker',
	"team_id" varchar(255),
	"hacker_id" varchar(64),
	"scavenger_hunt_earned" integer DEFAULT 0,
	"scavenger_hunt_balance" integer DEFAULT 0,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_hacker_id_unique" UNIQUE("hacker_id")
);
--> statement-breakpoint
CREATE TABLE "verification_token" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheat_check_sweep_item" ADD CONSTRAINT "cheat_check_sweep_item_sweep_id_cheat_check_sweep_id_fk" FOREIGN KEY ("sweep_id") REFERENCES "public"."cheat_check_sweep"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheat_check_sweep_item" ADD CONSTRAINT "cheat_check_sweep_item_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_of_registration" ADD CONSTRAINT "day_of_registration_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_reminder_sent" ADD CONSTRAINT "email_reminder_sent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_check_result" ADD CONSTRAINT "hacker_check_result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_check_result" ADD CONSTRAINT "hacker_check_result_checked_by_user_id_user_id_fk" FOREIGN KEY ("checked_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge" ADD CONSTRAINT "judge_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_queue" ADD CONSTRAINT "judging_queue_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_queue" ADD CONSTRAINT "judging_queue_current_judge_id_judge_id_fk" FOREIGN KEY ("current_judge_id") REFERENCES "public"."judge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_skip" ADD CONSTRAINT "judging_skip_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_skip" ADD CONSTRAINT "judging_skip_judge_id_judge_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reset_password_token" ADD CONSTRAINT "reset_password_token_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_applicant_user_id_application_user_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."application"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_applicant_user_id_user_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_redemption" ADD CONSTRAINT "scavenger_hunt_redemption_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_redemption" ADD CONSTRAINT "scavenger_hunt_redemption_reward_id_scavenger_hunt_reward_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."scavenger_hunt_reward"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_scan" ADD CONSTRAINT "scavenger_hunt_scan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_scan" ADD CONSTRAINT "scavenger_hunt_scan_scanner_id_user_id_fk" FOREIGN KEY ("scanner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_scan" ADD CONSTRAINT "scavenger_hunt_scan_item_id_scavenger_hunt_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."scavenger_hunt_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_check_result" ADD CONSTRAINT "team_check_result_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_check_result" ADD CONSTRAINT "team_check_result_checked_by_user_id_user_id_fk" FOREIGN KEY ("checked_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_finder_card" ADD CONSTRAINT "team_finder_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_finder_report" ADD CONSTRAINT "team_finder_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_finder_report" ADD CONSTRAINT "team_finder_report_card_id_team_finder_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."team_finder_card"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_mark" ADD CONSTRAINT "team_mark_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_mark" ADD CONSTRAINT "team_mark_judge_id_judge_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_id_idx" ON "application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cheat_check_sweep_item_claim_idx" ON "cheat_check_sweep_item" USING btree ("sweep_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "cheat_check_sweep_active_idx" ON "cheat_check_sweep" USING btree ("status") WHERE status = 'running';--> statement-breakpoint
CREATE INDEX "cheat_check_sweep_finished_at_idx" ON "cheat_check_sweep" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "hacker_check_user_idx" ON "hacker_check_result" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hacker_check_unique_idx" ON "hacker_check_result" USING btree ("user_id","check_type");--> statement-breakpoint
CREATE INDEX "judging_queue_priority_idx" ON "judging_queue" USING btree ("rounds_remaining" DESC NULLS LAST,"enqueued_at");--> statement-breakpoint
CREATE INDEX "judging_queue_current_judge_idx" ON "judging_queue" USING btree ("current_judge_id");--> statement-breakpoint
CREATE INDEX "applicant_user_id_idx" ON "review" USING btree ("applicant_user_id");--> statement-breakpoint
CREATE INDEX "redemption_user_idx" ON "scavenger_hunt_redemption" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scan_user_idx" ON "scavenger_hunt_scan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scan_scanner_idx" ON "scavenger_hunt_scan" USING btree ("scanner_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "team_check_team_idx" ON "team_check_result" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_check_unique_idx" ON "team_check_result" USING btree ("team_id","check_type");--> statement-breakpoint
CREATE INDEX "team_finder_card_shown_idx" ON "team_finder_card" USING btree ("shown");--> statement-breakpoint
CREATE INDEX "team_mark_team_idx" ON "team_mark" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_mark_judge_idx" ON "team_mark" USING btree ("judge_id");--> statement-breakpoint
CREATE INDEX "team_created_at_idx" ON "team" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_scavenger_hunt_earned_idx" ON "user" USING btree ("scavenger_hunt_earned");--> statement-breakpoint
CREATE INDEX "user_scavenger_hunt_balance_idx" ON "user" USING btree ("scavenger_hunt_balance");--> statement-breakpoint
CREATE INDEX "user_team_id_idx" ON "user" USING btree ("team_id");