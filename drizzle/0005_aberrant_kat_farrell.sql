CREATE TYPE "public"."judge_type" AS ENUM('organizer', 'sponsored');--> statement-breakpoint
CREATE TYPE "public"."judging_queue_status" AS ENUM('waiting', 'assigned');--> statement-breakpoint
CREATE TYPE "public"."round_type" AS ENUM('regular', 'sponsored');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'submitted', 'late');--> statement-breakpoint
CREATE TYPE "public"."track" AS ENUM('Best Use of Cohere', 'Best Use of AntiGravity', 'Best Domain', 'General');--> statement-breakpoint
CREATE TABLE "cheat_check_individual_result" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"is_of_age" boolean DEFAULT false NOT NULL,
	"github_scanner" boolean DEFAULT false NOT NULL,
	"linkedin_scanner" boolean DEFAULT false NOT NULL,
	"final_result" boolean DEFAULT false NOT NULL,
	"notes" text,
	"last_run_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheat_check_team_result" (
	"team_id" varchar(255) PRIMARY KEY NOT NULL,
	"commit_within_allotted_time" boolean DEFAULT false NOT NULL,
	"only_team_member_commits" boolean DEFAULT false NOT NULL,
	"devpost_members_are_registered" boolean DEFAULT false NOT NULL,
	"final_result" boolean DEFAULT false NOT NULL,
	"notes" text,
	"last_run_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_of_registration" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"signed_in_at" timestamp (3),
	"date_of_birth" timestamp
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
	"status" "judging_queue_status" DEFAULT 'waiting' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judging_skip" (
	"team_id" varchar(255) NOT NULL,
	"judge_id" varchar(255) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "judging_skip_team_id_judge_id_pk" PRIMARY KEY("team_id","judge_id")
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
	"id" varchar(6) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"devpost_url" varchar(2048),
	"github_url" varchar(2048),
	"submission_status" "submission_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp (3),
	"tracks" "track"[],
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application" ALTER COLUMN "github_link" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "application" ALTER COLUMN "linkedin_link" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "devpost_link" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "team_id" varchar(255);--> statement-breakpoint
ALTER TABLE "cheat_check_individual_result" ADD CONSTRAINT "cheat_check_individual_result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheat_check_team_result" ADD CONSTRAINT "cheat_check_team_result_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_of_registration" ADD CONSTRAINT "day_of_registration_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge" ADD CONSTRAINT "judge_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_queue" ADD CONSTRAINT "judging_queue_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_skip" ADD CONSTRAINT "judging_skip_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_skip" ADD CONSTRAINT "judging_skip_judge_id_judge_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_mark" ADD CONSTRAINT "team_mark_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_mark" ADD CONSTRAINT "team_mark_judge_id_judge_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cheat_check_indiv_final_idx" ON "cheat_check_individual_result" USING btree ("final_result");--> statement-breakpoint
CREATE INDEX "cheat_check_team_final_idx" ON "cheat_check_team_result" USING btree ("final_result");--> statement-breakpoint
CREATE INDEX "judging_queue_priority_idx" ON "judging_queue" USING btree ("rounds_remaining" DESC NULLS LAST,"enqueued_at");--> statement-breakpoint
CREATE INDEX "team_mark_team_idx" ON "team_mark" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_mark_judge_idx" ON "team_mark" USING btree ("judge_id");--> statement-breakpoint
CREATE INDEX "team_created_at_idx" ON "team" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_team_id_idx" ON "user" USING btree ("team_id");