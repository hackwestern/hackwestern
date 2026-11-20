-- Judging triggers.
--
-- Drizzle's schema DSL can't express triggers, so they live here. This file
-- is the source of truth: it is applied by the production migrations
-- (drizzle/0013_apply_judging_triggers.sql, 0038 for the scavenger hunt
-- refund trigger, and 0039 for the table status triggers below) AND by the
-- Vitest harness (see src/server/db/triggers.ts -> applyTriggers), so the
-- tests exercise the real triggers rather than a mock.
--
-- If you change anything below, add a new custom migration carrying the same
-- DDL (`npx drizzle-kit generate --custom`) — editing this file alone only
-- updates the tests.
--
-- All statements are idempotent (CREATE OR REPLACE / DROP IF EXISTS) so the
-- file can be re-applied safely.

-- 1. Stat maintenance: keep each judge's running aggregates correct as marks
--    are inserted, edited, or deleted. This is what lets editTeamMark and
--    deleteTeamMark stay correct with zero application code.
CREATE OR REPLACE FUNCTION judging_sync_judge_stats() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE "judge" SET
      marks_count       = marks_count + 1,
      marks_sum         = marks_sum + NEW.score,
      marks_squared_sum = marks_squared_sum + (NEW.score * NEW.score)
    WHERE id = NEW.judge_id;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.judge_id <> OLD.judge_id THEN
      -- The mark moved between judges, so this is a delete from one and an
      -- insert into the other rather than a score delta. Treating it as a delta
      -- would leave the old judge still counting the mark and the new judge
      -- never gaining it — and marks_count, which no score arithmetic touches,
      -- would be wrong for both. Reassignment shouldn't happen through the
      -- application, but admin SQL can do it, and the aggregates are the only
      -- record of a judge's distribution.
      UPDATE "judge" SET
        marks_count       = marks_count - 1,
        marks_sum         = marks_sum - OLD.score,
        marks_squared_sum = marks_squared_sum - (OLD.score * OLD.score)
      WHERE id = OLD.judge_id;

      UPDATE "judge" SET
        marks_count       = marks_count + 1,
        marks_sum         = marks_sum + NEW.score,
        marks_squared_sum = marks_squared_sum + (NEW.score * NEW.score)
      WHERE id = NEW.judge_id;
    ELSE
      UPDATE "judge" SET
        marks_sum         = marks_sum - OLD.score + NEW.score,
        marks_squared_sum = marks_squared_sum - (OLD.score * OLD.score) + (NEW.score * NEW.score)
      WHERE id = NEW.judge_id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE "judge" SET
      marks_count       = marks_count - 1,
      marks_sum         = marks_sum - OLD.score,
      marks_squared_sum = marks_squared_sum - (OLD.score * OLD.score)
    WHERE id = OLD.judge_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_mark_stats ON "team_mark";
CREATE TRIGGER trg_team_mark_stats
AFTER INSERT OR UPDATE OR DELETE ON "team_mark"
FOR EACH ROW EXECUTE FUNCTION judging_sync_judge_stats();

-- 2. Retired: the auto-queue trigger. Judging now runs on fixed table
--    sections (judging_assignment), so drop it wherever it still exists.
DROP TRIGGER IF EXISTS trg_team_mark_autoqueue ON "team_mark";
DROP FUNCTION IF EXISTS judging_autoqueue_on_mark();

-- 3. Scavenger hunt points: when a scan is deleted, take its item's points back
--    off the hacker's earned and balance totals. recordScan adds the points in
--    application code when a scan is inserted. The balance can go below zero.
--    Win scans refund the item's win_points, attendance scans its points.
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

DROP TRIGGER IF EXISTS trg_scavenger_hunt_scan_refund ON "scavenger_hunt_scan";
CREATE TRIGGER trg_scavenger_hunt_scan_refund
AFTER DELETE ON "scavenger_hunt_scan"
FOR EACH ROW EXECUTE FUNCTION scavenger_hunt_refund_scan_points();

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
$$ LANGUAGE plpgsql;

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_judging_assignment_seat_status ON "judging_assignment";
CREATE TRIGGER trg_judging_assignment_seat_status
AFTER INSERT OR UPDATE OR DELETE ON "judging_assignment"
FOR EACH ROW EXECUTE FUNCTION judging_assignment_refresh_seat();

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_judging_seat_status ON "team";
CREATE TRIGGER trg_team_judging_seat_status
AFTER INSERT OR DELETE OR UPDATE OF judging_seat_id ON "team"
FOR EACH ROW EXECUTE FUNCTION judging_team_refresh_seat();
