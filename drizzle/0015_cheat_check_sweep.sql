CREATE TYPE "public"."cheat_sweep_item_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."cheat_sweep_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."cheat_sweep_trigger" AS ENUM('queue_drain', 'manual');--> statement-breakpoint
CREATE TABLE "cheat_check_sweep_item" (
	"sweep_id" integer NOT NULL,
	"team_id" varchar(255) NOT NULL,
	"status" "cheat_sweep_item_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "cheat_check_sweep_item_sweep_id_team_id_pk" PRIMARY KEY("sweep_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "cheat_check_sweep" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" "cheat_sweep_status" DEFAULT 'running' NOT NULL,
	"triggered_by" "cheat_sweep_trigger" NOT NULL,
	"started_at" timestamp (3) DEFAULT now() NOT NULL,
	"last_heartbeat_at" timestamp (3) DEFAULT now() NOT NULL,
	"finished_at" timestamp (3),
	"total_teams" integer DEFAULT 0 NOT NULL,
	"hacker_checks_done" boolean DEFAULT false NOT NULL,
	"force_rerun" boolean DEFAULT false NOT NULL,
	"rate_limited_until" timestamp (3),
	"error" text
);
--> statement-breakpoint
ALTER TABLE "cheat_check_sweep_item" ADD CONSTRAINT "cheat_check_sweep_item_sweep_id_cheat_check_sweep_id_fk" FOREIGN KEY ("sweep_id") REFERENCES "public"."cheat_check_sweep"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheat_check_sweep_item" ADD CONSTRAINT "cheat_check_sweep_item_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cheat_check_sweep_item_claim_idx" ON "cheat_check_sweep_item" USING btree ("sweep_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "cheat_check_sweep_active_idx" ON "cheat_check_sweep" USING btree ("status") WHERE status = 'running';--> statement-breakpoint
CREATE INDEX "cheat_check_sweep_finished_at_idx" ON "cheat_check_sweep" USING btree ("finished_at");