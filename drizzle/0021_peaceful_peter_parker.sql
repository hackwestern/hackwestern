ALTER TABLE "user" ADD COLUMN "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
-- Accounts from before this column existed have no real creation time, so they
-- are all stamped 2026-10-03 10:00 ET (14:00 UTC, the column is UTC). New rows
-- get now() from the default.
UPDATE "user" SET "created_at" = '2026-10-03 14:00:00';
