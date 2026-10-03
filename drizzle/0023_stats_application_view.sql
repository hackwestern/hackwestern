-- Read-only window for the hw-stats service (github.com/hackwestern/hw-stats).
-- Its database login is granted this view, never the application table, so it
-- sees category values and whether each apply step is filled in, but never
-- names, phone numbers, emergency contacts or essay answers.
-- The step checks mirror getNextIncompleteStep() in src/pages/apply.tsx and
-- hw-stats src/sources/apply-steps.ts; update both if the apply steps change.
CREATE VIEW "stats_application" AS
SELECT
  a.user_id,
  a.status,
  a.created_at,
  a.updated_at,
  a.year_of_study,
  a.name AS school,
  a.major,
  a.num_of_hackathons,
  a.attended,
  a.country_of_residence,
  a.realm,
  a.age,
  a.gender,
  a.ethnicity,
  a.underrep_group,
  (a.realm IS NOT NULL AND a.horse_id IS NOT NULL) AS "step_realm",
  (nullif(trim(a.horse_first_name), '') IS NOT NULL AND nullif(trim(a.horse_last_name), '') IS NOT NULL) AS "step_companion",
  (nullif(trim(a.first_name), '') IS NOT NULL AND nullif(trim(a.last_name), '') IS NOT NULL AND nullif(trim(a.phone_number), '') IS NOT NULL AND a.age IS NOT NULL AND a.country_of_residence IS NOT NULL) AS "step_basics",
  (nullif(trim(a.name), '') IS NOT NULL AND a.year_of_study IS NOT NULL AND a.major IS NOT NULL AND a.attended IS NOT NULL AND a.num_of_hackathons IS NOT NULL) AS "step_info",
  (nullif(trim(a.question1), '') IS NOT NULL AND nullif(trim(a.question2), '') IS NOT NULL AND nullif(trim(a.question3), '') IS NOT NULL) AS "step_application",
  (nullif(trim(a.resume_link), '') IS NOT NULL) AS "step_links",
  (a.agree_code_of_conduct IS TRUE AND a.agree_share_with_mlh IS TRUE AND a.agree_share_with_sponsors IS TRUE AND a.agree_will_be_18 IS TRUE) AS "step_agreements",
  (a.shirt_size IS NOT NULL AND a.dietary_restrictions IS NOT NULL AND (a.dietary_restrictions <> 'Other' OR nullif(trim(a.dietary_restrictions_other), '') IS NOT NULL) AND nullif(trim(a.emergency_contact_name), '') IS NOT NULL AND a.emergency_contact_relationship IS NOT NULL AND nullif(trim(a.emergency_contact_phone_number), '') IS NOT NULL) AS "step_logistics"
FROM "application" AS a;
