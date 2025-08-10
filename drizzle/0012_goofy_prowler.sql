CREATE TABLE "hw_rotating_qr_code" (
	"id" serial PRIMARY KEY NOT NULL,
	"expires" timestamp NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"creator_id" varchar(255) NOT NULL,
	"event_id" integer NOT NULL,
	"token" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hw_rotating_qr_code" ADD CONSTRAINT "hw_rotating_qr_code_creator_id_hw_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;