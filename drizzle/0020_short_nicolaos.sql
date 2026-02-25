CREATE TABLE "hw_visitor" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"total_visits" integer DEFAULT 0 NOT NULL,
	"last_visit_at" timestamp (3),
	"user_id" varchar(255),
	"ip_address" varchar(45),
	"user_agent" text,
	"city" varchar(255),
	"region" varchar(255),
	"country" varchar(255),
	"first_visit_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hw_visit" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" varchar(36) NOT NULL,
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
DROP TABLE "hw_link_click" CASCADE;--> statement-breakpoint
ALTER TABLE "hw_visitor" ADD CONSTRAINT "hw_visitor_user_id_hw_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_visit" ADD CONSTRAINT "hw_visit_visitor_id_hw_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."hw_visitor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_visit" ADD CONSTRAINT "hw_visit_user_id_hw_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visitor_user_idx" ON "hw_visitor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "visitor_country_idx" ON "hw_visitor" USING btree ("country");--> statement-breakpoint
CREATE INDEX "visit_url_idx" ON "hw_visit" USING btree ("url");--> statement-breakpoint
CREATE INDEX "visit_visitor_idx" ON "hw_visit" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "visit_user_idx" ON "hw_visit" USING btree ("user_id");