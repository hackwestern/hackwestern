ALTER TABLE "team" ALTER COLUMN "id" SET DATA TYPE varchar(12);--> statement-breakpoint
-- Added nullable first, then backfilled, so the migration survives a team
-- table that already has rows (a bare ADD COLUMN NOT NULL would fail).
ALTER TABLE "team" ADD COLUMN "joinCode" varchar(6);--> statement-breakpoint
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM "team" WHERE "joinCode" IS NULL LOOP
    UPDATE "team" SET "joinCode" = (
      SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32))::int + 1, 1), '')
      FROM generate_series(1, 6)
    ) WHERE id = r.id;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "team" ALTER COLUMN "joinCode" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_joinCode_unique" UNIQUE("joinCode");
