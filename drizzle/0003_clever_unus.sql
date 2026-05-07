CREATE TYPE "public"."judging_assignment_status" AS ENUM('PENDING', 'SCORED', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "judging_assignment" (
	"id" serial PRIMARY KEY NOT NULL,
	"judge_id" varchar(255) NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"status" "judging_assignment_status" DEFAULT 'PENDING' NOT NULL,
	"score" real,
	"normalized_score" real,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judging_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"expected_judges_per_team" integer DEFAULT 3 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"tracks" varchar(255)[],
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_judge" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "team_id" varchar(255);--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD CONSTRAINT "judging_assignment_judge_id_user_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD CONSTRAINT "judging_assignment_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ja_judge_idx" ON "judging_assignment" USING btree ("judge_id");--> statement-breakpoint
CREATE INDEX "ja_team_idx" ON "judging_assignment" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public"."application" ALTER COLUMN "year_of_study" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."year_of_study";--> statement-breakpoint
CREATE TYPE "public"."year_of_study" AS ENUM('1st', '2nd', '3rd', '4th', '5th+', 'N/A', 'Prefer not to answer');--> statement-breakpoint
ALTER TABLE "public"."application" ALTER COLUMN "year_of_study" SET DATA TYPE "public"."year_of_study" USING "year_of_study"::"public"."year_of_study";--> statement-breakpoint
CREATE VIEW "public"."judge_stats" AS (select "user"."id", "user"."name", count(case when "judging_assignment"."status" = 'SCORED' then 1 end)::int as "assignments_completed", count(case when "judging_assignment"."status" = 'PENDING' then 1 end)::int as "assignments_pending", avg("judging_assignment"."score") as "average_score_given" from "user" left join "judging_assignment" on "user"."id" = "judging_assignment"."judge_id" where "user"."is_judge" = true group by "user"."id");--> statement-breakpoint
CREATE VIEW "public"."team_judging_stats" AS (select "team"."id", "team"."name", "team"."tracks", count(case when "judging_assignment"."status" = 'SCORED' then 1 end)::int as "judge_count", sum("judging_assignment"."score") as "total_raw_score", sum("judging_assignment"."normalized_score") as "final_score" from "team" left join "judging_assignment" on "team"."id" = "judging_assignment"."team_id" group by "team"."id");