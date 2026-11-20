CREATE TYPE "public"."marketing_notification_status" AS ENUM('scheduled', 'cancelled', 'failed', 'sent-window-passed');--> statement-breakpoint
CREATE TABLE "marketing_notification_reminder" (
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
CREATE INDEX "marketing_notification_post_idx" ON "marketing_notification_reminder" USING btree ("post_at");--> statement-breakpoint
CREATE INDEX "marketing_notification_status_idx" ON "marketing_notification_reminder" USING btree ("status");