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

function minWordCount(value: string, min: number) {
  const words = value.trim().split(/\s+/);
  return min <= words.length;
}

function maxWordCount(value: string, max: number) {
  const words = value.trim().split(/\s+/);
  return words.length <= max;
}

export const phoneRegex =
  /^(\+\d{1,2}\s?)?1?\-?\.?\s?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

const MIN_WORDS = 30;
const MAX_WORDS = 150;

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
    .refine(
      (value) => minWordCount(value, MIN_WORDS),
      `Response must be at least ${MIN_WORDS} words`,
    )
    .refine(
      (value) => maxWordCount(value, MAX_WORDS),
      `Response must be less than ${MAX_WORDS} words`,
    ),
  question2: z
    .string()
    .min(1)
    .refine(
      (value) => minWordCount(value, MIN_WORDS),
      `Response must be at least ${MIN_WORDS} words`,
    )
    .refine(
      (value) => maxWordCount(value, MAX_WORDS),
      `Response must be less than ${MAX_WORDS} words`,
    ),
  question3: z
    .string()
    .min(1)
    .refine(
      (value) => minWordCount(value, MIN_WORDS),
      `Response must be at least ${MIN_WORDS} words`,
    )
    .refine(
      (value) => maxWordCount(value, MAX_WORDS),
      `Response must be less than ${MAX_WORDS} words`,
    ),
  resumeLink: z.preprocess(
    (v) => (!v ? undefined : v),
    z.string().url().optional(),
  ),
  githubLink: z.preprocess((v) => (!v ? undefined : v), z.string().optional()),
  linkedInLink: z.preprocess(
    (v) => (!v ? undefined : v),
    z.string().optional(),
  ),
  otherLink: z.preprocess(
    (v) => (!v ? undefined : v),
    z.string().url().optional(),
  ),
  agreeCodeOfConduct: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the MLH Code of Conduct" }),
  }),
  agreeShareWithMLH: z.literal(true, {
    errorMap: () => ({
      message: "You must agree to share application information with MLH",
    }),
  }),
  agreeShareWithSponsors: z.literal(true, {
    errorMap: () => ({
      message: "You must agree to share information with sponsors",
    }),
  }),
  agreeWillBe18: z.literal(true, {
    errorMap: () => ({
      message: "You must be at least 18 years old as of November 29th, 2024",
    }),
  }),
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
