CREATE TABLE "sponsor_judging_sponsor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_judging_sponsor_name_unique" UNIQUE("name")
);
