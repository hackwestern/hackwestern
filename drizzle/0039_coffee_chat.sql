CREATE TYPE "public"."coffee_chat_status" AS ENUM('pending', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TABLE "coffee_chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"room" smallint NOT NULL,
	"slot_time" varchar(5) NOT NULL,
	"duration_minutes" smallint DEFAULT 15 NOT NULL,
	"status" "coffee_chat_status" DEFAULT 'pending' NOT NULL,
	"rep_name" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"responded_at" timestamp (3)
);
--> statement-breakpoint
ALTER TABLE "sponsor_judging_sponsor" ADD COLUMN "coffee_chat_reps" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD CONSTRAINT "coffee_chat_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD CONSTRAINT "coffee_chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coffee_chat_user_slot_active_idx" ON "coffee_chat" USING btree ("user_id","slot_time") WHERE "coffee_chat"."status" in ('pending', 'accepted');--> statement-breakpoint
CREATE INDEX "coffee_chat_sponsor_slot_idx" ON "coffee_chat" USING btree ("sponsor_id","slot_time");--> statement-breakpoint
CREATE INDEX "coffee_chat_user_idx" ON "coffee_chat" USING btree ("user_id");