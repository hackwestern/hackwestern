ALTER TYPE "race/ethnicity" ADD VALUE 'Prefer not to answer (default)';--> statement-breakpoint
ALTER TYPE "gender" ADD VALUE 'Prefer not to answer (default)';--> statement-breakpoint
ALTER TYPE "sexual_orientation" ADD VALUE 'Prefer not to answer (default)';--> statement-breakpoint

ALTER TYPE "race/ethnicity" RENAME VALUE 'Prefer not to answer (default)' TO 'Prefer not to answer';--> statement-breakpoint
ALTER TYPE "gender" RENAME VALUE 'Prefer not to answer (default)' TO 'Prefer not to answer';--> statement-breakpoint
ALTER TYPE "sexual_orientation" RENAME VALUE 'Prefer not to answer (default)' TO 'Prefer not to answer';
