ALTER TABLE "hw11_review" RENAME COLUMN "question1_rating" TO "originality_rating";--> statement-breakpoint
ALTER TABLE "hw11_review" RENAME COLUMN "question2_rating" TO "technicality_rating";--> statement-breakpoint
ALTER TABLE "hw11_review" RENAME COLUMN "question3_rating" TO "passion_rating";--> statement-breakpoint
ALTER TABLE "hw11_review" ADD COLUMN "comments" text;--> statement-breakpoint
ALTER TABLE "hw11_review" DROP COLUMN IF EXISTS "resume_bonus";--> statement-breakpoint
ALTER TABLE "hw11_review" DROP COLUMN IF EXISTS "github_bonus";--> statement-breakpoint
ALTER TABLE "hw11_review" DROP COLUMN IF EXISTS "linkedin_bonus";--> statement-breakpoint
ALTER TABLE "hw11_review" DROP COLUMN IF EXISTS "otherlink_bonus";