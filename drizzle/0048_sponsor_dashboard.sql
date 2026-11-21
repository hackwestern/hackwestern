-- One migration for the sponsor dashboard (coffee chats, judging, Slack, notifications).
-- Written to be safe to run on a database that already has some of these tables:
-- every CREATE / ADD skips what exists.
DO $$ BEGIN
 CREATE TYPE "public"."coffee_chat_placement_status" AS ENUM('draft', 'sent');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."coffee_chat_status" AS ENUM('pending', 'accepted', 'declined', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."marketing_notification_status" AS ENUM('scheduled', 'cancelled', 'failed', 'sent-window-passed');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sponsor_help_status" AS ENUM('open', 'claimed', 'resolved', 'cancelled');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."task_reminder_status" AS ENUM('scheduled', 'cancelled', 'failed', 'sent-window-passed');
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coffee_chat_hold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"room" varchar(64) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"note" varchar(255),
	"created_by" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coffee_chat_limit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"hackers" smallint NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coffee_chat_line" (
	"sponsor_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"kind" varchar(8) NOT NULL,
	"added_by" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "coffee_chat_line_sponsor_id_user_id_pk" PRIMARY KEY("sponsor_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coffee_chat_placement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rep_id" uuid NOT NULL,
	"session_id" varchar(4) NOT NULL,
	"room" varchar(8) NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"forced" boolean DEFAULT false NOT NULL,
	"status" "coffee_chat_placement_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coffee_chat_pref" (
	"sponsor_id" uuid PRIMARY KEY NOT NULL,
	"hackers_per_chat" smallint DEFAULT 1 NOT NULL,
	"longer_one_on_one" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp (3),
	"shortlist_submitted_at" timestamp (3),
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "coffee_chat_pref_hackers_check" CHECK ("coffee_chat_pref"."hackers_per_chat" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coffee_chat_rep_session" (
	"rep_id" uuid NOT NULL,
	"session_id" varchar(4) NOT NULL,
	CONSTRAINT "coffee_chat_rep_session_rep_id_session_id_pk" PRIMARY KEY("rep_id","session_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coffee_chat_rep" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"chats_wanted" smallint DEFAULT 1 NOT NULL,
	"max_sessions" smallint,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "coffee_chat_rep_chats_check" CHECK ("coffee_chat_rep"."chats_wanted" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coffee_chat_room_booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(4) NOT NULL,
	"room" varchar(8) NOT NULL,
	"for_sponsor_id" uuid,
	"label" varchar(255) NOT NULL,
	"note" varchar(255),
	"created_by" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coffee_chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"room" varchar(64),
	"slot_time" varchar(5) NOT NULL,
	"duration_minutes" smallint DEFAULT 15 NOT NULL,
	"status" "coffee_chat_status" DEFAULT 'pending' NOT NULL,
	"rep_name" varchar(255),
	"placement_id" uuid,
	"round" smallint,
	"expires_at" timestamp (3),
	"source" varchar(16),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"responded_at" timestamp (3),
	"notified_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_notification_reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reminder_key" varchar(64) NOT NULL,
	"recipient_name" varchar(32) NOT NULL,
	"slack_user_id" varchar(32),
	"post_at" timestamp (3) NOT NULL,
	"task_ids" text[] NOT NULL,
	"text" text NOT NULL,
	"route_key" varchar(64) NOT NULL,
	"slack_channel" varchar(32),
	"scheduled_message_id" varchar(64),
	"status" "marketing_notification_status" NOT NULL,
	"error" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_notification_reminder_reminder_key_unique" UNIQUE("reminder_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_final_pick" (
	"sponsor_id" uuid PRIMARY KEY NOT NULL,
	"team_ids" varchar(12)[] NOT NULL,
	"submitted_at" timestamp (3) DEFAULT now() NOT NULL,
	"sheet_synced_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_help_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"reason" varchar(32) NOT NULL,
	"note" varchar(500),
	"location" varchar(255),
	"rep_name" varchar(80),
	"phone" varchar(32),
	"location_note" varchar(120),
	"status" "sponsor_help_status" DEFAULT 'open' NOT NULL,
	"slack_channel" varchar(64),
	"slack_ts" varchar(32),
	"claimed_by_slack_id" varchar(64),
	"claimed_by_name" varchar(255),
	"ping_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"claimed_at" timestamp (3),
	"resolved_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_interest" (
	"user_id" varchar(255) NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"rank" smallint NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_interest_user_id_sponsor_id_pk" PRIMARY KEY("user_id","sponsor_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_judging_room" (
	"sponsor_id" uuid PRIMARY KEY NOT NULL,
	"room" varchar(64) NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_judging_setting" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"round2_opened_at" timestamp (3),
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_judging_setting_single_row" CHECK ("sponsor_judging_setting"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_presentation_confirm" (
	"team_id" varchar(12) PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"via" varchar(8) NOT NULL,
	"slots_key" text NOT NULL,
	"confirmed_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_presentation_notice" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"team_id" varchar(12) NOT NULL,
	"status" varchar(16) NOT NULL,
	"slots_key" text NOT NULL,
	"claimed_at" timestamp (3) DEFAULT now() NOT NULL,
	"sent_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_presentation" (
	"sponsor_id" uuid NOT NULL,
	"team_id" varchar(12) NOT NULL,
	"room" varchar(64),
	"start_minute" smallint,
	"scheduled_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_presentation_sponsor_id_team_id_pk" PRIMARY KEY("sponsor_id","team_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_scan" (
	"sponsor_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"rep_name" varchar(255),
	"scanned_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_scan_sponsor_id_user_id_pk" PRIMARY KEY("sponsor_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_shortlist_send" (
	"sponsor_id" uuid PRIMARY KEY NOT NULL,
	"team_ids" varchar(12)[] NOT NULL,
	"sent_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_shortlist" (
	"sponsor_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_shortlist_sponsor_id_user_id_pk" PRIMARY KEY("sponsor_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_team_review" (
	"sponsor_id" uuid NOT NULL,
	"team_id" varchar(12) NOT NULL,
	"score" smallint,
	"shortlisted" boolean DEFAULT false NOT NULL,
	"note" varchar(280),
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_team_review_sponsor_id_team_id_pk" PRIMARY KEY("sponsor_id","team_id"),
	CONSTRAINT "sponsor_team_review_score_range" CHECK ("sponsor_team_review"."score" IS NULL OR ("sponsor_team_review"."score" BETWEEN 1 AND 10))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_team_score" (
	"sponsor_id" uuid NOT NULL,
	"team_id" varchar(12) NOT NULL,
	"judge_name" varchar(255) NOT NULL,
	"score_halves" smallint NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_team_score_sponsor_id_team_id_judge_name_pk" PRIMARY KEY("sponsor_id","team_id","judge_name"),
	CONSTRAINT "sponsor_team_score_range" CHECK ("sponsor_team_score"."score_halves" BETWEEN 2 AND 20)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_top5_draft" (
	"sponsor_id" uuid PRIMARY KEY NOT NULL,
	"team_ids" varchar(12)[] NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_owner_contact" (
	"owner_key" varchar(255) PRIMARY KEY NOT NULL,
	"owner_name" varchar(255) NOT NULL,
	"slack_email" varchar(255),
	"slack_user_id" varchar(32),
	"looked_up_at" timestamp (3),
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_reminder_sync" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"tasks_hash" varchar(64),
	"last_synced_at" timestamp (3),
	"last_attempt_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_key" varchar(64) NOT NULL,
	"owner" varchar(255) NOT NULL,
	"task" text NOT NULL,
	"slack_user_id" varchar(32),
	"post_at" timestamp (3) NOT NULL,
	"slack_channel" varchar(32),
	"scheduled_message_id" varchar(64),
	"route_key" varchar(64),
	"status" "task_reminder_status" NOT NULL,
	"error" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Tables that already existed in an older shape get any missing columns.
ALTER TABLE "coffee_chat_hold" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_hold" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat_hold" ADD COLUMN IF NOT EXISTS "room" varchar(64);--> statement-breakpoint
ALTER TABLE "coffee_chat_hold" ADD COLUMN IF NOT EXISTS "start_time" varchar(5);--> statement-breakpoint
ALTER TABLE "coffee_chat_hold" ADD COLUMN IF NOT EXISTS "end_time" varchar(5);--> statement-breakpoint
ALTER TABLE "coffee_chat_hold" ADD COLUMN IF NOT EXISTS "note" varchar(255);--> statement-breakpoint
ALTER TABLE "coffee_chat_hold" ADD COLUMN IF NOT EXISTS "created_by" varchar(255);--> statement-breakpoint
ALTER TABLE "coffee_chat_hold" ADD COLUMN IF NOT EXISTS "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_limit" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_limit" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat_limit" ADD COLUMN IF NOT EXISTS "start_time" varchar(5);--> statement-breakpoint
ALTER TABLE "coffee_chat_limit" ADD COLUMN IF NOT EXISTS "end_time" varchar(5);--> statement-breakpoint
ALTER TABLE "coffee_chat_limit" ADD COLUMN IF NOT EXISTS "hackers" smallint;--> statement-breakpoint
ALTER TABLE "coffee_chat_limit" ADD COLUMN IF NOT EXISTS "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_line" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat_line" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "coffee_chat_line" ADD COLUMN IF NOT EXISTS "kind" varchar(8);--> statement-breakpoint
ALTER TABLE "coffee_chat_line" ADD COLUMN IF NOT EXISTS "added_by" varchar(255);--> statement-breakpoint
ALTER TABLE "coffee_chat_line" ADD COLUMN IF NOT EXISTS "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_placement" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_placement" ADD COLUMN IF NOT EXISTS "rep_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat_placement" ADD COLUMN IF NOT EXISTS "session_id" varchar(4);--> statement-breakpoint
ALTER TABLE "coffee_chat_placement" ADD COLUMN IF NOT EXISTS "room" varchar(8);--> statement-breakpoint
ALTER TABLE "coffee_chat_placement" ADD COLUMN IF NOT EXISTS "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_placement" ADD COLUMN IF NOT EXISTS "forced" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_placement" ADD COLUMN IF NOT EXISTS "status" "coffee_chat_placement_status" DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_placement" ADD COLUMN IF NOT EXISTS "sent_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "coffee_chat_placement" ADD COLUMN IF NOT EXISTS "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_pref" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat_pref" ADD COLUMN IF NOT EXISTS "hackers_per_chat" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_pref" ADD COLUMN IF NOT EXISTS "longer_one_on_one" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_pref" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "coffee_chat_pref" ADD COLUMN IF NOT EXISTS "shortlist_submitted_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "coffee_chat_pref" ADD COLUMN IF NOT EXISTS "updated_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_rep_session" ADD COLUMN IF NOT EXISTS "rep_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat_rep_session" ADD COLUMN IF NOT EXISTS "session_id" varchar(4);--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD COLUMN IF NOT EXISTS "name" varchar(255);--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD COLUMN IF NOT EXISTS "phone" varchar(32);--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD COLUMN IF NOT EXISTS "chats_wanted" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD COLUMN IF NOT EXISTS "max_sessions" smallint;--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD COLUMN IF NOT EXISTS "position" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD COLUMN IF NOT EXISTS "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_room_booking" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_room_booking" ADD COLUMN IF NOT EXISTS "session_id" varchar(4);--> statement-breakpoint
ALTER TABLE "coffee_chat_room_booking" ADD COLUMN IF NOT EXISTS "room" varchar(8);--> statement-breakpoint
ALTER TABLE "coffee_chat_room_booking" ADD COLUMN IF NOT EXISTS "for_sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat_room_booking" ADD COLUMN IF NOT EXISTS "label" varchar(255);--> statement-breakpoint
ALTER TABLE "coffee_chat_room_booking" ADD COLUMN IF NOT EXISTS "note" varchar(255);--> statement-breakpoint
ALTER TABLE "coffee_chat_room_booking" ADD COLUMN IF NOT EXISTS "created_by" varchar(255);--> statement-breakpoint
ALTER TABLE "coffee_chat_room_booking" ADD COLUMN IF NOT EXISTS "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "room" varchar(64);--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "slot_time" varchar(5);--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "duration_minutes" smallint DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "status" "coffee_chat_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "rep_name" varchar(255);--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "placement_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "round" smallint;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "expires_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "source" varchar(16);--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "responded_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "notified_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "reminder_key" varchar(64);--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "recipient_name" varchar(32);--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "slack_user_id" varchar(32);--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "post_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "task_ids" text[];--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "text" text;--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "route_key" varchar(64);--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "slack_channel" varchar(32);--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "scheduled_message_id" varchar(64);--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "status" "marketing_notification_status";--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "error" varchar(255);--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "marketing_notification_reminder" ADD COLUMN IF NOT EXISTS "updated_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_final_pick" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "sponsor_final_pick" ADD COLUMN IF NOT EXISTS "team_ids" varchar(12)[];--> statement-breakpoint
ALTER TABLE "sponsor_final_pick" ADD COLUMN IF NOT EXISTS "submitted_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_final_pick" ADD COLUMN IF NOT EXISTS "sheet_synced_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "reason" varchar(32);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "note" varchar(500);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "location" varchar(255);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "rep_name" varchar(80);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "phone" varchar(32);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "location_note" varchar(120);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "status" "sponsor_help_status" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "slack_channel" varchar(64);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "slack_ts" varchar(32);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "claimed_by_slack_id" varchar(64);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "claimed_by_name" varchar(255);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "ping_count" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "sponsor_help_request" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "sponsor_interest" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "sponsor_interest" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "sponsor_interest" ADD COLUMN IF NOT EXISTS "rank" smallint;--> statement-breakpoint
ALTER TABLE "sponsor_interest" ADD COLUMN IF NOT EXISTS "updated_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_judging_room" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "sponsor_judging_room" ADD COLUMN IF NOT EXISTS "room" varchar(64);--> statement-breakpoint
ALTER TABLE "sponsor_judging_room" ADD COLUMN IF NOT EXISTS "updated_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_judging_setting" ADD COLUMN IF NOT EXISTS "id" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_judging_setting" ADD COLUMN IF NOT EXISTS "round2_opened_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "sponsor_judging_setting" ADD COLUMN IF NOT EXISTS "updated_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_presentation_confirm" ADD COLUMN IF NOT EXISTS "team_id" varchar(12);--> statement-breakpoint
ALTER TABLE "sponsor_presentation_confirm" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "sponsor_presentation_confirm" ADD COLUMN IF NOT EXISTS "via" varchar(8);--> statement-breakpoint
ALTER TABLE "sponsor_presentation_confirm" ADD COLUMN IF NOT EXISTS "slots_key" text;--> statement-breakpoint
ALTER TABLE "sponsor_presentation_confirm" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_presentation_notice" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "sponsor_presentation_notice" ADD COLUMN IF NOT EXISTS "team_id" varchar(12);--> statement-breakpoint
ALTER TABLE "sponsor_presentation_notice" ADD COLUMN IF NOT EXISTS "status" varchar(16);--> statement-breakpoint
ALTER TABLE "sponsor_presentation_notice" ADD COLUMN IF NOT EXISTS "slots_key" text;--> statement-breakpoint
ALTER TABLE "sponsor_presentation_notice" ADD COLUMN IF NOT EXISTS "claimed_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_presentation_notice" ADD COLUMN IF NOT EXISTS "sent_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "sponsor_presentation" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "sponsor_presentation" ADD COLUMN IF NOT EXISTS "team_id" varchar(12);--> statement-breakpoint
ALTER TABLE "sponsor_presentation" ADD COLUMN IF NOT EXISTS "room" varchar(64);--> statement-breakpoint
ALTER TABLE "sponsor_presentation" ADD COLUMN IF NOT EXISTS "start_minute" smallint;--> statement-breakpoint
ALTER TABLE "sponsor_presentation" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_scan" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "sponsor_scan" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "sponsor_scan" ADD COLUMN IF NOT EXISTS "rep_name" varchar(255);--> statement-breakpoint
ALTER TABLE "sponsor_scan" ADD COLUMN IF NOT EXISTS "scanned_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_shortlist_send" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "sponsor_shortlist_send" ADD COLUMN IF NOT EXISTS "team_ids" varchar(12)[];--> statement-breakpoint
ALTER TABLE "sponsor_shortlist_send" ADD COLUMN IF NOT EXISTS "sent_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_shortlist" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "sponsor_shortlist" ADD COLUMN IF NOT EXISTS "user_id" varchar(255);--> statement-breakpoint
ALTER TABLE "sponsor_shortlist" ADD COLUMN IF NOT EXISTS "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_team_review" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "sponsor_team_review" ADD COLUMN IF NOT EXISTS "team_id" varchar(12);--> statement-breakpoint
ALTER TABLE "sponsor_team_review" ADD COLUMN IF NOT EXISTS "score" smallint;--> statement-breakpoint
ALTER TABLE "sponsor_team_review" ADD COLUMN IF NOT EXISTS "shortlisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_team_review" ADD COLUMN IF NOT EXISTS "note" varchar(280);--> statement-breakpoint
ALTER TABLE "sponsor_team_review" ADD COLUMN IF NOT EXISTS "updated_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_team_score" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "sponsor_team_score" ADD COLUMN IF NOT EXISTS "team_id" varchar(12);--> statement-breakpoint
ALTER TABLE "sponsor_team_score" ADD COLUMN IF NOT EXISTS "judge_name" varchar(255);--> statement-breakpoint
ALTER TABLE "sponsor_team_score" ADD COLUMN IF NOT EXISTS "score_halves" smallint;--> statement-breakpoint
ALTER TABLE "sponsor_team_score" ADD COLUMN IF NOT EXISTS "updated_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_top5_draft" ADD COLUMN IF NOT EXISTS "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "sponsor_top5_draft" ADD COLUMN IF NOT EXISTS "team_ids" varchar(12)[];--> statement-breakpoint
ALTER TABLE "sponsor_top5_draft" ADD COLUMN IF NOT EXISTS "updated_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "task_owner_contact" ADD COLUMN IF NOT EXISTS "owner_key" varchar(255);--> statement-breakpoint
ALTER TABLE "task_owner_contact" ADD COLUMN IF NOT EXISTS "owner_name" varchar(255);--> statement-breakpoint
ALTER TABLE "task_owner_contact" ADD COLUMN IF NOT EXISTS "slack_email" varchar(255);--> statement-breakpoint
ALTER TABLE "task_owner_contact" ADD COLUMN IF NOT EXISTS "slack_user_id" varchar(32);--> statement-breakpoint
ALTER TABLE "task_owner_contact" ADD COLUMN IF NOT EXISTS "looked_up_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "task_owner_contact" ADD COLUMN IF NOT EXISTS "updated_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "task_reminder_sync" ADD COLUMN IF NOT EXISTS "id" varchar(32);--> statement-breakpoint
ALTER TABLE "task_reminder_sync" ADD COLUMN IF NOT EXISTS "tasks_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "task_reminder_sync" ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "task_reminder_sync" ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "task_key" varchar(64);--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "owner" varchar(255);--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "task" text;--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "slack_user_id" varchar(32);--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "post_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "slack_channel" varchar(32);--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "scheduled_message_id" varchar(64);--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "route_key" varchar(64);--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "status" "task_reminder_status";--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "error" varchar(255);--> statement-breakpoint
ALTER TABLE "task_reminder" ADD COLUMN IF NOT EXISTS "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint

ALTER TABLE "sponsor_judging_sponsor" ADD COLUMN IF NOT EXISTS "coffee_chat_reps" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_judging_sponsor" ADD COLUMN IF NOT EXISTS "coffee_chat_style" varchar(16);--> statement-breakpoint
ALTER TABLE "sponsor_judging_sponsor" ADD COLUMN IF NOT EXISTS "coffee_chat_per_slot" smallint;--> statement-breakpoint
ALTER TABLE "sponsor_judging_sponsor" ADD COLUMN IF NOT EXISTS "coffee_chat_room" varchar(64);--> statement-breakpoint
ALTER TABLE "sponsor_judging_sponsor" ADD COLUMN IF NOT EXISTS "coffee_chat_watcher" varchar(255);--> statement-breakpoint
ALTER TABLE "sponsor_judging_sponsor" ADD COLUMN IF NOT EXISTS "portal_link_given_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "slack_email" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "notifications_seen" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_hold" ADD CONSTRAINT "coffee_chat_hold_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_hold" ADD CONSTRAINT "coffee_chat_hold_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_limit" ADD CONSTRAINT "coffee_chat_limit_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_line" ADD CONSTRAINT "coffee_chat_line_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_line" ADD CONSTRAINT "coffee_chat_line_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_line" ADD CONSTRAINT "coffee_chat_line_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_placement" ADD CONSTRAINT "coffee_chat_placement_rep_id_coffee_chat_rep_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."coffee_chat_rep"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_pref" ADD CONSTRAINT "coffee_chat_pref_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_rep_session" ADD CONSTRAINT "coffee_chat_rep_session_rep_id_coffee_chat_rep_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."coffee_chat_rep"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_rep" ADD CONSTRAINT "coffee_chat_rep_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_room_booking" ADD CONSTRAINT "coffee_chat_room_booking_for_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("for_sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat_room_booking" ADD CONSTRAINT "coffee_chat_room_booking_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat" ADD CONSTRAINT "coffee_chat_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat" ADD CONSTRAINT "coffee_chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "coffee_chat" ADD CONSTRAINT "coffee_chat_placement_id_coffee_chat_placement_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."coffee_chat_placement"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_final_pick" ADD CONSTRAINT "sponsor_final_pick_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_help_request" ADD CONSTRAINT "sponsor_help_request_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_interest" ADD CONSTRAINT "sponsor_interest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_interest" ADD CONSTRAINT "sponsor_interest_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_judging_room" ADD CONSTRAINT "sponsor_judging_room_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_presentation_confirm" ADD CONSTRAINT "sponsor_presentation_confirm_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_presentation_confirm" ADD CONSTRAINT "sponsor_presentation_confirm_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_presentation_notice" ADD CONSTRAINT "sponsor_presentation_notice_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_presentation_notice" ADD CONSTRAINT "sponsor_presentation_notice_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_presentation" ADD CONSTRAINT "sponsor_presentation_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_presentation" ADD CONSTRAINT "sponsor_presentation_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_scan" ADD CONSTRAINT "sponsor_scan_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_scan" ADD CONSTRAINT "sponsor_scan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_shortlist_send" ADD CONSTRAINT "sponsor_shortlist_send_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_shortlist" ADD CONSTRAINT "sponsor_shortlist_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_shortlist" ADD CONSTRAINT "sponsor_shortlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_team_review" ADD CONSTRAINT "sponsor_team_review_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_team_review" ADD CONSTRAINT "sponsor_team_review_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_team_score" ADD CONSTRAINT "sponsor_team_score_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_team_score" ADD CONSTRAINT "sponsor_team_score_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sponsor_top5_draft" ADD CONSTRAINT "sponsor_top5_draft_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coffee_chat_hold_sponsor_idx" ON "coffee_chat_hold" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coffee_chat_hold_room_idx" ON "coffee_chat_hold" USING btree ("room","start_time");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coffee_chat_limit_span_idx" ON "coffee_chat_limit" USING btree ("sponsor_id","start_time","end_time");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coffee_chat_placement_room_idx" ON "coffee_chat_placement" USING btree ("room","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coffee_chat_placement_rep_idx" ON "coffee_chat_placement" USING btree ("rep_id","session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coffee_chat_rep_sponsor_idx" ON "coffee_chat_rep" USING btree ("sponsor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coffee_chat_rep_primary_idx" ON "coffee_chat_rep" USING btree ("sponsor_id") WHERE "coffee_chat_rep"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coffee_chat_room_booking_cell_idx" ON "coffee_chat_room_booking" USING btree ("room","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coffee_chat_user_slot_active_idx" ON "coffee_chat" USING btree ("user_id","slot_time") WHERE "coffee_chat"."status" in ('pending', 'accepted');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coffee_chat_sponsor_slot_idx" ON "coffee_chat" USING btree ("sponsor_id","slot_time");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coffee_chat_user_idx" ON "coffee_chat" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coffee_chat_placement_idx" ON "coffee_chat" USING btree ("placement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_notification_post_idx" ON "marketing_notification_reminder" USING btree ("post_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_notification_status_idx" ON "marketing_notification_reminder" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_help_request_sponsor_active_idx" ON "sponsor_help_request" USING btree ("sponsor_id") WHERE "sponsor_help_request"."status" in ('open', 'claimed');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsor_help_request_slack_idx" ON "sponsor_help_request" USING btree ("slack_channel","slack_ts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsor_help_request_status_idx" ON "sponsor_help_request" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_interest_user_rank_idx" ON "sponsor_interest" USING btree ("user_id","rank");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsor_interest_sponsor_idx" ON "sponsor_interest" USING btree ("sponsor_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_judging_room_room_idx" ON "sponsor_judging_room" USING btree ("room");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsor_presentation_notice_team_idx" ON "sponsor_presentation_notice" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsor_presentation_team_idx" ON "sponsor_presentation" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsor_scan_user_idx" ON "sponsor_scan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsor_team_review_team_idx" ON "sponsor_team_review" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_reminder_key_idx" ON "task_reminder" USING btree ("task_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_reminder_status_idx" ON "task_reminder" USING btree ("status");--> statement-breakpoint
-- Older shapes: reps may ask for 0 chats (was >= 1), and coffee chat rooms are labels.
ALTER TABLE "coffee_chat_rep" DROP CONSTRAINT IF EXISTS "coffee_chat_rep_chats_check";--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD CONSTRAINT "coffee_chat_rep_chats_check" CHECK ("coffee_chat_rep"."chats_wanted" >= 0);--> statement-breakpoint
ALTER TABLE "coffee_chat" ALTER COLUMN "room" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coffee_chat' AND column_name = 'room') <> 'character varying' THEN
  ALTER TABLE "coffee_chat" ALTER COLUMN "room" SET DATA TYPE varchar(64) USING (CASE "room" WHEN 1 THEN 'Rm 2241' WHEN 2 THEN 'Rm 2242' WHEN 3 THEN 'Rm 2243' ELSE "room"::text END);
 END IF;
END $$;
