import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { schools } from "~/constants/schools";

import {
  applications,
  countrySelection,
  major,
  numOfHackathons,
  gender,
  ethnicity,
  sexualOrientation,
  yearOfStudy,
  shirtSize,
  dietaryRestrictions,
  emergencyContactRelationship,
} from "~/server/db/schema";

// Save schema
export const applicationSaveSchema = createInsertSchema(applications)
  .omit({
    createdAt: true,
    updatedAt: true,
    status: true,
    userId: true,
    transportationMethod: true,
  })
  .extend({
    devpostLink: z.string().nullish(),
    githubLink: z.string().nullish(),
    linkedInLink: z.string().nullish(),
  });

export const linksSaveSchema = applicationSaveSchema.pick({
  devpostLink: true,
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

export const HORSE_NAME_MAX_LENGTH = 24;

export const realmSaveSchema = applicationSaveSchema
  .pick({
    realm: true,
    horseId: true,
    horseFirstName: true,
    horseLastName: true,
  })
  .extend({
    horseFirstName: z
      .string()
      .trim()
      .max(HORSE_NAME_MAX_LENGTH, {
        message: `Keep it under ${HORSE_NAME_MAX_LENGTH} characters.`,
      })
      .nullish(),
    horseLastName: z
      .string()
      .trim()
      .max(HORSE_NAME_MAX_LENGTH, {
        message: `Keep it under ${HORSE_NAME_MAX_LENGTH} characters.`,
      })
      .nullish(),
  });

export const infoSaveSchema = z.object({
  school: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.enum(schools).optional(),
  ),
  yearOfStudy: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.enum(yearOfStudy.enumValues).optional(),
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

export const logisticsSaveSchema = applicationSaveSchema
  .pick({
    shirtSize: true,
    dietaryRestrictions: true,
    dietaryRestrictionsOther: true,
    emergencyContactName: true,
    emergencyContactRelationship: true,
    emergencyContactPhoneNumber: true,
  })
  .extend({
    // Allow empty-string selections (unselected dropdowns/radios) to be
    // treated as undefined so partial autosaves don't fail validation.
    shirtSize: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.enum(shirtSize.enumValues).optional(),
    ),
    dietaryRestrictions: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.enum(dietaryRestrictions.enumValues).optional(),
    ),
    emergencyContactRelationship: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.enum(emergencyContactRelationship.enumValues).optional(),
    ),
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

const tooFewWords = `Response must be at least ${MIN_WORDS} words`;
const tooManyWords = `Response must be fewer than ${MAX_WORDS} words`;

// Submission schema with data validation
// The years an applicant can pick. The year_of_study enum also has "N/A" and
// "Prefer not to answer"; they stay valid in the database (an HW13 application
// was submitted with one) but can't be chosen or submitted anymore.
export const YEAR_OF_STUDY_OPTIONS = [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th+",
] as const;

export const isValidYearOfStudy = (value: unknown) =>
  (YEAR_OF_STUDY_OPTIONS as readonly unknown[]).includes(value);

export const applicationSubmitSchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phoneNumber: z.string().min(1).regex(phoneRegex, "Invalid phone number"),
    countryOfResidence: z.enum(countrySelection.enumValues),
    age: z.number().min(18).max(99),
    school: z.enum(schools),
    yearOfStudy: z.enum(YEAR_OF_STUDY_OPTIONS),
    major: z.enum(major.enumValues),
    attendedBefore: z.boolean(),
    numOfHackathons: z.enum(numOfHackathons.enumValues),
    question1: z
      .string()
      .min(1)
      .refine((value) => minWordCount(value, MIN_WORDS), tooFewWords)
      .refine((value) => maxWordCount(value, MAX_WORDS), tooManyWords),
    question2: z
      .string()
      .min(1)
      .refine((value) => minWordCount(value, MIN_WORDS), tooFewWords)
      .refine((value) => maxWordCount(value, MAX_WORDS), tooManyWords),
    question3: z
      .string()
      .min(1)
      .refine((value) => minWordCount(value, MIN_WORDS), tooFewWords)
      .refine((value) => maxWordCount(value, MAX_WORDS), tooManyWords),
    resumeLink: z.preprocess((v) => (!v ? undefined : v), z.string().url()),
    githubLink: z.preprocess(
      (v) => (!v ? undefined : v),
      z.string().optional(),
    ),
    linkedInLink: z.preprocess(
      (v) => (!v ? undefined : v),
      z.string().optional(),
    ),
    otherLink: z.preprocess(
      (v) => (!v ? undefined : v),
      z.string().url().optional(),
    ),
    agreeCodeOfConduct: z.literal(true, {
      errorMap: () => ({
        message: "You must agree to the MLH Code of Conduct",
      }),
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
        message: "You must be at least 18 years old as of November 20th, 2026",
      }),
    }),
    agreeEmailsFromMLH: z.boolean().optional(),

    // RSVP fields
    shirtSize: z.enum(shirtSize.enumValues),
    dietaryRestrictions: z.preprocess(
      (v) => (!v ? undefined : v),
      z.enum(dietaryRestrictions.enumValues),
    ),

    dietaryRestrictionsOther: z.string().max(255).nullish(),
    emergencyContactName: z.string().min(1),
    emergencyContactRelationship: z.enum(
      emergencyContactRelationship.enumValues,
    ),
    emergencyContactPhoneNumber: z
      .string()
      .min(1)
      .regex(phoneRegex, "Invalid phone number"),
  })
  .superRefine((data, ctx) => {
    if (
      data.dietaryRestrictions === "Other" &&
      !data.dietaryRestrictionsOther?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify your dietary restriction",
        path: ["dietaryRestrictionsOther"],
      });
    }
  });

export const canvasSaveSchema = applicationSaveSchema.pick({
  canvasData: true,
});

export const applicationStepSaveSchema = applicationSaveSchema.pick({
  question1: true,
  question2: true,
  question3: true,
});
