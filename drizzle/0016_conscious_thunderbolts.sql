ALTER TABLE "hw_scavenger_hunt_scan" DROP CONSTRAINT "hw_scavenger_hunt_scan_user_id_item_id_pk";--> statement-breakpoint
ALTER TABLE "hw_scavenger_hunt_scan" ADD COLUMN "scanner_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "hw_scavenger_hunt_scan" ADD CONSTRAINT "hw_scavenger_hunt_scan_user_id_item_id_scanner_id_pk" PRIMARY KEY("user_id","item_id","scanner_id");--> statement-breakpoint
ALTER TABLE "hw_scavenger_hunt_scan" ADD CONSTRAINT "hw_scavenger_hunt_scan_scanner_id_hw_user_id_fk" FOREIGN KEY ("scanner_id") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scan_scanner_idx" ON "hw_scavenger_hunt_scan" USING btree ("scanner_id");