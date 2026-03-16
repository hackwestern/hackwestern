ALTER TABLE "hw_visit" DROP CONSTRAINT "hw_visit_visitor_id_hw_visitor_id_fk";
--> statement-breakpoint
ALTER TABLE "hw_visit" ADD CONSTRAINT "hw_visit_visitor_id_hw_visitor_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."hw_visitor"("id") ON DELETE cascade ON UPDATE no action;