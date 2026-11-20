ALTER TABLE "scavenger_hunt_reward" ADD COLUMN "status" "scavenger_hunt_item_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_reward" ADD COLUMN "deleted_at" timestamp (3);--> statement-breakpoint
-- Same rule as items: later duplicate names get their id added ("Hoodie (7)", then "Hoodie (7-1)").
-- The name is cut so the result fits in varchar(255).
DO $$
DECLARE
  r record;
  candidate text;
  n int;
BEGIN
  FOR r IN
    SELECT w."id", w."name" FROM "scavenger_hunt_reward" w
    WHERE EXISTS (
      SELECT 1 FROM "scavenger_hunt_reward" o
      WHERE lower(o."name") = lower(w."name") AND o."id" < w."id"
    )
    ORDER BY w."id"
  LOOP
    n := 0;
    candidate := left(r."name", 220) || ' (' || r."id" || ')';
    WHILE EXISTS (
      SELECT 1 FROM "scavenger_hunt_reward" WHERE lower("name") = lower(candidate)
    ) LOOP
      n := n + 1;
      candidate := left(r."name", 220) || ' (' || r."id" || '-' || n || ')';
    END LOOP;
    UPDATE "scavenger_hunt_reward" SET "name" = candidate WHERE "id" = r."id";
  END LOOP;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "scavenger_hunt_reward_name_unique" ON "scavenger_hunt_reward" USING btree (lower("name")) WHERE "scavenger_hunt_reward"."deleted_at" IS NULL;