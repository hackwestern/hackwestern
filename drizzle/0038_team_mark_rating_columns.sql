ALTER TABLE "team_mark" ADD COLUMN "impact_rating" real;--> statement-breakpoint
ALTER TABLE "team_mark" ADD COLUMN "creativity_rating" real;--> statement-breakpoint
ALTER TABLE "team_mark" ADD COLUMN "design_rating" real;--> statement-breakpoint
ALTER TABLE "team_mark" ADD COLUMN "adventurous_rating" real;--> statement-breakpoint
ALTER TABLE "team_mark" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "team_mark" ADD COLUMN "super_like" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Backfill the new columns from score_breakdown, which 0039 drops. Only the
-- four criteria with a column carry over; any other key in `ratings` (from an
-- earlier rubric) is left behind. Rows with a null breakdown keep null
-- ratings/notes and super_like = false. trg_team_mark_stats fires on this
-- UPDATE, but `score` doesn't change, so the judge aggregates net to zero.
UPDATE "team_mark" SET
  "impact_rating"      = ("score_breakdown" -> 'ratings' ->> 'impact')::real,
  "creativity_rating"  = ("score_breakdown" -> 'ratings' ->> 'creativity')::real,
  "design_rating"      = ("score_breakdown" -> 'ratings' ->> 'design')::real,
  "adventurous_rating" = ("score_breakdown" -> 'ratings' ->> 'adventurous')::real,
  "notes"              = nullif("score_breakdown" ->> 'notes', ''),
  "super_like"         = coalesce(("score_breakdown" ->> 'superLike')::boolean, false)
WHERE "score_breakdown" IS NOT NULL;
