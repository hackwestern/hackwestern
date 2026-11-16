CREATE TYPE "public"."task_reminder_status" AS ENUM('scheduled', 'cancelled', 'failed', 'sent-window-passed');--> statement-breakpoint
CREATE TABLE "task_owner_contact" (
	"owner_key" varchar(255) PRIMARY KEY NOT NULL,
	"owner_name" varchar(255) NOT NULL,
	"slack_email" varchar(255),
	"slack_user_id" varchar(32),
	"looked_up_at" timestamp (3),
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_reminder_sync" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"tasks_hash" varchar(64),
	"last_synced_at" timestamp (3),
	"last_attempt_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "task_reminder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_key" varchar(64) NOT NULL,
	"owner" varchar(255) NOT NULL,
	"task" text NOT NULL,
	"slack_user_id" varchar(32),
	"post_at" timestamp (3) NOT NULL,
	"slack_channel" varchar(32),
	"scheduled_message_id" varchar(64),
	"status" "task_reminder_status" NOT NULL,
	"error" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "task_reminder_key_idx" ON "task_reminder" USING btree ("task_key");--> statement-breakpoint
CREATE INDEX "task_reminder_status_idx" ON "task_reminder" USING btree ("status");