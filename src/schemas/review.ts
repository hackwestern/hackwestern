import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { reviews } from "~/server/db/schema";

// Save schema
export const reviewSaveSchema = createInsertSchema(reviews).omit({
  createdAt: true,
  updatedAt: true,
  referral: true,
});

// Submission schema with data validation
export const reviewSubmitSchema = createInsertSchema(reviews, {
  question1Rating: z.number().int().min(1).max(10),
  question2Rating: z.number().int().min(1).max(10),
  question3Rating: z.number().int().min(1).max(10),
  resumeBonus: z.number().int().min(0).max(3),
  githubBonus: z.number().int().min(0).max(3),
  linkedinBonus: z.number().int().min(0).max(3),
  otherlinkBonus: z.number().int().min(0).max(3),
}).omit({
  applicantUserId: true,
  createdAt: true,
  updatedAt: true,
  referral: true,
});

export const referApplicantSchema = createInsertSchema(reviews, {
  applicantUserId: z.string().min(1).max(255),
})