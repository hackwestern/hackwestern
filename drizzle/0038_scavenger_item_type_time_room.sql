CREATE TYPE "public"."scavenger_hunt_activity_type" AS ENUM('attendance', 'win');--> statement-breakpoint
CREATE TYPE "public"."scavenger_hunt_item_type" AS ENUM('meal', 'workshop', 'sponsor_workshop', 'activity', 'bonus');--> statement-breakpoint
-- The column must exist before the primary key can use it
ALTER TABLE "scavenger_hunt_scan" ADD COLUMN "activity_type" "scavenger_hunt_activity_type" DEFAULT 'attendance' NOT NULL;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_scan" DROP CONSTRAINT "scavenger_hunt_scan_user_id_item_id_pk";--> statement-breakpoint
ALTER TABLE "scavenger_hunt_scan" ADD CONSTRAINT "scavenger_hunt_scan_user_id_item_id_activity_type_pk" PRIMARY KEY("user_id","item_id","activity_type");--> statement-breakpoint
-- type, starts_at and ends_at are added empty, filled for existing items, then made required
ALTER TABLE "scavenger_hunt_item" ADD COLUMN "type" "scavenger_hunt_item_type";--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ADD COLUMN "win_points" smallint;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ADD COLUMN "starts_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ADD COLUMN "ends_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ADD COLUMN "room" varchar(255);--> statement-breakpoint
-- Type comes from the old code suffixes. Attendance (_att) and win (_win) items become activities.
UPDATE "scavenger_hunt_item" SET "type" = CASE
  WHEN "code" LIKE '%\_meal' THEN 'meal'
  WHEN "code" LIKE '%\_ws' THEN 'workshop'
  WHEN "code" LIKE '%\_sw' THEN 'sponsor_workshop'
  WHEN "code" LIKE '%\_bonus' THEN 'bonus'
  ELSE 'activity'
END::"scavenger_hunt_item_type";--> statement-breakpoint
-- Existing items have no schedule, so they get a time before HW13 (they show as past items). Times are UTC.
UPDATE "scavenger_hunt_item" SET "starts_at" = '2026-01-01 00:00:00', "ends_at" = '2026-01-01 00:00:00';--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ALTER COLUMN "starts_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ALTER COLUMN "ends_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ADD CONSTRAINT "scavenger_hunt_item_win_points_activity_only" CHECK ("scavenger_hunt_item"."win_points" IS NULL OR "scavenger_hunt_item"."type" = 'activity');--> statement-breakpoint
-- Scavenger hunt points: refund a scan's points when the scan is deleted.
-- Mirrors section 3 of src/server/db/triggers.sql, which stays the source of
-- truth and is what the Vitest harness applies. Drizzle's schema DSL can't
-- express triggers, so this migration carries the same DDL to production.
CREATE OR REPLACE FUNCTION scavenger_hunt_refund_scan_points() RETURNS trigger AS $$
BEGIN
  UPDATE "user" u SET
    scavenger_hunt_earned = COALESCE(u.scavenger_hunt_earned, 0) - p.points,
    scavenger_hunt_balance = COALESCE(u.scavenger_hunt_balance, 0) - p.points
  FROM (
    SELECT CASE WHEN OLD.activity_type = 'win' THEN COALESCE(i.win_points, 0) ELSE i.points END AS points
    FROM scavenger_hunt_item i
    WHERE i.id = OLD.item_id
  ) p
  WHERE u.id = OLD.user_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_scavenger_hunt_scan_refund ON "scavenger_hunt_scan";
--> statement-breakpoint
CREATE TRIGGER trg_scavenger_hunt_scan_refund
AFTER DELETE ON "scavenger_hunt_scan"
FOR EACH ROW EXECUTE FUNCTION scavenger_hunt_refund_scan_points();
