-- "N/A" and "Prefer not to answer" are no longer valid years of study. Clear
-- them so the applicant has to pick a real year, and send any application
-- still awaiting review back to in progress so it can't stay submitted
-- without one. No email: the incomplete-application reminder covers it.
UPDATE "application"
SET
  "year_of_study" = NULL,
  "status" = CASE WHEN "status" = 'PENDING_REVIEW' THEN 'IN_PROGRESS' ELSE "status" END,
  "updated_at" = now()
WHERE "year_of_study" IN ('N/A', 'Prefer not to answer');
