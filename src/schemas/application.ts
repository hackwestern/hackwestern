import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { schools } from "~/constants/schools";

import {
  applications,
  countrySelection,
  levelOfStudy,
  major,
} from "~/server/db/schema";

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

export const personaSaveSchema = applicationSaveSchema.pick({
  avatar: true,
});

export const infoSaveSchema = applicationSaveSchema
  .pick({
    school: true,
    levelOfStudy: true,
    major: true,
    attendedBefore: true,
    numOfHackathons: true,
  })
  .extend({
    attendedBefore: z.enum(["yes", "no"]),
  });

export const agreementsSaveSchema = applicationSaveSchema.pick({
  agreeCodeOfConduct: true,
  agreeShareWithMLH: true,
  agreeShareWithSponsors: true,
  agreeWillBe18: true,
  agreeEmailsFromMLH: true,
});

export const underrepGroupAnswers = [
  "Yes",
  "No",
  "Prefer not to answer",
] as const;
export type UnderrepGroupAnswer = (typeof underrepGroupAnswers)[number];

export const optionalSaveSchema = applicationSaveSchema
  .pick({
    underrepGroup: true,
    gender: true,
    ethnicity: true,
    sexualOrientation: true,
  })
  .extend({
    underrepGroup: z.enum(underrepGroupAnswers),
  });

// Helper function to check word count within a range
const checkWordCount = (value: string, min: number, max: number) => {
  const words = value.split(" ");
  return words.length < max && words.length > min;
};

export const phoneRegex =
  /^(\+\d{1,2}\s?)?1?\-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

// Submission schema with data validation
export const applicationSubmitSchema = createInsertSchema(applications, {
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  age: z.number().min(18),
  countryOfResidence: z.enum(countrySelection.enumValues),
  phoneNumber: z.string().min(1).regex(phoneRegex, "Invalid phone number"),
  school: z.enum(schools),
  levelOfStudy: z.enum(levelOfStudy.enumValues),
  major: z.enum(major.enumValues),
  question1: z
    .string()
    .min(1)
    .refine((value) => checkWordCount(value, 30, 150)),
  question2: z
    .string()
    .min(1)
    .refine((value) => checkWordCount(value, 30, 150)),
  question3: z
    .string()
    .min(1)
    .refine((value) => checkWordCount(value, 30, 150)),
  resumeLink: z.string().min(1).url(),
  githubLink: z.string().min(1),
  linkedInLink: z.string().min(1),
  otherLink: z.string().min(1).url(),
  agreeCodeOfConduct: z.literal(true),
  agreeShareWithMLH: z.literal(true),
  agreeWillBe18: z.literal(true),
}).omit({
  createdAt: true,
  updatedAt: true,
  status: true,
  userId: true,
});

export const applicationStepSaveSchema = applicationSaveSchema.pick({
  question1: true,
  question2: true,
  question3: true,
});
