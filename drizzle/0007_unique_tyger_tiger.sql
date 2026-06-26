DROP INDEX "hacker_check_unique_idx";--> statement-breakpoint
DROP INDEX "team_check_unique_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "hacker_check_unique_idx" ON "hacker_check_result" USING btree ("user_id","check_type");--> statement-breakpoint
CREATE UNIQUE INDEX "team_check_unique_idx" ON "team_check_result" USING btree ("team_id","check_type");