CREATE TYPE "public"."scavenger_hunt_item_status" AS ENUM('draft', 'active', 'disabled');--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ADD COLUMN "status" "scavenger_hunt_item_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
-- The item description is the item's name. Items without one get their code.
UPDATE "scavenger_hunt_item" SET "description" = "code" WHERE "description" IS NULL OR btrim("description") = '';--> statement-breakpoint
-- Names must be unique among items that are not deleted. Later duplicates get their id added,
-- plus a counter if that name is also taken ("Lunch (7)", then "Lunch (7-1)").
DO $$
DECLARE
  r record;
  candidate text;
  n int;
BEGIN
  FOR r IN
    SELECT i."id", i."description" FROM "scavenger_hunt_item" i
    WHERE i."deleted_at" IS NULL AND EXISTS (
      SELECT 1 FROM "scavenger_hunt_item" o
      WHERE o."deleted_at" IS NULL AND lower(o."description") = lower(i."description") AND o."id" < i."id"
    )
    ORDER BY i."id"
  LOOP
    n := 0;
    candidate := r."description" || ' (' || r."id" || ')';
    WHILE EXISTS (
      SELECT 1 FROM "scavenger_hunt_item"
      WHERE "deleted_at" IS NULL AND lower("description") = lower(candidate)
    ) LOOP
      n := n + 1;
      candidate := r."description" || ' (' || r."id" || '-' || n || ')';
    END LOOP;
    UPDATE "scavenger_hunt_item" SET "description" = candidate WHERE "id" = r."id";
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" RENAME COLUMN "description" TO "name";--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
-- Items are found by id; unique names replace codes
ALTER TABLE "scavenger_hunt_item" DROP CONSTRAINT "scavenger_hunt_item_code_unique";--> statement-breakpoint
ALTER TABLE "scavenger_hunt_item" DROP COLUMN "code";--> statement-breakpoint
CREATE UNIQUE INDEX "scavenger_hunt_item_name_unique" ON "scavenger_hunt_item" USING btree (lower("name")) WHERE "scavenger_hunt_item"."deleted_at" IS NULL;
