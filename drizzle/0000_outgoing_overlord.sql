CREATE TYPE "public"."application_status" AS ENUM('IN_PROGRESS', 'PENDING_REVIEW', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'DECLINED');--> statement-breakpoint
CREATE TYPE "public"."avatar_colour" AS ENUM('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink');--> statement-breakpoint
CREATE TYPE "public"."country" AS ENUM('Canada', 'United States', 'India', 'Other');--> statement-breakpoint
CREATE TYPE "public"."race/ethnicity" AS ENUM('American Indian or Alaskan Native', 'Asian / Pacific Islander', 'Black or African American', 'Hispanic', 'White / Caucasian', 'Multiple ethnicity / Other', 'Prefer not to answer');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('Female', 'Male', 'Non-Binary', 'Other', 'Prefer not to answer');--> statement-breakpoint
CREATE TYPE "public"."level_of_study" AS ENUM('Less than Secondary / High School', 'Secondary / High School', 'Undergraduate University (2 year - community college etc.)', 'Undergraduate University (3+ year)', 'Graduate University (Masters, Professional, Doctoral, etc)', 'Code School / Bootcamp', 'Other Vocational / Trade Program or Apprenticeship', 'Post Doctorate', 'Other', 'Not currently a student', 'Prefer not to answer');--> statement-breakpoint
CREATE TYPE "public"."major" AS ENUM('Computer Science', 'Computer Engineering', 'Software Engineering', 'Other Engineering Discipline', 'Information Systems', 'Information Technology', 'System Administration', 'Natural Sciences (Biology, Chemistry, Physics, etc.)', 'Mathematics/Statistics', 'Web Development/Web Design', 'Business Administration', 'Humanities', 'Social Science', 'Fine Arts/Performing Arts', 'Other');--> statement-breakpoint
CREATE TYPE "public"."num_of_hackathons" AS ENUM('0', '1-3', '4-6', '7+');--> statement-breakpoint
CREATE TYPE "public"."sexual_orientation" AS ENUM('Asexual / Aromantic', 'Pansexual, Demisexual or Omnisexual', 'Bisexual', 'Queer', 'Gay / Lesbian', 'Heterosexual / Straight', 'Other', 'Prefer not to answer');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('hacker', 'organizer', 'sponsor');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"providerAccountId" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "application" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"status" "application_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"avatar_colour" "avatar_colour",
	"avatar_face" integer,
	"avatar_left_hand" integer,
	"avatar_right_hand" integer,
	"avatar_hat" integer,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"age" integer,
	"phone_number" varchar(42),
	"country_of_residence" "country",
	"name" varchar(255),
	"level_of_study" "level_of_study",
	"major" "major",
	"attended" boolean,
	"num_of_hackathons" "num_of_hackathons",
	"question1" text,
	"question2" text,
	"question3" text,
	"resume_link" varchar(2048),
	"github_link" varchar(2048),
	"linkedin_link" varchar(2048),
	"other_link" varchar(2048),
	"agree_code_of_conduct" boolean DEFAULT false NOT NULL,
	"agree_share_with_sponsors" boolean DEFAULT false NOT NULL,
	"agree_share_with_mlh" boolean DEFAULT false NOT NULL,
	"agree_emails_from_mlh" boolean DEFAULT false NOT NULL,
	"agree_will_be_18" boolean DEFAULT false NOT NULL,
	"underrep_group" boolean,
	"gender" "gender",
	"ethnicity" "race/ethnicity",
	"sexual_orientation" "sexual_orientation",
	"canvas_data" jsonb DEFAULT '{"paths":[],"timestamp":0,"version":""}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preregistration" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"email" varchar(320) NOT NULL,
	CONSTRAINT "preregistration_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "reset_password_token" (
	"userId" varchar(255) PRIMARY KEY NOT NULL,
	"token" varchar(255),
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"reviewer_user_id" varchar(255) NOT NULL,
	"applicant_user_id" varchar(255) NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"originality_rating" smallint DEFAULT 0,
	"technicality_rating" smallint DEFAULT 0,
	"passion_rating" smallint DEFAULT 0,
	"comments" text,
	"completed" boolean DEFAULT false,
	"referral" boolean DEFAULT false,
	CONSTRAINT "review_reviewer_user_id_applicant_user_id_pk" PRIMARY KEY("reviewer_user_id","applicant_user_id")
);
--> statement-breakpoint
CREATE TABLE "scavenger_hunt_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(12) NOT NULL,
	"points" smallint DEFAULT 1 NOT NULL,
	"description" text,
	"deleted_at" timestamp (3),
	CONSTRAINT "scavenger_hunt_item_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "scavenger_hunt_redemption" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"reward_id" integer NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scavenger_hunt_reward" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"cost_points" smallint NOT NULL,
	"description" text,
	"quantity" integer
);
--> statement-breakpoint
CREATE TABLE "scavenger_hunt_scan" (
	"user_id" varchar(255) NOT NULL,
	"scanner_id" varchar(255) NOT NULL,
	"item_id" integer NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	CONSTRAINT "scavenger_hunt_scan_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"password" varchar(255),
	"email" varchar(255) NOT NULL,
	"emailVerified" timestamp DEFAULT CURRENT_TIMESTAMP,
	"image" varchar(255),
	"type" "user_type" DEFAULT 'hacker',
	"scavenger_hunt_earned" integer DEFAULT 0,
	"scavenger_hunt_balance" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "verification_token" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reset_password_token" ADD CONSTRAINT "reset_password_token_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_applicant_user_id_application_user_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."application"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_applicant_user_id_user_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_redemption" ADD CONSTRAINT "scavenger_hunt_redemption_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_redemption" ADD CONSTRAINT "scavenger_hunt_redemption_reward_id_scavenger_hunt_reward_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."scavenger_hunt_reward"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_scan" ADD CONSTRAINT "scavenger_hunt_scan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_scan" ADD CONSTRAINT "scavenger_hunt_scan_scanner_id_user_id_fk" FOREIGN KEY ("scanner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scavenger_hunt_scan" ADD CONSTRAINT "scavenger_hunt_scan_item_id_scavenger_hunt_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."scavenger_hunt_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_id_idx" ON "application" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "applicant_user_id_idx" ON "review" USING btree ("applicant_user_id");--> statement-breakpoint
CREATE INDEX "redemption_user_idx" ON "scavenger_hunt_redemption" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scan_user_idx" ON "scavenger_hunt_scan" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "scan_scanner_idx" ON "scavenger_hunt_scan" USING btree ("scanner_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "user_scavenger_hunt_earned_idx" ON "user" USING btree ("scavenger_hunt_earned");--> statement-breakpoint
CREATE INDEX "user_scavenger_hunt_balance_idx" ON "user" USING btree ("scavenger_hunt_balance");