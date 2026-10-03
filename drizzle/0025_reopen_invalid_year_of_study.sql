-- "N/A" and "Prefer not to answer" are no longer valid years of study, so an
-- application submitted with one goes back to in progress until the applicant
-- picks a real year. No email: the incomplete-application reminder covers it.
-- Only applications still awaiting review; anything already decided is left alone.
UPDATE "application"
SET "status" = 'IN_PROGRESS', "updated_at" = now()
WHERE "status" = 'PENDING_REVIEW'
  AND "year_of_study" IN ('N/A', 'Prefer not to answer');
