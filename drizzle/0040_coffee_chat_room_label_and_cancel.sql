ALTER TYPE "public"."coffee_chat_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "coffee_chat" ALTER COLUMN "room" SET DATA TYPE varchar(64) USING (CASE "room" WHEN 1 THEN 'Rm 2241' WHEN 2 THEN 'Rm 2242' WHEN 3 THEN 'Rm 2243' ELSE "room"::text END);--> statement-breakpoint
ALTER TABLE "coffee_chat" ALTER COLUMN "room" DROP NOT NULL;