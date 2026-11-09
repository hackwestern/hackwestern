ALTER TABLE "public"."application" ALTER COLUMN "country_of_residence" SET DATA TYPE text;--> statement-breakpoint
UPDATE "public"."application" SET "country_of_residence" = 'Other' WHERE "country_of_residence" = 'India';--> statement-breakpoint
DROP TYPE "public"."country";--> statement-breakpoint
CREATE TYPE "public"."country" AS ENUM('Canada', 'United States', 'Other');--> statement-breakpoint
ALTER TABLE "public"."application" ALTER COLUMN "country_of_residence" SET DATA TYPE "public"."country" USING "country_of_residence"::"public"."country";