-- Judging engine: fixed table sections replace the auto-queue.
--
-- Hand-edited after `drizzle-kit generate`:
--   * drops the auto-queue trigger + function (dropping judging_queue alone
--     would leave a trigger on team_mark that fails on the next insert),
--   * clears old team-based judging_assignment rows before the NOT NULL column,
--   * renames the cheat_sweep_trigger enum value instead of recreating the type,
--   * inserts the default judging_settings row,
--   * adds the judging_table.status triggers (mirrors src/server/db/triggers.sql,
--     which stays the source of truth) and refreshes every table's status.

DROP TRIGGER IF EXISTS trg_team_mark_autoqueue ON "team_mark";
--> statement-breakpoint
DROP FUNCTION IF EXISTS judging_autoqueue_on_mark();
--> statement-breakpoint
CREATE TABLE "judging_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"table_count" integer DEFAULT 70 NOT NULL,
	"rows" integer DEFAULT 5 NOT NULL,
	"judges_per_table" integer DEFAULT 3 NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "judging_settings_singleton" CHECK ("judging_settings"."id" = 1)
);
--> statement-breakpoint
-- Start with the default layout (70 tables, 5 rows, 3 judges per table), so the
-- settings row that judging writes lock on always exists.
INSERT INTO "judging_settings" DEFAULT VALUES ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "judging_queue" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "judging_skip" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "judging_queue" CASCADE;--> statement-breakpoint
DROP TABLE "judging_skip" CASCADE;--> statement-breakpoint
ALTER TABLE "judging_assignment" DROP CONSTRAINT "judging_assignment_team_id_team_id_fk";
--> statement-breakpoint
DROP INDEX "judging_assignment_judge_team_idx";--> statement-breakpoint
DROP INDEX "judging_assignment_team_idx";--> statement-breakpoint
ALTER TABLE "judge" ADD COLUMN "created_at" timestamp (3) DEFAULT now() NOT NULL;--> statement-breakpoint
-- Stops now point at tables, not teams. Nothing wrote team-based stops on
-- main, but clear any so the NOT NULL column below can be added.
DELETE FROM "judging_assignment";--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD COLUMN "judging_table_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "judging_assignment" ADD CONSTRAINT "judging_assignment_judging_table_id_judging_table_id_fk" FOREIGN KEY ("judging_table_id") REFERENCES "public"."judging_table"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "judging_assignment_judge_table_idx" ON "judging_assignment" USING btree ("judge_id","judging_table_id") WHERE "judging_assignment"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "judging_assignment_table_idx" ON "judging_assignment" USING btree ("judging_table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "judging_assignment_one_in_progress_idx" ON "judging_assignment" USING btree ("judge_id") WHERE "judging_assignment"."status" = 'in_progress';--> statement-breakpoint
ALTER TABLE "judging_assignment" DROP COLUMN "team_id";--> statement-breakpoint
-- Rename in place so existing sweep rows keep their (renamed) value; recreating
-- the type would fail to cast 'queue_drain' rows.
ALTER TYPE "public"."cheat_sweep_trigger" RENAME VALUE 'queue_drain' TO 'judging_complete';--> statement-breakpoint
DROP TYPE "public"."judging_queue_status";
--> statement-breakpoint
-- 4. Live table status: keep judging_table.status in step with who is seated
--    and where each judge's stops stand. Rules, first match wins:
--      empty         no team seated at the table
--      being_judged  a stop at the table is in progress
--      waiting       a stop is still assigned, or the table has no live stops
--      finished      every live stop is done or team_absent
--    Only writes (and bumps status_updated_at) when the status changes.
CREATE OR REPLACE FUNCTION judging_refresh_table_status(p_table_id integer)
RETURNS void AS $$
DECLARE
  next_status judging_table_status;
BEGIN
  IF p_table_id IS NULL THEN
    RETURN;
  END IF;

  -- Serialize recalculations for this table. Two judges changing stops at the
  -- same table at once would otherwise each compute from their own snapshot
  -- and the last write could be stale. After the lock, the SELECT below sees
  -- whatever the other transaction committed.
  PERFORM 1 FROM "judging_table" WHERE id = p_table_id FOR UPDATE;

  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM "team" t WHERE t.judging_table_id = p_table_id
    ) THEN 'empty'
    WHEN EXISTS (
      SELECT 1 FROM "judging_assignment" a
      WHERE a.judging_table_id = p_table_id AND a.status = 'in_progress'
    ) THEN 'being_judged'
    WHEN EXISTS (
      SELECT 1 FROM "judging_assignment" a
      WHERE a.judging_table_id = p_table_id AND a.status = 'assigned'
    ) OR NOT EXISTS (
      SELECT 1 FROM "judging_assignment" a
      WHERE a.judging_table_id = p_table_id AND a.status <> 'cancelled'
    ) THEN 'waiting'
    ELSE 'finished'
  END::judging_table_status
  INTO next_status;

  UPDATE "judging_table"
  SET status = next_status, status_updated_at = now()
  WHERE id = p_table_id AND status IS DISTINCT FROM next_status;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION judging_assignment_refresh_table() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM judging_refresh_table_status(NEW.judging_table_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM judging_refresh_table_status(OLD.judging_table_id);
  ELSE
    PERFORM judging_refresh_table_status(OLD.judging_table_id);
    IF NEW.judging_table_id IS DISTINCT FROM OLD.judging_table_id THEN
      PERFORM judging_refresh_table_status(NEW.judging_table_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_judging_assignment_table_status ON "judging_assignment";
--> statement-breakpoint
CREATE TRIGGER trg_judging_assignment_table_status
AFTER INSERT OR UPDATE OR DELETE ON "judging_assignment"
FOR EACH ROW EXECUTE FUNCTION judging_assignment_refresh_table();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION judging_team_refresh_table() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM judging_refresh_table_status(NEW.judging_table_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM judging_refresh_table_status(OLD.judging_table_id);
  ELSIF NEW.judging_table_id IS DISTINCT FROM OLD.judging_table_id THEN
    PERFORM judging_refresh_table_status(OLD.judging_table_id);
    PERFORM judging_refresh_table_status(NEW.judging_table_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_team_judging_table_status ON "team";
--> statement-breakpoint
CREATE TRIGGER trg_team_judging_table_status
AFTER INSERT OR DELETE OR UPDATE OF judging_table_id ON "team"
FOR EACH ROW EXECUTE FUNCTION judging_team_refresh_table();
--> statement-breakpoint
-- Bring every existing table's status in line with the new rules.
SELECT judging_refresh_table_status(id) FROM "judging_table";
