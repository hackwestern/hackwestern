-- "Other" now comes with a required school name (school_other). US applicants
-- who already submitted with "Other" go back to in progress with the school
-- cleared, so they pick it again, name it and resubmit. No email: the
-- incomplete-application reminder covers it.
UPDATE "application"
SET
  "name" = NULL,
  "status" = 'IN_PROGRESS',
  "updated_at" = now()
WHERE "status" = 'PENDING_REVIEW'
  AND "name" = 'Other'
  AND "country_of_residence" = 'United States'
  AND "school_other" IS NULL;
