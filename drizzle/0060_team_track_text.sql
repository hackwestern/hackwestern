ALTER TABLE "team_track" ALTER COLUMN "track" SET DATA TYPE text USING "track"::text;--> statement-breakpoint
ALTER TABLE "team" ALTER COLUMN "tracks" SET DATA TYPE text[] USING "tracks"::text[];
