CREATE TABLE "team_finder_card" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"shown" boolean DEFAULT false NOT NULL,
	"needs" smallint,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"first_hackathon" boolean DEFAULT false NOT NULL,
	"looking_for" varchar(280) DEFAULT '' NOT NULL,
	"idea" varchar(280),
	"show_school" boolean DEFAULT true NOT NULL,
	"show_year" boolean DEFAULT false NOT NULL,
	"discord" varchar(100),
	"instagram" varchar(100),
	"linkedin" varchar(100),
	"github" varchar(100),
	"phone" varchar(32),
	"photo_key" varchar(255),
	"hidden_by_organizer_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "team_finder_card_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "team_finder_card" ADD CONSTRAINT "team_finder_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_finder_card_shown_idx" ON "team_finder_card" USING btree ("shown");