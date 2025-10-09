import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { schools } from "~/constants/schools";

import {
  applications,
  countrySelection,
  levelOfStudy,
  major,
  numOfHackathons,
  gender,
  ethnicity,
  sexualOrientation,
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
  countryOfResidence: true,
});

export const personaSaveSchema = applicationSaveSchema.pick({
  avatarColour: true,
  avatarFace: true,
  avatarLeftHand: true,
  avatarRightHand: true,
  avatarHat: true,
});

export const infoSaveSchema = z.object({
  school: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.enum(schools).optional(),
  ),
  levelOfStudy: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.enum(levelOfStudy.enumValues).optional(),
  ),
  major: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.enum(major.enumValues).optional(),
  ),
  attendedBefore: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.enum(["yes", "no"]).optional(),
  ),
  numOfHackathons: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.enum(numOfHackathons.enumValues).optional(),
  ),
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
    // Allow empty string values (which can occur from uncontrolled selects) to
    // be treated as undefined so validation of optional enum fields doesn't
    // fail during autosave/navigation.
    gender: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.enum(gender.enumValues).optional(),
    ),
    ethnicity: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.enum(ethnicity.enumValues).optional(),
    ),
    sexualOrientation: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.enum(sexualOrientation.enumValues).optional(),
    ),
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
export const applicationSubmitSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().min(1).regex(phoneRegex, "Invalid phone number"),
  countryOfResidence: z.enum(countrySelection.enumValues),
  age: z.number().min(18),
  school: z.enum(schools),
  levelOfStudy: z.enum(levelOfStudy.enumValues),
  major: z.enum(major.enumValues),
  attendedBefore: z.boolean(),
  numOfHackathons: z.enum(numOfHackathons.enumValues),
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
  resumeLink: z.preprocess((v) => (!v ? undefined : v), z.string().url()),
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
  agreeEmailsFromMLH: z.boolean().optional(),
});

export const canvasSaveSchema = applicationSaveSchema.pick({
  canvasData: true,
});

export const applicationStepSaveSchema = applicationSaveSchema.pick({
  question1: true,
  question2: true,
  question3: true,
});
