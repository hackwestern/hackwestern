ALTER TABLE "judging_queue" ADD COLUMN "current_judge_id" varchar(255);--> statement-breakpoint
ALTER TABLE "judging_queue" ADD COLUMN "assigned_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "judging_queue" ADD CONSTRAINT "judging_queue_current_judge_id_judge_id_fk" FOREIGN KEY ("current_judge_id") REFERENCES "public"."judge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "judging_queue_current_judge_idx" ON "judging_queue" USING btree ("current_judge_id");