ALTER TABLE "judging_table" RENAME TO "judging_seat";--> statement-breakpoint
ALTER TABLE "judging_seat" RENAME CONSTRAINT "judging_table_pkey" TO "judging_seat_pkey";--> statement-breakpoint
ALTER SEQUENCE "judging_table_id_seq" RENAME TO "judging_seat_id_seq";--> statement-breakpoint
ALTER TABLE "judging_seat" DROP CONSTRAINT "judging_table_number_unique";--> statement-breakpoint
ALTER TABLE "judging_seat" RENAME COLUMN "number" TO "table_number";--> statement-breakpoint
ALTER TABLE "judging_seat" ADD COLUMN "seat" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "judging_seat_table_seat_idx" ON "judging_seat" USING btree ("table_number","seat");--> statement-breakpoint
ALTER TABLE "judging_seat" ADD CONSTRAINT "judging_seat_seat_check" CHECK ("judging_seat"."seat" in (1, 2));--> statement-breakpoint
ALTER TYPE "judging_table_status" RENAME TO "judging_seat_status";--> statement-breakpoint
ALTER TABLE "team" RENAME COLUMN "judging_table_id" TO "judging_seat_id";--> statement-breakpoint
ALTER TABLE "team" RENAME CONSTRAINT "team_judging_table_id_unique" TO "team_judging_seat_id_unique";--> statement-breakpoint
ALTER TABLE "team" RENAME CONSTRAINT "team_judging_table_id_judging_table_id_fk" TO "team_judging_seat_id_judging_seat_id_fk";--> statement-breakpoint
ALTER TABLE "judging_assignment" RENAME COLUMN "judging_table_id" TO "judging_seat_id";--> statement-breakpoint
ALTER TABLE "judging_assignment" RENAME CONSTRAINT "judging_assignment_judging_table_id_judging_table_id_fk" TO "judging_assignment_judging_seat_id_judging_seat_id_fk";--> statement-breakpoint
ALTER INDEX "judging_assignment_judge_table_idx" RENAME TO "judging_assignment_judge_seat_idx";--> statement-breakpoint
ALTER INDEX "judging_assignment_table_idx" RENAME TO "judging_assignment_seat_idx";--> statement-breakpoint
ALTER TABLE "judging_settings" RENAME COLUMN "judges_per_table" TO "judges_per_seat";--> statement-breakpoint
ALTER TABLE "judge" ADD COLUMN "no_show" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Status triggers move to the seat names (mirrors src/server/db/triggers.sql section 4).
DROP TRIGGER IF EXISTS trg_judging_assignment_table_status ON "judging_assignment";--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_team_judging_table_status ON "team";--> statement-breakpoint
DROP FUNCTION IF EXISTS judging_assignment_refresh_table();--> statement-breakpoint
DROP FUNCTION IF EXISTS judging_team_refresh_table();--> statement-breakpoint
DROP FUNCTION IF EXISTS judging_refresh_table_status(integer);--> statement-breakpoint
-- 4. Live seat status: keep judging_seat.status in step with who is seated
--    and where each judge's stops stand. Rules, first match wins:
--      empty         no team seated at the seat
--      being_judged  a stop at the seat is in progress
--      waiting       a stop is still assigned, or the seat has no live stops
--      finished      every live stop is done or team_absent
--    Only writes (and bumps status_updated_at) when the status changes.
CREATE OR REPLACE FUNCTION judging_refresh_seat_status(p_seat_id integer)
RETURNS void AS $$
DECLARE
  next_status judging_seat_status;
BEGIN
  IF p_seat_id IS NULL THEN
    RETURN;
  END IF;

  -- Serialize recalculations for this seat. Two judges changing stops at the
  -- same seat at once would otherwise each compute from their own snapshot
  -- and the last write could be stale. After the lock, the SELECT below sees
  -- whatever the other transaction committed.
  PERFORM 1 FROM "judging_seat" WHERE id = p_seat_id FOR UPDATE;

  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM "team" t WHERE t.judging_seat_id = p_seat_id
    ) THEN 'empty'
    WHEN EXISTS (
      SELECT 1 FROM "judging_assignment" a
      WHERE a.judging_seat_id = p_seat_id AND a.status = 'in_progress'
    ) THEN 'being_judged'
    WHEN EXISTS (
      SELECT 1 FROM "judging_assignment" a
      WHERE a.judging_seat_id = p_seat_id AND a.status = 'assigned'
    ) OR NOT EXISTS (
      SELECT 1 FROM "judging_assignment" a
      WHERE a.judging_seat_id = p_seat_id AND a.status <> 'cancelled'
    ) THEN 'waiting'
    ELSE 'finished'
  END::judging_seat_status
  INTO next_status;

  UPDATE "judging_seat"
  SET status = next_status, status_updated_at = now()
  WHERE id = p_seat_id AND status IS DISTINCT FROM next_status;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION judging_assignment_refresh_seat() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM judging_refresh_seat_status(NEW.judging_seat_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM judging_refresh_seat_status(OLD.judging_seat_id);
  ELSE
    PERFORM judging_refresh_seat_status(OLD.judging_seat_id);
    IF NEW.judging_seat_id IS DISTINCT FROM OLD.judging_seat_id THEN
      PERFORM judging_refresh_seat_status(NEW.judging_seat_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_judging_assignment_seat_status ON "judging_assignment";--> statement-breakpoint
CREATE TRIGGER trg_judging_assignment_seat_status
AFTER INSERT OR UPDATE OR DELETE ON "judging_assignment"
FOR EACH ROW EXECUTE FUNCTION judging_assignment_refresh_seat();--> statement-breakpoint
CREATE OR REPLACE FUNCTION judging_team_refresh_seat() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM judging_refresh_seat_status(NEW.judging_seat_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM judging_refresh_seat_status(OLD.judging_seat_id);
  ELSIF NEW.judging_seat_id IS DISTINCT FROM OLD.judging_seat_id THEN
    PERFORM judging_refresh_seat_status(OLD.judging_seat_id);
    PERFORM judging_refresh_seat_status(NEW.judging_seat_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_team_judging_seat_status ON "team";--> statement-breakpoint
CREATE TRIGGER trg_team_judging_seat_status
AFTER INSERT OR DELETE OR UPDATE OF judging_seat_id ON "team"
FOR EACH ROW EXECUTE FUNCTION judging_team_refresh_seat();
