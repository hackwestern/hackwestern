CREATE TABLE "email_subscriber" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"source" varchar(16) NOT NULL,
	"unsubscribe_token" varchar(64) NOT NULL,
	"unsubscribed_at" timestamp (3),
	"bounced_at" timestamp (3),
	"last_sent_at" timestamp (3),
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "email_subscriber_email_unique" UNIQUE("email"),
	CONSTRAINT "email_subscriber_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
