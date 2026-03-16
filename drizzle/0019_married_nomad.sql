ALTER TABLE "hw_link_click" ADD COLUMN "visitor_id" varchar(36);--> statement-breakpoint
CREATE INDEX "link_click_visitor_idx" ON "hw_link_click" USING btree ("visitor_id");