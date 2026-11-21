CREATE TABLE IF NOT EXISTS "sponsor_lead_ping" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"slack_channel" varchar(32) NOT NULL,
	"message_id" varchar(64) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"post_at" timestamp (3) NOT NULL,
	"content_key" varchar(64) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
