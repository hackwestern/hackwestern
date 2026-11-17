-- Judging triggers.
--
-- Drizzle's schema DSL can't express triggers, so they live here. This file
-- is the source of truth: it is applied by the production migration
-- (drizzle/0013_apply_judging_triggers.sql) AND by the Vitest harness (see
-- src/server/db/triggers.ts -> applyTriggers), so the tests exercise the real
-- triggers rather than a mock.
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

-- 2. Auto-queue: when a mark lands, advance the team's queue accounting and
--    remove it from the queue once it has been seen by enough judges. This is
--    the "auto queue" functional requirement, enforced in the database.
CREATE OR REPLACE FUNCTION judging_autoqueue_on_mark() RETURNS trigger AS $$
BEGIN
  UPDATE "judging_queue" SET
    seen_judges      = seen_judges + 1,
    rounds_remaining = rounds_remaining - 1,
    current_judge_id = NULL,
    status           = 'waiting'
  WHERE team_id = NEW.team_id;

  DELETE FROM "judging_queue"
  WHERE team_id = NEW.team_id AND rounds_remaining <= 0;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_team_mark_autoqueue ON "team_mark";
CREATE TRIGGER trg_team_mark_autoqueue
AFTER INSERT ON "team_mark"
FOR EACH ROW EXECUTE FUNCTION judging_autoqueue_on_mark();

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
