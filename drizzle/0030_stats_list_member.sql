-- hw-stats: how the pre-launch mailing lists turned into HW13 accounts. One row
-- per contact who was on a list before applications opened (2026-10-03 14:00
-- UTC): which lists they were on, and when they made an account, started and
-- submitted an application. Matched on email inside the view; the email itself
-- is never exposed, so the stats login still can't read one.
CREATE OR REPLACE VIEW "stats_list_member" AS
WITH contacts AS (
  SELECT lower(trim(email)) AS e, source AS list
  FROM "email_subscriber"
  WHERE created_at < '2026-10-03 14:00:00'
  UNION
  SELECT lower(trim(email)), 'preregistration'
  FROM "preregistration"
  WHERE created_at < '2026-10-03 14:00:00'
)
SELECT
  array_agg(DISTINCT c.list ORDER BY c.list) AS lists,
  min(u.created_at) AS account_created_at,
  min(a.created_at) AS application_created_at,
  min(a.updated_at) FILTER (WHERE a.status <> 'IN_PROGRESS') AS application_submitted_at
FROM contacts AS c
LEFT JOIN "user" AS u ON lower(u.email) = c.e
LEFT JOIN "application" AS a ON a.user_id = u.id
GROUP BY c.e;
--> statement-breakpoint
-- The read-only stats role only exists on prod.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hw_stats_ro') THEN
    GRANT SELECT ON "stats_list_member" TO hw_stats_ro;
  END IF;
END
$$;
