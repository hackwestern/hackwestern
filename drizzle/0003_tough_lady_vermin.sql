DO $$ BEGIN
 CREATE TYPE "public"."country" AS ENUM('Canada', 'United States', 'Other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "hw11_application" DROP COLUMN IF EXISTS "country_of_residence";
ALTER TABLE "hw11_application" ADD COLUMN "country_of_residence" country;--> statement-breakpoint
ALTER TABLE "hw11_application" ADD COLUMN "age" integer;--> statement-breakpoint
ALTER TABLE "hw11_application" DROP COLUMN IF EXISTS "date_of_birth";
