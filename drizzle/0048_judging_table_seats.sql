ALTER TABLE "judging_table" DROP CONSTRAINT "judging_table_number_unique";--> statement-breakpoint
ALTER TABLE "judging_table" ADD COLUMN "seat" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "judging_table_number_seat_idx" ON "judging_table" USING btree ("number","seat");--> statement-breakpoint
ALTER TABLE "judging_table" ADD CONSTRAINT "judging_table_seat_check" CHECK ("judging_table"."seat" in (1, 2));