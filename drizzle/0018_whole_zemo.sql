CREATE TABLE "hw_link_click" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" varchar(2048) NOT NULL,
	"user_id" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"referer" varchar(2048),
	"city" varchar(255),
	"region" varchar(255),
	"country" varchar(255),
	"latitude" varchar(255),
	"longitude" varchar(255),
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hw_link_click" ADD CONSTRAINT "hw_link_click_user_id_hw_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_click_url_idx" ON "hw_link_click" USING btree ("url");--> statement-breakpoint
CREATE INDEX "link_click_user_idx" ON "hw_link_click" USING btree ("user_id");