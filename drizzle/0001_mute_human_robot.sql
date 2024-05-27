ALTER TABLE "hackwestern2024_application" DROP CONSTRAINT "hackwestern2024_application_pkey";
ALTER TABLE "hackwestern2024_application" ADD PRIMARY KEY ("user_id");--> statement-breakpoint
ALTER TABLE "hackwestern2024_application" DROP COLUMN IF EXISTS "id";
