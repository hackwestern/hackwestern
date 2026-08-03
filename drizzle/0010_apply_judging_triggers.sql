-- Mirrors src/server/db/triggers.sql, which remains the source of truth
-- (see src/server/db/triggers.ts). Drizzle's schema DSL can't express
-- triggers, so this custom migration carries the same DDL into production.
--
-- All statements are idempotent (CREATE OR REPLACE / DROP IF EXISTS), so
-- re-applying this file is safe. Statements are separated by
-- `--> statement-breakpoint` because the migrator sends each one on its own
-- and a naive split on `;` would cut the plpgsql bodies in half.

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
    UPDATE "judge" SET
      marks_sum         = marks_sum - OLD.score + NEW.score,
      marks_squared_sum = marks_squared_sum - (OLD.score * OLD.score) + (NEW.score * NEW.score)
    WHERE id = NEW.judge_id;
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
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_team_mark_stats ON "team_mark";
--> statement-breakpoint
CREATE TRIGGER trg_team_mark_stats
AFTER INSERT OR UPDATE OR DELETE ON "team_mark"
FOR EACH ROW EXECUTE FUNCTION judging_sync_judge_stats();
--> statement-breakpoint
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
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_team_mark_autoqueue ON "team_mark";
--> statement-breakpoint
CREATE TRIGGER trg_team_mark_autoqueue
AFTER INSERT ON "team_mark"
FOR EACH ROW EXECUTE FUNCTION judging_autoqueue_on_mark();
