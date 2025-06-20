CREATE TABLE "hw_scavenger_hunt_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(12) NOT NULL,
	"points" smallint DEFAULT 1 NOT NULL,
	"description" text,
	CONSTRAINT "hw_scavenger_hunt_item_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "hw_scavenger_hunt_redemption" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"reward_id" integer NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hw_scavenger_hunt_reward" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"cost_points" smallint NOT NULL,
	"description" text,
	"quantity" integer
);
--> statement-breakpoint
CREATE TABLE "hw_scavenger_hunt_scan" (
	"user_id" varchar(255) NOT NULL,
	"item_id" integer NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "hw_scavenger_hunt_scan_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "hw_resetPasswordToken" RENAME TO "hw_reset_password_token";--> statement-breakpoint
ALTER TABLE "hw_verificationToken" RENAME TO "hw_verification_token";--> statement-breakpoint
ALTER TABLE "hw_reset_password_token" DROP CONSTRAINT "hw_resetPasswordToken_userId_hw_user_id_fk";
--> statement-breakpoint
ALTER TABLE "hw_verification_token" DROP CONSTRAINT "hw_verificationToken_identifier_token_pk";--> statement-breakpoint
ALTER TABLE "hw_verification_token" ADD CONSTRAINT "hw_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token");--> statement-breakpoint
ALTER TABLE "hw_scavenger_hunt_redemption" ADD CONSTRAINT "hw_scavenger_hunt_redemption_user_id_hw_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_scavenger_hunt_redemption" ADD CONSTRAINT "hw_scavenger_hunt_redemption_reward_id_hw_scavenger_hunt_reward_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."hw_scavenger_hunt_reward"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_scavenger_hunt_scan" ADD CONSTRAINT "hw_scavenger_hunt_scan_user_id_hw_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_scavenger_hunt_scan" ADD CONSTRAINT "hw_scavenger_hunt_scan_item_id_hw_scavenger_hunt_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."hw_scavenger_hunt_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "redemption_user_idx" ON "hw_scavenger_hunt_redemption" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scan_user_idx" ON "hw_scavenger_hunt_scan" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "hw_reset_password_token" ADD CONSTRAINT "hw_reset_password_token_userId_hw_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;