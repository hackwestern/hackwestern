ALTER TYPE "public"."country" ADD VALUE 'India' BEFORE 'Other';--> statement-breakpoint
ALTER TABLE "hw_user" ADD COLUMN "scavenger_hunt_earned" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "hw_user" ADD COLUMN "scavenger_hunt_balance" integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX "user_scavenger_hunt_earned_idx" ON "hw_user" USING btree ("scavenger_hunt_earned");--> statement-breakpoint
CREATE INDEX "user_scavenger_hunt_balance_idx" ON "hw_user" USING btree ("scavenger_hunt_balance");