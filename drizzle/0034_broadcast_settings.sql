CREATE TABLE "broadcast_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"hacking_starts_at" timestamp (3),
	"hacking_ends_at" timestamp (3),
	"photo_seconds" integer DEFAULT 8 NOT NULL,
	"video_seconds" integer DEFAULT 20 NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL
);
