CREATE TABLE "ops_ping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ping_key" varchar(64) NOT NULL,
	"task_key" varchar(64) NOT NULL,
	"kind" varchar(8) NOT NULL,
	"task" text NOT NULL,
	"owner" varchar(255) NOT NULL,
	"slack_user_id" varchar(32) NOT NULL,
	"post_at" timestamp (3) NOT NULL,
	"slack_channel" varchar(32),
	"scheduled_message_id" varchar(64),
	"route_key" varchar(64),
	"status" "task_reminder_status" NOT NULL,
	"error" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ops_ping_key_idx" ON "ops_ping" USING btree ("ping_key");--> statement-breakpoint
CREATE INDEX "ops_ping_task_idx" ON "ops_ping" USING btree ("task_key");--> statement-breakpoint
CREATE INDEX "ops_ping_status_idx" ON "ops_ping" USING btree ("status");