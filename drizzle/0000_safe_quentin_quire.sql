DO $$ BEGIN
 CREATE TYPE "public"."application_status" AS ENUM('IN_PROGRESS', 'PENDING_REVIEW', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'WAITLISTED', 'DECLINED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."race/ethnicity" AS ENUM('American Indian or Alaskan Native', 'Asian / Pacific Islander', 'Black or African American', 'Hispanic', 'White / Caucasian', 'Multiple ethnicity / Other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."gender" AS ENUM('Female', 'Male', 'Non-Binary', 'Other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."level_of_study" AS ENUM('Less than Secondary / High School', 'Secondary / High School', 'Undergraduate University (2 year - community college etc.)', 'Undergraduate University (3+ year)', 'Graduate University (Masters, Professional, Doctoral, etc)', 'Code School / Bootcamp', 'Other Vocational / Trade Program or Apprenticeship', 'Post Doctorate', 'Other', 'Not currently a student', 'Prefer not to answer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."major" AS ENUM('Computer Science', 'Computer Engineering', 'Software Engineering', 'Other Engineering Discipline', 'Information Systems', 'Information Technology', 'System Administration', 'Natural Sciences (Biology, Chemistry, Physics, etc.)', 'Mathematics/Statistics', 'Web Development/Web Design', 'Business Administration', 'Humanities', 'Social Science', 'Fine Arts/Performing Arts', 'Other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."num_of_hackathons" AS ENUM('0', '1-3', '4-6', '7+');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."sexual_orientation" AS ENUM('Asexual / Aromantic', 'Pansexual, Demisexual or Omnisexual', 'Bisexual', 'Queer', 'Gay / Lesbian', 'Heterosexual / Straight', 'Other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_type" AS ENUM('hacker', 'organizer', 'sponsor');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hw11_account" (
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
	CONSTRAINT "hw11_account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hw11_application" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) DEFAULT now() NOT NULL,
	"status" "application_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"date_of_birth" timestamp DEFAULT now() NOT NULL,
	"phone_number" varchar(42),
	"country_of_residence" smallint,
	"name" varchar(255),
	"level_of_study" "level_of_study",
	"major" "major",
	"attended" boolean DEFAULT false NOT NULL,
	"num_of_hackathons" "num_of_hackathons" DEFAULT '0' NOT NULL,
	"idea_to_life" text,
	"interest_and_passions" text,
	"technology_inspires" text,
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
	"sexual_orientation" "sexual_orientation"
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hw11_preregistration" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp (3) DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"email" varchar(320) NOT NULL,
	CONSTRAINT "hw11_preregistration_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hw11_resetPasswordToken" (
	"userId" varchar(255) PRIMARY KEY NOT NULL,
	"token" varchar(255),
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hw11_session" (
	"sessionToken" varchar(255) PRIMARY KEY NOT NULL,
	"userId" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hw11_user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"emailVerified" timestamp DEFAULT CURRENT_TIMESTAMP,
	"image" varchar(255),
	"type" "user_type" DEFAULT 'hacker'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hw11_verificationToken" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "hw11_verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hw11_account" ADD CONSTRAINT "hw11_account_userId_hw11_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."hw11_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hw11_application" ADD CONSTRAINT "hw11_application_user_id_hw11_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hw11_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hw11_resetPasswordToken" ADD CONSTRAINT "hw11_resetPasswordToken_userId_hw11_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."hw11_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hw11_session" ADD CONSTRAINT "hw11_session_userId_hw11_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."hw11_user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "hw11_account" ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_id_idx" ON "hw11_application" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "hw11_session" ("userId");