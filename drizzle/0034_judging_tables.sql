CREATE TYPE "public"."judging_assignment_status" AS ENUM('assigned', 'in_progress', 'done', 'team_absent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."judging_table_status" AS ENUM('empty', 'waiting', 'being_judged', 'finished');--> statement-breakpoint
ALTER TYPE "public"."user_type" ADD VALUE 'judge';--> statement-breakpoint
CREATE TABLE "judging_assignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"judge_id" varchar(255) NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"position" integer NOT NULL,
	"status" "judging_assignment_status" DEFAULT 'assigned' NOT NULL,
	"assigned_by" varchar(255),
	"assigned_at" timestamp (3) DEFAULT now() NOT NULL,
	"started_at" timestamp (3),
	"completed_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "judging_table" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"zone" varchar(64) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"status" "judging_table_status" DEFAULT 'empty' NOT NULL,
	"status_updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "judging_table_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "team_track" (
	"team_id" varchar(255) NOT NULL,
	"track" "track" NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "team_track_team_id_track_pk" PRIMARY KEY("team_id","track")
);
--> statement-breakpoint
ALTER TABLE "judge" ADD COLUMN "harshness" real;--> statement-breakpoint
ALTER TABLE "team_mark" ADD COLUMN "score_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "judging_table_id" integer;--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD CONSTRAINT "judging_assignment_judge_id_judge_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD CONSTRAINT "judging_assignment_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD CONSTRAINT "judging_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_track" ADD CONSTRAINT "team_track_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "judging_assignment_judge_position_idx" ON "judging_assignment" USING btree ("judge_id","position") WHERE "judging_assignment"."status" <> 'cancelled';--> statement-breakpoint
CREATE UNIQUE INDEX "judging_assignment_judge_team_idx" ON "judging_assignment" USING btree ("judge_id","team_id") WHERE "judging_assignment"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "judging_assignment_team_idx" ON "judging_assignment" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_track_track_idx" ON "team_track" USING btree ("track");--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_judging_table_id_judging_table_id_fk" FOREIGN KEY ("judging_table_id") REFERENCES "public"."judging_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_judging_table_id_unique" UNIQUE("judging_table_id");--> statement-breakpoint
-- Backfill team_track from the existing team.tracks arrays.
INSERT INTO "team_track" ("team_id", "track")
SELECT DISTINCT t.id, unnest(t.tracks) FROM "team" t WHERE t.tracks IS NOT NULL
ON CONFLICT DO NOTHING;
