CREATE TABLE "sponsor_judging_room" (
	"sponsor_id" uuid PRIMARY KEY NOT NULL,
	"room" varchar(64) NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_presentation_confirm" (
	"team_id" varchar(12) PRIMARY KEY NOT NULL,
	"user_id" varchar(255),
	"via" varchar(8) NOT NULL,
	"slots_key" text NOT NULL,
	"confirmed_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsor_judging_room" ADD CONSTRAINT "sponsor_judging_room_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_presentation_confirm" ADD CONSTRAINT "sponsor_presentation_confirm_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_presentation_confirm" ADD CONSTRAINT "sponsor_presentation_confirm_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sponsor_judging_room_room_idx" ON "sponsor_judging_room" USING btree ("room");