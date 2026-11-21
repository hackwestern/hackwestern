ALTER TABLE "scavenger_hunt_item" ALTER COLUMN "starts_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ALTER COLUMN "ends_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ADD CONSTRAINT "scavenger_hunt_item_times_both_or_neither" CHECK (("scavenger_hunt_item"."starts_at" IS NULL) = ("scavenger_hunt_item"."ends_at" IS NULL));