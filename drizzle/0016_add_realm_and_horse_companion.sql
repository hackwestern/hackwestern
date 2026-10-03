CREATE TYPE "public"."realm" AS ENUM('safari', 'mountain', 'desert', 'ocean');--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "realm" realm;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "horse_id" integer;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "horse_first_name" varchar(255);--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "horse_last_name" varchar(255);