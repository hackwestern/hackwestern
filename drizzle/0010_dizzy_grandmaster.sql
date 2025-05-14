ALTER TABLE "hw11_account" RENAME TO "hw_account";--> statement-breakpoint
ALTER TABLE "hw11_application" RENAME TO "hw_application";--> statement-breakpoint
ALTER TABLE "hw11_preregistration" RENAME TO "hw_preregistration";--> statement-breakpoint
ALTER TABLE "hw11_resetPasswordToken" RENAME TO "hw_resetPasswordToken";--> statement-breakpoint
ALTER TABLE "hw11_review" RENAME TO "hw_review";--> statement-breakpoint
ALTER TABLE "hw11_session" RENAME TO "hw_session";--> statement-breakpoint
ALTER TABLE "hw11_user" RENAME TO "hw_user";--> statement-breakpoint
ALTER TABLE "hw11_verificationToken" RENAME TO "hw_verificationToken";--> statement-breakpoint
ALTER TABLE "hw_preregistration" DROP CONSTRAINT "hw11_preregistration_email_unique";--> statement-breakpoint
ALTER TABLE "hw_account" DROP CONSTRAINT "hw11_account_userId_hw11_user_id_fk";
--> statement-breakpoint
ALTER TABLE "hw_application" DROP CONSTRAINT "hw11_application_user_id_hw11_user_id_fk";
--> statement-breakpoint
ALTER TABLE "hw_resetPasswordToken" DROP CONSTRAINT "hw11_resetPasswordToken_userId_hw11_user_id_fk";
--> statement-breakpoint
ALTER TABLE "hw_review" DROP CONSTRAINT "hw11_review_reviewer_user_id_hw11_user_id_fk";
--> statement-breakpoint
ALTER TABLE "hw_review" DROP CONSTRAINT "hw11_review_applicant_user_id_hw11_application_user_id_fk";
--> statement-breakpoint
ALTER TABLE "hw_review" DROP CONSTRAINT "hw11_review_applicant_user_id_hw11_user_id_fk";
--> statement-breakpoint
ALTER TABLE "hw_session" DROP CONSTRAINT "hw11_session_userId_hw11_user_id_fk";
--> statement-breakpoint
ALTER TABLE "hw_account" DROP CONSTRAINT "hw11_account_provider_providerAccountId_pk";--> statement-breakpoint
ALTER TABLE "hw_review" DROP CONSTRAINT "hw11_review_reviewer_user_id_applicant_user_id_pk";--> statement-breakpoint
ALTER TABLE "hw_verificationToken" DROP CONSTRAINT "hw11_verificationToken_identifier_token_pk";--> statement-breakpoint
ALTER TABLE "hw_account" ADD CONSTRAINT "hw_account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId");--> statement-breakpoint
ALTER TABLE "hw_review" ADD CONSTRAINT "hw_review_reviewer_user_id_applicant_user_id_pk" PRIMARY KEY("reviewer_user_id","applicant_user_id");--> statement-breakpoint
ALTER TABLE "hw_verificationToken" ADD CONSTRAINT "hw_verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token");--> statement-breakpoint
ALTER TABLE "hw_account" ADD CONSTRAINT "hw_account_userId_hw_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_application" ADD CONSTRAINT "hw_application_user_id_hw_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."hw_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_resetPasswordToken" ADD CONSTRAINT "hw_resetPasswordToken_userId_hw_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_review" ADD CONSTRAINT "hw_review_reviewer_user_id_hw_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_review" ADD CONSTRAINT "hw_review_applicant_user_id_hw_application_user_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."hw_application"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_review" ADD CONSTRAINT "hw_review_applicant_user_id_hw_user_id_fk" FOREIGN KEY ("applicant_user_id") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_session" ADD CONSTRAINT "hw_session_userId_hw_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."hw_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hw_preregistration" ADD CONSTRAINT "hw_preregistration_email_unique" UNIQUE("email");