CREATE TABLE "email_reminder_sent" (
	"user_id" varchar(255) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"sent_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "email_reminder_sent_user_id_kind_pk" PRIMARY KEY("user_id","kind")
);
--> statement-breakpoint
ALTER TABLE "email_reminder_sent" ADD CONSTRAINT "email_reminder_sent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;