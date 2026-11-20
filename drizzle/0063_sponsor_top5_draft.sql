CREATE TABLE "sponsor_top5_draft" (
	"sponsor_id" uuid PRIMARY KEY NOT NULL,
	"team_ids" varchar(12)[] NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsor_top5_draft" ADD CONSTRAINT "sponsor_top5_draft_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;