CREATE TABLE "coffee_chat_limit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"hackers" smallint NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsor_judging_sponsor" ADD COLUMN "coffee_chat_style" varchar(16);--> statement-breakpoint
ALTER TABLE "sponsor_judging_sponsor" ADD COLUMN "coffee_chat_per_slot" smallint;--> statement-breakpoint
ALTER TABLE "coffee_chat_limit" ADD CONSTRAINT "coffee_chat_limit_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coffee_chat_limit_span_idx" ON "coffee_chat_limit" USING btree ("sponsor_id","start_time","end_time");