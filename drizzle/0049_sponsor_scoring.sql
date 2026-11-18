CREATE TABLE "sponsor_final_pick" (
	"sponsor_id" uuid PRIMARY KEY NOT NULL,
	"team_ids" varchar(12)[] NOT NULL,
	"submitted_at" timestamp (3) DEFAULT now() NOT NULL,
	"sheet_synced_at" timestamp (3)
);
--> statement-breakpoint
CREATE TABLE "sponsor_team_review" (
	"sponsor_id" uuid NOT NULL,
	"team_id" varchar(12) NOT NULL,
	"score" smallint,
	"shortlisted" boolean DEFAULT false NOT NULL,
	"note" varchar(280),
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_team_review_sponsor_id_team_id_pk" PRIMARY KEY("sponsor_id","team_id"),
	CONSTRAINT "sponsor_team_review_score_range" CHECK ("sponsor_team_review"."score" IS NULL OR ("sponsor_team_review"."score" BETWEEN 1 AND 10))
);
--> statement-breakpoint
ALTER TABLE "sponsor_final_pick" ADD CONSTRAINT "sponsor_final_pick_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_team_review" ADD CONSTRAINT "sponsor_team_review_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_team_review" ADD CONSTRAINT "sponsor_team_review_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sponsor_team_review_team_idx" ON "sponsor_team_review" USING btree ("team_id");