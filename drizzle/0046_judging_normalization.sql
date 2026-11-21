-- Judging score normalization, done in the database.
--
-- Judges are harsh or generous, so a team's raw average depends on who saw it.
-- This fits x[judge, team] = q[team] + bias[judge] + noise by shrunk least
-- squares, then rescales q so the average team is 5 and the top k teams are 10
-- (bottom clipping to 0 is fine). It runs three times, once per "series":
--   total        sum of all five ratings
--   adventurous  adventurous_rating alone
--   other        sum of the other four ratings
-- and the adventure score weights the normalized series AFTER normalizing:
--   0.65 * normalized(adventurous) + 0.35 * normalized(other)
--
-- judging_normalize() rebuilds judging_normalized_team after every change to
-- team_mark (statement-level trigger). It never raises into that statement: a
-- disconnected judge graph or z_k <= 0 (both likely early in judging) is
-- reported as a WARNING and the previous results are kept, so a judge's mark
-- submit cannot fail because of it. Run `SELECT judging_normalize(12)` to use a
-- different k. Read it all through the judging_team_scores view.
-- Hand-written like the stats_* views: not in schema.ts.

CREATE TABLE "judging_normalized_team" (
  "series" text NOT NULL CHECK ("series" IN ('total', 'adventurous', 'other')),
  "team_id" varchar(255) NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "q" double precision NOT NULL,
  "final_score" double precision NOT NULL,
  PRIMARY KEY ("series", "team_id")
);
--> statement-breakpoint

-- One series. Appends its rows to the caller's temp table _jn_result; raises
-- on a disconnected graph or z_k <= 0.
CREATE OR REPLACE FUNCTION judging_normalize_series(
  p_series text,
  p_k int,
  p_shrink double precision
) RETURNS void AS $$
DECLARE
  changed int;
  comps int;
  n_teams int;
  delta double precision;
  mu double precision;
  sigma double precision;
  z_k double precision;
  s double precision;
BEGIN
  DROP TABLE IF EXISTS _jn_x, _jn_q, _jn_b, _jn_c;

  -- x[j,t]: one score per (judge, team); repeat visits are averaged. Marks
  -- missing any rating this series needs are skipped.
  CREATE TEMP TABLE _jn_x (
    judge_id varchar(255) NOT NULL,
    team_id varchar(255) NOT NULL,
    x double precision NOT NULL
  );
  INSERT INTO _jn_x
  SELECT judge_id, team_id, avg(v)
  FROM (
    SELECT judge_id, team_id,
      CASE p_series
        WHEN 'total' THEN impact_rating + creativity_rating + technical_rating
                          + design_rating + adventurous_rating
        WHEN 'adventurous' THEN adventurous_rating
        ELSE impact_rating + creativity_rating + technical_rating + design_rating
      END AS v
    FROM team_mark
  ) m
  WHERE v IS NOT NULL
  GROUP BY judge_id, team_id;

  IF NOT EXISTS (SELECT 1 FROM _jn_x) THEN
    RETURN;
  END IF;

  -- Connectivity: judges are linked by shared teams. Propagate the smallest
  -- label through judge -> team -> judge until nothing changes.
  CREATE TEMP TABLE _jn_c AS
  SELECT judge_id, (row_number() OVER (ORDER BY judge_id))::int AS lbl
  FROM (SELECT DISTINCT judge_id FROM _jn_x) j;
  LOOP
    UPDATE _jn_c c SET lbl = m.lbl
    FROM (
      SELECT x.judge_id, min(tl.lbl) AS lbl
      FROM _jn_x x
      JOIN (
        SELECT x2.team_id, min(c2.lbl) AS lbl
        FROM _jn_x x2 JOIN _jn_c c2 USING (judge_id)
        GROUP BY x2.team_id
      ) tl USING (team_id)
      GROUP BY x.judge_id
    ) m
    WHERE c.judge_id = m.judge_id AND m.lbl < c.lbl;
    GET DIAGNOSTICS changed = ROW_COUNT;
    EXIT WHEN changed = 0;
  END LOOP;
  SELECT count(DISTINCT lbl) INTO comps FROM _jn_c;
  IF comps > 1 THEN
    RAISE EXCEPTION 'judges form % disconnected groups in series %; biases are not comparable', comps, p_series;
  END IF;

  -- q starts as each team's plain average; bias starts at 0.
  CREATE TEMP TABLE _jn_q AS
  SELECT team_id, avg(x) AS q FROM _jn_x GROUP BY team_id;
  CREATE TEMP TABLE _jn_b AS
  SELECT judge_id, 0::double precision AS bias, count(*)::int AS n
  FROM _jn_x GROUP BY judge_id;

  FOR i IN 1..100 LOOP
    -- bias = sum(x - q) / (teams seen + shrink), then centered on 0.
    UPDATE _jn_b b SET bias = d.total / (b.n + p_shrink)
    FROM (
      SELECT x.judge_id, sum(x.x - q.q) AS total
      FROM _jn_x x JOIN _jn_q q USING (team_id)
      GROUP BY x.judge_id
    ) d
    WHERE d.judge_id = b.judge_id;
    UPDATE _jn_b SET bias = bias - (SELECT avg(bias) FROM _jn_b);

    -- q = mean over the team's actual judges of (x - bias).
    SELECT max(abs(nq.q - q.q)) INTO delta
    FROM (
      SELECT x.team_id, avg(x.x - b.bias) AS q
      FROM _jn_x x JOIN _jn_b b USING (judge_id)
      GROUP BY x.team_id
    ) nq JOIN _jn_q q USING (team_id);
    UPDATE _jn_q q SET q = nq.q
    FROM (
      SELECT x.team_id, avg(x.x - b.bias) AS q
      FROM _jn_x x JOIN _jn_b b USING (judge_id)
      GROUP BY x.team_id
    ) nq
    WHERE nq.team_id = q.team_id;
    EXIT WHEN delta < 1e-6;
  END LOOP;

  -- Population mean / std, z-scores, then scale so the k-th team is exactly 10.
  SELECT avg(q), stddev_pop(q), count(*)::int INTO mu, sigma, n_teams FROM _jn_q;
  IF sigma IS NULL OR sigma = 0 THEN
    RAISE EXCEPTION 'series %: every team has the same quality, nothing to rank', p_series;
  END IF;
  SELECT (q - mu) / sigma INTO z_k
  FROM _jn_q ORDER BY q DESC
  OFFSET least(p_k, n_teams) - 1 LIMIT 1;
  IF z_k <= 0 THEN
    RAISE EXCEPTION 'series %: z_k = % <= 0, k = % is too large for % teams', p_series, z_k, p_k, n_teams;
  END IF;
  s := 5 / z_k;

  INSERT INTO _jn_result
  SELECT p_series, team_id, q,
         least(10, greatest(0, 5 + s * (q - mu) / sigma))
  FROM _jn_q;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION judging_normalize(
  p_k int DEFAULT 10,
  p_shrink double precision DEFAULT 1
) RETURNS void AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('judging_normalize'));
  BEGIN
    DROP TABLE IF EXISTS _jn_result;
    CREATE TEMP TABLE _jn_result (
      series text,
      team_id varchar(255),
      q double precision,
      final_score double precision
    );
    PERFORM judging_normalize_series('total', p_k, p_shrink);
    PERFORM judging_normalize_series('adventurous', p_k, p_shrink);
    PERFORM judging_normalize_series('other', p_k, p_shrink);
    DELETE FROM judging_normalized_team;
    INSERT INTO judging_normalized_team SELECT * FROM _jn_result;
  EXCEPTION WHEN OTHERS THEN
    -- Sub-transaction rolled back: the previous results stay.
    RAISE WARNING 'judging_normalize skipped: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION judging_normalize_trigger() RETURNS trigger AS $$
BEGIN
  PERFORM judging_normalize();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_team_mark_normalize ON "team_mark";
--> statement-breakpoint
CREATE TRIGGER trg_team_mark_normalize
AFTER INSERT OR DELETE ON "team_mark"
FOR EACH STATEMENT EXECUTE FUNCTION judging_normalize_trigger();
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_team_mark_normalize_upd ON "team_mark";
--> statement-breakpoint
CREATE TRIGGER trg_team_mark_normalize_upd
AFTER UPDATE OF "impact_rating", "creativity_rating", "technical_rating",
  "design_rating", "adventurous_rating", "judge_id", "team_id" ON "team_mark"
FOR EACH STATEMENT EXECUTE FUNCTION judging_normalize_trigger();
--> statement-breakpoint

-- Raw / normalized / adventure per team, best normalized score first.
-- raw_total is the sum of the five per-category averages divided by the 5
-- categories (0-10); normalized_score and adventure_score are also 0-10 and null until the team has been normalized.
CREATE VIEW "judging_team_scores" AS
SELECT
  t.id AS team_id,
  t.name AS team_name,
  m.n_judges,
  m.super_likes,
  m.avg_impact,
  m.avg_creativity,
  m.avg_technical,
  m.avg_design,
  m.avg_adventurous,
  (coalesce(m.avg_impact, 0) + coalesce(m.avg_creativity, 0)
    + coalesce(m.avg_technical, 0) + coalesce(m.avg_design, 0)
    + coalesce(m.avg_adventurous, 0)) / 5.0 AS raw_total,
  nt.final_score AS normalized_score,
  CASE WHEN na.final_score IS NOT NULL AND no.final_score IS NOT NULL
    THEN 0.65 * na.final_score + 0.35 * no.final_score
  END AS adventure_score
FROM (
  SELECT
    team_id,
    count(DISTINCT judge_id) AS n_judges,
    count(*) FILTER (WHERE super_like) AS super_likes,
    avg(impact_rating) AS avg_impact,
    avg(creativity_rating) AS avg_creativity,
    avg(technical_rating) AS avg_technical,
    avg(design_rating) AS avg_design,
    avg(adventurous_rating) AS avg_adventurous
  FROM "team_mark"
  GROUP BY team_id
) m
JOIN "team" t ON t.id = m.team_id
LEFT JOIN "judging_normalized_team" nt ON nt.team_id = m.team_id AND nt.series = 'total'
LEFT JOIN "judging_normalized_team" na ON na.team_id = m.team_id AND na.series = 'adventurous'
LEFT JOIN "judging_normalized_team" no ON no.team_id = m.team_id AND no.series = 'other'
ORDER BY nt.final_score DESC NULLS LAST, 10 DESC;
--> statement-breakpoint

-- Fill the table from marks already in the database.
SELECT judging_normalize();
