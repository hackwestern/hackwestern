ALTER TABLE "team" ALTER COLUMN "id" SET DATA TYPE varchar(12);--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "joinCode" varchar(6) NOT NULL;