CREATE TYPE "public"."judging_assignment_status" AS ENUM('assigned', 'in_progress', 'done', 'team_absent', 'cancelled');--> statement-breakpoint
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
	CONSTRAINT "judging_table_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "judge" ADD COLUMN "harshness" real;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "judging_table_id" integer;--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD CONSTRAINT "judging_assignment_judge_id_judge_id_fk" FOREIGN KEY ("judge_id") REFERENCES "public"."judge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD CONSTRAINT "judging_assignment_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD CONSTRAINT "judging_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "judging_assignment_judge_position_idx" ON "judging_assignment" USING btree ("judge_id","position") WHERE "judging_assignment"."status" <> 'cancelled';--> statement-breakpoint
CREATE UNIQUE INDEX "judging_assignment_judge_team_idx" ON "judging_assignment" USING btree ("judge_id","team_id") WHERE "judging_assignment"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "judging_assignment_team_idx" ON "judging_assignment" USING btree ("team_id");--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_judging_table_id_judging_table_id_fk" FOREIGN KEY ("judging_table_id") REFERENCES "public"."judging_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_judging_table_id_unique" UNIQUE("judging_table_id");