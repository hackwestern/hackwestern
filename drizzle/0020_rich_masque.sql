CREATE TYPE "public"."judging_assignment_status" AS ENUM('scheduled', 'team_absent', 'reassigned');--> statement-breakpoint
CREATE TYPE "public"."judging_round_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "judging_assignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"judge_id" varchar(255) NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"slot" integer NOT NULL,
	"status" "judging_assignment_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judging_round" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"status" "judging_round_status" DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp (3) NOT NULL,
	"slot_minutes" integer NOT NULL,
	"slot_count" integer DEFAULT 6 NOT NULL,
	"judges_per_team" integer DEFAULT 3 NOT NULL,
	"published_at" timestamp (3),
	CONSTRAINT "judging_round_singleton" CHECK ("judging_round"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "judging_table" (
	"id" serial PRIMARY KEY NOT NULL,
	"number" integer NOT NULL,
	"zone" varchar(64) NOT NULL,
	"walk_order" integer NOT NULL,
	"map_x" integer NOT NULL,
	"map_y" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "judging_table_number_unique" UNIQUE("number"),
	CONSTRAINT "judging_table_walk_order_unique" UNIQUE("walk_order")
);
--> statement-breakpoint
CREATE TABLE "sponsor_pitch" (
	"track" "track" NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"rank" integer NOT NULL,
	"submitted_by" varchar(255),
	"starts_at" timestamp (3),
	"ends_at" timestamp (3),
	"notified_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_pitch_track_team_id_pk" PRIMARY KEY("track","team_id")
);
--> statement-breakpoint
CREATE TABLE "sponsor_room" (
	"track" "track" PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(255),
	"slot_minutes" integer NOT NULL,
	"judges_notified_at" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "judge" ADD COLUMN "harshness" real;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "judging_table_id" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "slack_id" varchar(32);--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD CONSTRAINT "judging_assignment_judge_id_judge_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD CONSTRAINT "judging_assignment_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_pitch" ADD CONSTRAINT "sponsor_pitch_track_sponsor_room_track_fk" FOREIGN KEY ("track") REFERENCES "public"."sponsor_room"("track") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_pitch" ADD CONSTRAINT "sponsor_pitch_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_pitch" ADD CONSTRAINT "sponsor_pitch_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "judging_assignment_judge_slot_idx" ON "judging_assignment" USING btree ("judge_id","slot") WHERE "judging_assignment"."status" <> 'reassigned';--> statement-breakpoint
CREATE UNIQUE INDEX "judging_assignment_judge_team_idx" ON "judging_assignment" USING btree ("judge_id","team_id") WHERE "judging_assignment"."status" <> 'reassigned';--> statement-breakpoint
CREATE INDEX "judging_assignment_team_idx" ON "judging_assignment" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "sponsor_pitch_team_idx" ON "sponsor_pitch" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_judging_table_id_judging_table_id_fk" FOREIGN KEY ("judging_table_id") REFERENCES "public"."judging_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_judging_table_id_unique" UNIQUE("judging_table_id");