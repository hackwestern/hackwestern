CREATE TABLE "sponsor_presentation" (
	"sponsor_id" uuid NOT NULL,
	"team_id" varchar(12) NOT NULL,
	"room" varchar(64),
	"start_minute" smallint,
	"scheduled_at" timestamp (3) DEFAULT now() NOT NULL,
	"notified_at" timestamp (3),
	CONSTRAINT "sponsor_presentation_sponsor_id_team_id_pk" PRIMARY KEY("sponsor_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "sponsor_shortlist_send" (
	"sponsor_id" uuid PRIMARY KEY NOT NULL,
	"team_ids" varchar(12)[] NOT NULL,
	"sent_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsor_presentation" ADD CONSTRAINT "sponsor_presentation_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_presentation" ADD CONSTRAINT "sponsor_presentation_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_shortlist_send" ADD CONSTRAINT "sponsor_shortlist_send_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sponsor_presentation_team_idx" ON "sponsor_presentation" USING btree ("team_id");