CREATE TYPE "public"."dietary_restrictions" AS ENUM('Vegetarian', 'Vegan', 'Kosher', 'Halal', 'Other');--> statement-breakpoint
CREATE TYPE "public"."emergency_contact_relationship" AS ENUM('Parent', 'Sibling', 'Other family member', 'Friend', 'Coworker', 'Other');--> statement-breakpoint
CREATE TYPE "public"."shirt_size" AS ENUM('S', 'M', 'L', 'XL');--> statement-breakpoint
CREATE TYPE "public"."transportation_method" AS ENUM('Waterloo', 'Toronto', 'Hamilton', 'None');--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "shirt_size" "shirt_size";--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "dietary_restrictions" "dietary_restrictions";--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "dietary_restrictions_other" varchar(255);--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "emergency_contact_name" varchar(255);--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "emergency_contact_relationship" "emergency_contact_relationship";--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "emergency_contact_phone_number" varchar(42);--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "transportation_method" "transportation_method";--> statement-breakpoint
ALTER TABLE "public"."application" ALTER COLUMN "year_of_study" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."year_of_study";--> statement-breakpoint
CREATE TYPE "public"."year_of_study" AS ENUM('1st', '2nd', '3rd', '4th', '5th+', 'N/A', 'Prefer not to answer');--> statement-breakpoint
ALTER TABLE "public"."application" ALTER COLUMN "year_of_study" SET DATA TYPE "public"."year_of_study" USING "year_of_study"::"public"."year_of_study";