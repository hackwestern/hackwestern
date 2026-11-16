CREATE TYPE "public"."sponsor_help_status" AS ENUM('open', 'claimed', 'resolved', 'cancelled');--> statement-breakpoint
CREATE TABLE "sponsor_help_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"reason" varchar(32) NOT NULL,
	"note" varchar(500),
	"location" varchar(255),
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
ALTER TABLE "sponsor_help_request" ADD CONSTRAINT "sponsor_help_request_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sponsor_help_request_sponsor_active_idx" ON "sponsor_help_request" USING btree ("sponsor_id") WHERE "sponsor_help_request"."status" in ('open', 'claimed');--> statement-breakpoint
CREATE INDEX "sponsor_help_request_slack_idx" ON "sponsor_help_request" USING btree ("slack_channel","slack_ts");--> statement-breakpoint
CREATE INDEX "sponsor_help_request_status_idx" ON "sponsor_help_request" USING btree ("status");