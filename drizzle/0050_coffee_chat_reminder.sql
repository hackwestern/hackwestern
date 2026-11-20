CREATE TABLE IF NOT EXISTS "coffee_chat_reminder" (
	"chat_id" uuid PRIMARY KEY NOT NULL,
	"slack_channel" varchar(32) NOT NULL,
	"message_id" varchar(64) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"post_at" timestamp (3) NOT NULL,
	"content_key" varchar(64) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
