CREATE TYPE "public"."judging_round_status" AS ENUM('idle', 'running', 'paused', 'closed');--> statement-breakpoint
CREATE TABLE "judging_round" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"rounds_enabled" boolean DEFAULT true NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"status" "judging_round_status" DEFAULT 'idle' NOT NULL,
	"round_seconds" integer DEFAULT 600 NOT NULL,
	"ends_at" timestamp (3),
	"remaining_ms" integer,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "judging_round_singleton" CHECK ("judging_round"."id" = 1)
);
