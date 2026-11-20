ALTER TABLE "scavenger_hunt_redemption" ADD COLUMN "cost_points" smallint;--> statement-breakpoint
-- The price paid was not stored before, so past redemptions get the reward's current cost
UPDATE "scavenger_hunt_redemption" r SET "cost_points" = w."cost_points" FROM "scavenger_hunt_reward" w WHERE w."id" = r."reward_id";--> statement-breakpoint
ALTER TABLE "scavenger_hunt_redemption" ALTER COLUMN "cost_points" SET NOT NULL;
