CREATE TABLE "coffee_chat_line" (
	"sponsor_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"kind" varchar(8) NOT NULL,
	"added_by" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "coffee_chat_line_sponsor_id_user_id_pk" PRIMARY KEY("sponsor_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "coffee_chat_placement" ADD COLUMN "forced" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "coffee_chat_line" ADD CONSTRAINT "coffee_chat_line_sponsor_id_sponsor_judging_sponsor_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsor_judging_sponsor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_chat_line" ADD CONSTRAINT "coffee_chat_line_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coffee_chat_line" ADD CONSTRAINT "coffee_chat_line_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;