import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { applications } from "~/server/db/schema";

// Save schema
export const applicationSaveSchema = createInsertSchema(applications).omit({
  createdAt: true,
  updatedAt: true,
  status: true,
  userId: true,
});

export const linksSaveSchema = applicationSaveSchema.pick({
  githubLink: true,
  linkedInLink: true,
  resumeLink: true,
  otherLink: true,
});

export const basicsSaveSchema = applicationSaveSchema.pick({
  firstName: true,
  lastName: true,
  phoneNumber: true,
  age: true,
});

export const agreementsSaveSchema = applicationSaveSchema.pick({
  agreeCodeOfConduct: true,
  agreeShareWithMLH: true,
  agreeShareWithSponsors: true,
  agreeWillBe18: true,
  agreeEmailsFromMLH: true,
});

// Helper function to check word count within a range
const checkWordCount = (value: string, min: number, max: number) => {
  const words = value.split(" ");
  return words.length < max && words.length > min;
};

// Submission schema with data validation
export const applicationSubmitSchema = createInsertSchema(applications, {
  agreeCodeOfConduct: z.literal(true),
  agreeShareWithMLH: z.literal(true),
  agreeShareWithSponsors: z.literal(true),
  agreeWillBe18: z.literal(true),
  age: (schema) => schema.age.min(18),
  resumeLink: (schema) => schema.resumeLink.url(),
  otherLink: (schema) => schema.otherLink.url(),
  question1: (schema) =>
    schema.question1.refine((value) => checkWordCount(value, 30, 150)),
  question2: (schema) =>
    schema.question2.refine((value) => checkWordCount(value, 30, 150)),
  question3: (schema) =>
    schema.question3.refine((value) => checkWordCount(value, 30, 150)),
}).omit({
  createdAt: true,
  updatedAt: true,
  status: true,
  userId: true,
});
