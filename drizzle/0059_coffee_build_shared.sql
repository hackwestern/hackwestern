CREATE TABLE "sponsor_scan" (
	"sponsor_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"rep_name" varchar(255),
	"scanned_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_scan_sponsor_id_user_id_pk" PRIMARY KEY("sponsor_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sponsor_team_score" (
	"sponsor_id" uuid NOT NULL,
	"team_id" varchar(12) NOT NULL,
	"judge_name" varchar(255) NOT NULL,
	"score_halves" smallint NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_team_score_sponsor_id_team_id_judge_name_pk" PRIMARY KEY("sponsor_id","team_id","judge_name"),
	CONSTRAINT "sponsor_team_score_range" CHECK ("sponsor_team_score"."score_halves" BETWEEN 2 AND 20)
);
--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" DROP CONSTRAINT "coffee_chat_rep_chats_check";--> statement-breakpoint
ALTER TABLE "coffee_chat_pref" ADD COLUMN "shortlist_submitted_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN "placement_id" uuid;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN "round" smallint;--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN "expires_at" timestamp (3);--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD COLUMN "source" varchar(16);--> statement-breakpoint
ALTER TABLE "sponsor_scan" ADD CONSTRAINT "sponsor_scan_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_scan" ADD CONSTRAINT "sponsor_scan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_team_score" ADD CONSTRAINT "sponsor_team_score_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_team_score" ADD CONSTRAINT "sponsor_team_score_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sponsor_scan_user_idx" ON "sponsor_scan" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "coffee_chat" ADD CONSTRAINT "coffee_chat_placement_id_coffee_chat_placement_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."coffee_chat_placement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coffee_chat_placement_idx" ON "coffee_chat" USING btree ("placement_id");--> statement-breakpoint
ALTER TABLE "coffee_chat_rep" ADD CONSTRAINT "coffee_chat_rep_chats_check" CHECK ("coffee_chat_rep"."chats_wanted" >= 0);