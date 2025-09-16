ALTER TYPE "public"."avatar" RENAME TO "avatar_colour";--> statement-breakpoint
ALTER TABLE "hw_application" RENAME COLUMN "avatar" TO "avatar_colour";--> statement-breakpoint
ALTER TABLE "hw_application" ADD COLUMN "avatar_face" integer;--> statement-breakpoint
ALTER TABLE "hw_application" ADD COLUMN "avatar_left_hand" integer;--> statement-breakpoint
ALTER TABLE "hw_application" ADD COLUMN "avatar_right_hand" integer;--> statement-breakpoint
ALTER TABLE "hw_application" ADD COLUMN "avatar_hat" integer;--> statement-breakpoint
ALTER TABLE "public"."hw_application" ALTER COLUMN "avatar_colour" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."avatar_colour";--> statement-breakpoint
CREATE TYPE "public"."avatar_colour" AS ENUM('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink');--> statement-breakpoint
ALTER TABLE "public"."hw_application" ALTER COLUMN "avatar_colour" SET DATA TYPE "public"."avatar_colour" USING "avatar_colour"::"public"."avatar_colour";