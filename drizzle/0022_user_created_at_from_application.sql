-- 0021 stamped every account that predates user.created_at with
-- 2026-10-03 10:00 ET (14:00 UTC). An account always exists before its
-- application, so for accounts that started one, the application's start time
-- is a much closer estimate. Accounts without an application keep 10:00 ET,
-- and accounts made after 0021 keep their real time.
UPDATE "user" AS u
SET "created_at" = a."created_at"
FROM "application" AS a
WHERE a."user_id" = u."id"
  AND u."created_at" = '2026-10-03 14:00:00';
