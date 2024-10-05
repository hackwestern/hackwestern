DO $$ BEGIN
 CREATE TYPE "public"."avatar" AS ENUM('Wildlife Wanderer', 'City Cruiser', 'Foodie Fanatic', 'Beach Bum');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "hw11_application" ADD COLUMN "avatar" "avatar";