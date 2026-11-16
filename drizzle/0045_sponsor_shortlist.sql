CREATE TABLE "sponsor_shortlist" (
	"sponsor_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_shortlist_sponsor_id_user_id_pk" PRIMARY KEY("sponsor_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "sponsor_shortlist" ADD CONSTRAINT "sponsor_shortlist_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_shortlist" ADD CONSTRAINT "sponsor_shortlist_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;