CREATE TYPE "public"."hacker_check_type" AS ENUM('IS_OF_AGE', 'IS_REGISTERED');--> statement-breakpoint
CREATE TYPE "public"."team_check_type" AS ENUM('COMMIT_WITHIN_ALLOTTED_TIME', 'ONLY_TEAM_MEMBER_COMMITS', 'DEVPOST_MEMBERS_REGISTERED');--> statement-breakpoint
CREATE TABLE "hacker_check_result" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"check_type" "hacker_check_type" NOT NULL,
	"passed" boolean NOT NULL,
	"details" jsonb NOT NULL,
	"checked_at" timestamp (3) DEFAULT now() NOT NULL,
	"checked_by_user_id" varchar(255) NOT NULL,
	"manual_override" boolean,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "team_check_result" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"check_type" "team_check_type" NOT NULL,
	"passed" boolean NOT NULL,
	"details" jsonb NOT NULL,
	"checked_at" timestamp (3) DEFAULT now() NOT NULL,
	"checked_by_user_id" varchar(255) NOT NULL,
	"manual_override" boolean,
	"notes" text
);
--> statement-breakpoint
DROP TABLE "cheat_check_individual_result" CASCADE;--> statement-breakpoint
DROP TABLE "cheat_check_team_result" CASCADE;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "member_github_usernames" text[];--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "member_devpost_usernames" text[];--> statement-breakpoint
ALTER TABLE "hacker_check_result" ADD CONSTRAINT "hacker_check_result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hacker_check_result" ADD CONSTRAINT "hacker_check_result_checked_by_user_id_user_id_fk" FOREIGN KEY ("checked_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_check_result" ADD CONSTRAINT "team_check_result_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_check_result" ADD CONSTRAINT "team_check_result_checked_by_user_id_user_id_fk" FOREIGN KEY ("checked_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hacker_check_user_idx" ON "hacker_check_result" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "hacker_check_unique_idx" ON "hacker_check_result" USING btree ("user_id","check_type");--> statement-breakpoint
CREATE INDEX "team_check_team_idx" ON "team_check_result" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_check_unique_idx" ON "team_check_result" USING btree ("team_id","check_type");