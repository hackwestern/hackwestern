CREATE TABLE "sponsor_interest" (
	"user_id" varchar(255) NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"rank" smallint NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_interest_user_id_sponsor_id_pk" PRIMARY KEY("user_id","sponsor_id")
);
--> statement-breakpoint
ALTER TABLE "sponsor_interest" ADD CONSTRAINT "sponsor_interest_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_interest" ADD CONSTRAINT "sponsor_interest_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sponsor_interest_user_rank_idx" ON "sponsor_interest" USING btree ("user_id","rank");--> statement-breakpoint
CREATE INDEX "sponsor_interest_sponsor_idx" ON "sponsor_interest" USING btree ("sponsor_id");