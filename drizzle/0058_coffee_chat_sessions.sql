CREATE TYPE "public"."coffee_chat_placement_status" AS ENUM('draft', 'sent');--> statement-breakpoint
CREATE TABLE "coffee_chat_placement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rep_id" uuid NOT NULL,
	"session_id" varchar(4) NOT NULL,
	"room" varchar(8) NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"status" "coffee_chat_placement_status" DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coffee_chat_pref" (
	"sponsor_id" uuid PRIMARY KEY NOT NULL,
	"hackers_per_chat" smallint DEFAULT 1 NOT NULL,
	"longer_one_on_one" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp (3),
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "coffee_chat_pref_hackers_check" CHECK ("coffee_chat_pref"."hackers_per_chat" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "coffee_chat_rep_session" (
	"rep_id" uuid NOT NULL,
	"session_id" varchar(4) NOT NULL,
	CONSTRAINT "coffee_chat_rep_session_rep_id_session_id_pk" PRIMARY KEY("rep_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "coffee_chat_rep" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"chats_wanted" smallint DEFAULT 1 NOT NULL,
	"max_sessions" smallint,
	"position" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "coffee_chat_rep_chats_check" CHECK ("coffee_chat_rep"."chats_wanted" >= 1)
);
--> statement-breakpoint
CREATE TABLE "coffee_chat_room_booking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(4) NOT NULL,
	"room" varchar(8) NOT NULL,
	"for_sponsor_id" uuid,
	"label" varchar(255) NOT NULL,
	"note" varchar(255),
	"created_by" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coffee_chat_placement" ADD CONSTRAINT "coffee_chat_placement_rep_id_coffee_chat_rep_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."coffee_chat_rep"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_chat_pref" ADD CONSTRAINT "coffee_chat_pref_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_chat_rep_session" ADD CONSTRAINT "coffee_chat_rep_session_rep_id_coffee_chat_rep_id_fk" FOREIGN KEY ("rep_id") REFERENCES "public"."coffee_chat_rep"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD CONSTRAINT "coffee_chat_rep_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_chat_room_booking" ADD CONSTRAINT "coffee_chat_room_booking_for_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("for_sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_chat_room_booking" ADD CONSTRAINT "coffee_chat_room_booking_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coffee_chat_placement_room_idx" ON "coffee_chat_placement" USING btree ("room","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coffee_chat_placement_rep_idx" ON "coffee_chat_placement" USING btree ("rep_id","session_id");--> statement-breakpoint
CREATE INDEX "coffee_chat_rep_sponsor_idx" ON "coffee_chat_rep" USING btree ("sponsor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coffee_chat_rep_primary_idx" ON "coffee_chat_rep" USING btree ("sponsor_id") WHERE "coffee_chat_rep"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "coffee_chat_room_booking_cell_idx" ON "coffee_chat_room_booking" USING btree ("room","session_id");