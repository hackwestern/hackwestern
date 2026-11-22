-- Judging normalization: scale from the top ~10% of teams, keep each series
-- independent. Replaces the functions from 0046 (table, view and triggers are
-- unchanged).
--
-- 0046 scaled so the k-th best team (k = 10) scored 10. With 10 or fewer marked
-- teams that "k-th best" team was the worst one, its z-score was negative, the
-- series raised, and judging_normalize() rolled back all three series, so
-- judging_normalized_team stayed empty and the results page showed "–".
--
-- Now:
--   * k = ceil(p_top_frac * teams) (default 10%, at least 1), but never past the
--     last above-average team, so the benchmark z is always > 0. Teams at or
--     above the k-th best score 10; the rest scale down from it.
--     10 teams -> k = 1, 20 -> 2, 50 -> 5, 95 -> 10.
--   * Every team tied in a series (sigma = 0) scores 5 instead of raising.
--   * Each series runs on its own: if one fails (a disconnected judge graph is
--     still an error) it keeps its previous rows, logs a WARNING, and the other
--     series still update.
-- Run `SELECT judging_normalize(0.15)` to use a different fraction.

DROP FUNCTION IF EXISTS judging_normalize(int, double precision);
--> statement-breakpoint
DROP FUNCTION IF EXISTS judging_normalize_series(text, int, double precision);
--> statement-breakpoint

-- One series. Appends its rows to the caller's temp table _jn_result; raises
-- on a disconnected judge graph.
CREATE FUNCTION judging_normalize_series(
  p_series text,
  p_top_frac numeric,
  p_shrink double precision
) RETURNS void AS $$
DECLARE
  changed int;
  comps int;
  n_teams int;
  n_pos int;
  k_eff int;
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

  SELECT avg(q), stddev_pop(q), count(*)::int INTO mu, sigma, n_teams FROM _jn_q;

  -- Every team tied (or a single team): nothing to rank, everyone is average.
  IF sigma IS NULL OR sigma = 0 THEN
    INSERT INTO _jn_result SELECT p_series, team_id, q, 5 FROM _jn_q;
    RETURN;
  END IF;

  -- Benchmark: the k-th best team, k = ceil(top_frac * teams) kept in numeric
  -- (0.1 * 30 is exactly 3), at least 1, never past the last above-average
  -- team. sigma > 0 means at least one team is above the mean, so z_k > 0.
  SELECT count(*)::int INTO n_pos FROM _jn_q WHERE q > mu;
  k_eff := least(greatest(1, ceil(p_top_frac * n_teams))::int, n_pos);
  SELECT (q - mu) / sigma INTO z_k
  FROM _jn_q ORDER BY q DESC
  OFFSET k_eff - 1 LIMIT 1;
  s := 5 / z_k;

  INSERT INTO _jn_result
  SELECT p_series, team_id, q,
         least(10, greatest(0, 5 + s * (q - mu) / sigma))
  FROM _jn_q;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE FUNCTION judging_normalize(
  p_top_frac numeric DEFAULT 0.10,
  p_shrink double precision DEFAULT 1
) RETURNS void AS $$
DECLARE
  ser text;
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
    FOREACH ser IN ARRAY ARRAY['total', 'adventurous', 'other'] LOOP
      BEGIN
        PERFORM judging_normalize_series(ser, p_top_frac, p_shrink);
      EXCEPTION WHEN OTHERS THEN
        -- This series' sub-transaction rolled back: keep its previous rows.
        RAISE WARNING 'judging_normalize: series % kept previous results: %', ser, SQLERRM;
        INSERT INTO _jn_result
        SELECT series, team_id, q, final_score
        FROM judging_normalized_team WHERE series = ser;
      END;
    END LOOP;
    DELETE FROM judging_normalized_team;
    INSERT INTO judging_normalized_team SELECT * FROM _jn_result;
  EXCEPTION WHEN OTHERS THEN
    -- Never raise into the team_mark statement: the previous results stay.
    RAISE WARNING 'judging_normalize skipped: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Score the marks already in the database.
SELECT judging_normalize();
