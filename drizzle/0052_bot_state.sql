CREATE TABLE "bot_state" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
