ALTER TABLE "user" ADD COLUMN "hacker_id" varchar(64);--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_hacker_id_unique" UNIQUE("hacker_id");