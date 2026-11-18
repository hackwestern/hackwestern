ALTER TABLE "user" ADD COLUMN "slack_email" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "notifications_seen" text[] DEFAULT '{}'::text[] NOT NULL;