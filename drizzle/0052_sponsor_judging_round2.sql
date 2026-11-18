CREATE TABLE "sponsor_judging_setting" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"round2_opened_at" timestamp (3),
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_judging_setting_single_row" CHECK ("sponsor_judging_setting"."id" = 1)
);
