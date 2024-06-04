CREATE TABLE IF NOT EXISTS "hw11_review" (
	"reviewer_user_id" varchar(255) NOT NULL,
	"applicant_user_id" varchar(255) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"question1_rating" smallint DEFAULT 0,
	"question2_rating" smallint DEFAULT 0,
	"question3_rating" smallint DEFAULT 0,
	"resume_bonus" smallint DEFAULT 0,
	"github_bonus" smallint DEFAULT 0,
	"linkedin_bonus" smallint DEFAULT 0,
	"otherlink_bonus" smallint DEFAULT 0,
	"referall" boolean,
	CONSTRAINT "hw11_review_reviewer_user_id_applicant_user_id_pk" PRIMARY KEY("reviewer_user_id","applicant_user_id")
);
--> statement-breakpoint
ALTER TABLE "hw11_application" RENAME COLUMN "idea_to_life" TO "question1";--> statement-breakpoint
ALTER TABLE "hw11_application" RENAME COLUMN "interest_and_passions" TO "question2";--> statement-breakpoint
ALTER TABLE "hw11_application" RENAME COLUMN "technology_inspires" TO "question3";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hw11_review" ADD CONSTRAINT "hw11_review_reviewer_user_id_hw11_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."hw11_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hw11_review" ADD CONSTRAINT "hw11_review_applicant_user_id_hw11_application_user_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."hw11_application"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hw11_review" ADD CONSTRAINT "hw11_review_applicant_user_id_hw11_user_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."hw11_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applicant_user_id_idx" ON "hw11_review" ("applicant_user_id");