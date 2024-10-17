import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { reviews } from "~/server/db/schema";

// Save schema
export const reviewSaveSchema = createInsertSchema(reviews);

// Submission schema with data validation
export const reviewSubmitSchema = createInsertSchema(reviews, {
  originalityRating: z.number().int().min(1).max(100),
  technicalityRating: z.number().int().min(1).max(100),
  passionRating: z.number().int().min(1).max(100),
  comments: z.string(),
}).omit({
  applicantUserId: true,
  createdAt: true,
  updatedAt: true,
  referral: true,
});

export const referApplicantSchema = createInsertSchema(reviews).pick({
  applicantUserId: true,
});
