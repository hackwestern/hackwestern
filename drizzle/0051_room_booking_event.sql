ALTER TABLE "coffee_chat_room_booking" ADD COLUMN IF NOT EXISTS "booked_by" varchar(255);--> statement-breakpoint
ALTER TABLE "coffee_chat_room_booking" ADD COLUMN IF NOT EXISTS "rep_ids" uuid[];--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN IF NOT EXISTS "booking_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD CONSTRAINT "coffee_chat_booking_id_coffee_chat_room_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."coffee_chat_room_booking"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
-- NOT VALID first: adding it takes only a brief lock on the live table;
-- VALIDATE checks existing rows (all null) without blocking writes.
ALTER TABLE "coffee_chat" VALIDATE CONSTRAINT "coffee_chat_booking_id_coffee_chat_room_booking_id_fk";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coffee_chat_booking_idx" ON "coffee_chat" USING btree ("booking_id");