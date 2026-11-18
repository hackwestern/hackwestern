CREATE TABLE "coffee_chat_hold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"room" varchar(64) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"note" varchar(255),
	"created_by" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coffee_chat_hold" ADD CONSTRAINT "coffee_chat_hold_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_chat_hold" ADD CONSTRAINT "coffee_chat_hold_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coffee_chat_hold_sponsor_idx" ON "coffee_chat_hold" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "coffee_chat_hold_room_idx" ON "coffee_chat_hold" USING btree ("room","start_time");