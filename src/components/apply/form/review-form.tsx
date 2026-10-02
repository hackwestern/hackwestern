import { PencilLine } from "lucide-react";
import Link from "next/link";
import { type z } from "zod";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { type ApplyStepFull, applySteps } from "~/constants/apply";
import { cn } from "~/lib/utils";
import { applicationSubmitSchema } from "~/schemas/application";
import { api } from "~/utils/api";
import { getHorse, realmLabel } from "~/constants/realms";
import { QUESTION1, QUESTION2, QUESTION3 } from "./application-form";
import React from "react";

type ReviewSectionProps = {
  step: ApplyStepFull;
  error: z.inferFormattedError<typeof applicationSubmitSchema> | undefined;
  className?: string;
};

function ReviewSection({ step, error, className }: ReviewSectionProps) {
  return (
    <div className={cn("py-4", className)}>
      <Separator />
      <div className="flex justify-between pt-4">
        <h2 className="font-jetbrains-mono text-base uppercase text-medium">
          {step.label}
        </h2>
        <Button asChild variant="secondary" className="gap-2 font-figtree">
          <Link href={{ pathname: "/apply", query: { step: step.step } }}>
            <PencilLine className="w-4" />
            Edit
          </Link>
        </Button>
      </div>
      <div className="space-y-4 py-2">
        <ReviewSectionInfo step={step} error={error} />
      </div>
    </div>
  );
}

function ReviewSectionInfo({ step, error }: ReviewSectionProps) {
  switch (step.step) {
    case "basics":
      return <BasicsReview step={step} error={error} />;
    case "info":
      return <InfoReview step={step} error={error} />;
    case "application":
      return <ApplicationReview step={step} error={error} />;
    case "links":
      return <LinksReview step={step} error={error} />;
    case "agreements":
      return <AgreementsReview step={step} error={error} />;
    case "optional":
      return <OptionalReview step={step} error={error} />;
    case "logistics":
      return <LogisticsReview step={step} error={error} />;
    case "realm":
      return <RealmReview step={step} error={error} />;
    default:
      return <></>;
  }
}

type ReviewFieldProps = {
  label: string;
  value: boolean | number | string | null | undefined;
  error: string[] | null | undefined;
};

function ReviewField({ value, label, error }: ReviewFieldProps) {
  const errorMessage = error?.join(", ") ?? null;
  const isEmptyValue = value === "" || value === null || value === undefined;

  let displayValue: React.ReactNode = "";
  if (typeof value === "boolean") {
    displayValue = value ? "Yes" : "No";
  } else if (typeof value === "number") {
    displayValue = value.toString();
  } else if (typeof value === "string") {
    displayValue = value;
  } else if (isEmptyValue) {
    displayValue = "(no answer)";
  }

  if (label === "Resume") {
    // if value is a url, show only the filename
    if (typeof value === "string" && value.startsWith("http")) {
      try {
        const url = new URL(value);
        const pathname = url.pathname;
        const filename = pathname.substring(pathname.lastIndexOf("/") + 1);
        displayValue = filename ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline underline-offset-2 transition-colors hover:text-emphasis"
          >
            {filename}
          </a>
        ) : (
          "(no resume uploaded)"
        );
      } catch {
        displayValue = value;
      }
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p
        className={cn("text-sm text-heavy", {
          "text-medium": isEmptyValue,
        })}
      >
        {displayValue}
      </p>
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage ?? ""}</p>
      )}
    </div>
  );
}

function BasicsReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: ["firstName", "lastName", "phoneNumber", "age"],
  });

  const nameErrors: string[] = [];
  if (!data?.firstName) nameErrors.push("First name is required");
  if (!data?.lastName) nameErrors.push("Last name is required");
  return (
    <>
      <ReviewField
        label="Full Name"
        value={`${data?.firstName ?? ""} ${data?.lastName ?? ""}`}
        error={nameErrors}
      />
      <ReviewField
        label="Phone Number"
        value={data?.phoneNumber}
        error={error?.phoneNumber?._errors}
      />
      <ReviewField label="Age" value={data?.age} error={error?.age?._errors} />
    </>
  );
}

function InfoReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: [
      "school",
      "yearOfStudy",
      "major",
      "attendedBefore",
      "numOfHackathons",
    ],
  });
  return (
    <>
      <ReviewField
        label="Which school do you attend?"
        value={data?.school}
        error={!data?.school ? ["School is required"] : []}
      />
      <ReviewField
        label="Which year are you in?"
        value={data?.yearOfStudy}
        error={!data?.yearOfStudy ? ["Year is required"] : []}
      />
      <ReviewField
        label="What is your major?"
        value={data?.major}
        error={!data?.major ? ["Major is required"] : []}
      />
      <ReviewField
        label="Have you attended Hack Western before?"
        value={data?.attendedBefore}
        error={error?.attendedBefore?._errors}
      />
      <ReviewField
        label="How many hackathons have you attended?"
        value={data?.numOfHackathons}
        error={error?.numOfHackathons?._errors}
      />
    </>
  );
}

function ApplicationReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: ["question1", "question2", "question3"],
  });
  return (
    <>
      <ReviewField
        label={QUESTION1}
        value={data?.question1}
        error={error?.question1?._errors.map((e) =>
          e.includes("Response") ? e : "Response is required",
        )}
      />
      <ReviewField
        label={QUESTION2}
        value={data?.question2}
        error={error?.question2?._errors.map((e) =>
          e.includes("Response") ? e : "Response is required",
        )}
      />
      <ReviewField
        label={QUESTION3}
        value={data?.question3}
        error={error?.question3?._errors.map((e) =>
          e.includes("Response") ? e : "Response is required",
        )}
      />
    </>
  );
}

function LinksReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: ["githubLink", "linkedInLink", "otherLink", "resumeLink"],
  });
  return (
    <>
      <ReviewField
        label="Github"
        value={data?.githubLink}
        error={error?.githubLink?._errors}
      />
      <ReviewField
        label="LinkedIn"
        value={data?.linkedInLink}
        error={error?.linkedInLink?._errors}
      />
      <ReviewField
        label="Personal Portfolio"
        value={data?.otherLink}
        error={error?.otherLink?._errors}
      />
      <ReviewField
        label="Resume"
        value={data?.resumeLink}
        error={error?.resumeLink?._errors}
      />
    </>
  );
}

function AgreementsReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: [
      "agreeCodeOfConduct",
      "agreeShareWithMLH",
      "agreeShareWithSponsors",
      "agreeWillBe18",
      "agreeEmailsFromMLH",
    ],
  });
  return (
    <>
      <ReviewField
        label="I have read and agree to the MLH Code of Conduct"
        value={data?.agreeCodeOfConduct}
        error={error?.agreeCodeOfConduct?._errors}
      />
      <ReviewField
        label="I authorize Hack Western to share my application/registration information with Major League Hacking for event administration, ranking, and MLH administration in-line with the MLH Privacy Policy. I further agree to the terms of the MLH Contest Terms and Conditions"
        value={data?.agreeShareWithMLH}
        error={error?.agreeShareWithMLH?._errors}
      />
      <ReviewField
        label="I give Hack Western permission to share my information with sponsors"
        value={data?.agreeShareWithSponsors}
        error={error?.agreeShareWithSponsors?._errors}
      />
      <ReviewField
        label="I will be at least 18 years old on November 21st, 2025"
        value={data?.agreeWillBe18}
        error={error?.agreeWillBe18?._errors}
      />
      <ReviewField
        label="(Optional) I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements."
        value={data?.agreeEmailsFromMLH}
        error={error?.agreeEmailsFromMLH?._errors}
      />
    </>
  );
}

function OptionalReview({}: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: ["underrepGroup", "gender", "ethnicity", "sexualOrientation"],
  });
  return (
    <>
      <ReviewField
        label="Do you identify as part of an underrepresented group in the technology industry?"
        value={data?.underrepGroup}
        error={null}
      />
      <ReviewField
        label="What is your gender?"
        value={data?.gender}
        error={null}
      />
      <ReviewField
        label="What is your race/ethnicity?"
        value={data?.ethnicity}
        error={null}
      />
      <ReviewField
        label="What is your sexual orientation?"
        value={data?.sexualOrientation}
        error={null}
      />
    </>
  );
}

function LogisticsReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: [
      "shirtSize",
      "dietaryRestrictions",
      "dietaryRestrictionsOther",
      "emergencyContactName",
      "emergencyContactRelationship",
      "emergencyContactPhoneNumber",
    ],
  });
  return (
    <>
      <ReviewField
        label="Shirt size"
        value={data?.shirtSize}
        error={error?.shirtSize?._errors}
      />
      <ReviewField
        label="Dietary restrictions"
        value={
          data?.dietaryRestrictions === "Other"
            ? (data?.dietaryRestrictionsOther ?? "Other")
            : data?.dietaryRestrictions
        }
        error={
          error?.dietaryRestrictions?._errors ??
          error?.dietaryRestrictionsOther?._errors
        }
      />
      <ReviewField
        label="Emergency contact name"
        value={data?.emergencyContactName}
        error={error?.emergencyContactName?._errors}
      />
      <ReviewField
        label="Emergency contact relationship"
        value={data?.emergencyContactRelationship}
        error={error?.emergencyContactRelationship?._errors}
      />
      <ReviewField
        label="Emergency contact phone number"
        value={data?.emergencyContactPhoneNumber}
        error={error?.emergencyContactPhoneNumber?._errors}
      />
    </>
  );
}

function formatHorseName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const name = `${first ?? ""} ${last ?? ""}`.trim();
  return name.length > 0 ? name : "(no name yet)";
}

/* eslint-disable @next/next/no-img-element */
function RealmReview({}: ReviewSectionProps) {
  const { data } = api.application.get.useQuery({
    fields: ["realm", "horseId", "horseFirstName", "horseLastName"],
  });
  const horse = getHorse(data?.horseId);

  return (
    <div className="space-y-2">
      <Label>Your Companion</Label>
      <div className="flex items-center gap-4 rounded-lg bg-highlight/40 p-4">
        {horse && (
          <img
            src={horse.asset}
            alt=""
            className="h-24 w-24 shrink-0 object-contain"
            draggable={false}
          />
        )}
        <div className="flex flex-col">
          <p className="font-figtree text-md-p font-semibold text-heavy">
            {formatHorseName(data?.horseFirstName, data?.horseLastName)}
          </p>
          <p className="font-figtree text-sm-p text-medium">
            {data?.realm
              ? `${realmLabel[data.realm]} realm`
              : "(no realm chosen)"}
          </p>
        </div>
      </div>
    </div>
  );
}

const reviewSteps = applySteps.slice(0, -1);

export function ReviewForm() {
  const { data } = api.application.get.useQuery({
    // fields required by applicationSubmitSchema
    fields: [
      "firstName",
      "lastName",
      "phoneNumber",
      "countryOfResidence",
      "age",
      "school",
      "major",
      "attendedBefore",
      "numOfHackathons",
      "yearOfStudy",
      "question1",
      "question2",
      "question3",
      "resumeLink",
      "githubLink",
      "linkedInLink",
      "otherLink",
      "agreeCodeOfConduct",
      "agreeShareWithMLH",
      "agreeShareWithSponsors",
      "agreeWillBe18",
      "agreeEmailsFromMLH",
      "shirtSize",
      "dietaryRestrictions",
      "dietaryRestrictionsOther",
      "emergencyContactName",
      "emergencyContactRelationship",
      "emergencyContactPhoneNumber",
      "transportationMethod",
    ],
  });
  const result = applicationSubmitSchema.safeParse(data);
  const error = result.error?.format();
  return (
    <div className="overflow-auto">
      {reviewSteps.map((step, idx) => (
        <ReviewSection step={step} key={idx} error={error} />
      ))}
    </div>
  );
}
