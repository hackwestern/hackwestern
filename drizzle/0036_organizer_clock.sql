CREATE TABLE IF NOT EXISTS "clock" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"ends_at" timestamp (3) with time zone,
	"paused_remaining_ms" integer,
	"duration_ms" integer DEFAULT 300000 NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "clock" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
