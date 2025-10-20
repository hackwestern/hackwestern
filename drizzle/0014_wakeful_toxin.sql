ALTER TABLE "hw_application" ALTER COLUMN "attended" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "hw_application" ALTER COLUMN "attended" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hw_application" ALTER COLUMN "num_of_hackathons" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "hw_application" ALTER COLUMN "num_of_hackathons" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hw_application" ALTER COLUMN "canvas_data" SET DEFAULT '{"paths":[],"timestamp":0,"version":""}'::jsonb;--> statement-breakpoint
ALTER TABLE "hw_application" ALTER COLUMN "canvas_data" SET NOT NULL;