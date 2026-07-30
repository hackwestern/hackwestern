ALTER TABLE "preregistration" ADD COLUMN "unsubscribe_token" varchar(64);--> statement-breakpoint
ALTER TABLE "preregistration" ADD COLUMN "unsubscribed_at" timestamp (3);--> statement-breakpoint
UPDATE "preregistration" SET "unsubscribe_token" = md5(random()::text || clock_timestamp()::text || id::text) WHERE "unsubscribe_token" IS NULL;--> statement-breakpoint
ALTER TABLE "preregistration" ADD CONSTRAINT "preregistration_unsubscribe_token_unique" UNIQUE("unsubscribe_token");