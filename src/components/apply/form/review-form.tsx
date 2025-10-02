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

type ReviewSectionProps = {
  step: ApplyStepFull;
  error: z.inferFormattedError<typeof applicationSubmitSchema> | undefined;
};

function ReviewSection({ step, error }: ReviewSectionProps) {
  return (
    <div className="py-4">
      <Separator />
      <div className="flex justify-between pt-4">
        <h2>{step.label}</h2>
        <Button asChild variant="apply" className="gap-2">
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
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p
        className={cn("text-sm text-slate-600", {
          "text-slate-400": isEmptyValue,
        })}
      >
        {isEmptyValue ? "(no answer)" : value?.toString()}
      </p>
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage ?? ""}</p>
      )}
    </div>
  );
}

function BasicsReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery();

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
  const { data } = api.application.get.useQuery();
  return (
    <>
      <ReviewField
        label="Which school do you attend?"
        value={data?.school}
        error={!data?.school ? ["School is required"] : []}
      />
      <ReviewField
        label="Which year are you in?"
        value={data?.levelOfStudy}
        error={!data?.levelOfStudy ? ["Year is required"] : []}
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
  const { data } = api.application.get.useQuery();
  return (
    <>
      <ReviewField
        label="If you could have any superpower to help you during Hack Western, what would it be and why?"
        value={data?.question1}
        error={error?.question1?._errors.map((e) =>
          e.includes("Response") ? e : "Response is required",
        )}
      />
      <ReviewField
        label="If you could build your own dream destination what would it look like? Be as detailed and creative as you want!"
        value={data?.question2}
        error={error?.question2?._errors.map((e) =>
          e.includes("Response") ? e : "Response is required",
        )}
      />
      <ReviewField
        label="What project (anything you have ever worked on not just restricted to tech) of yours are you the most proud of and why? What did you learn throughout the process?"
        value={data?.question3}
        error={error?.question3?._errors.map((e) =>
          e.includes("Response") ? e : "Response is required",
        )}
      />
    </>
  );
}

function LinksReview({ error }: ReviewSectionProps) {
  const { data } = api.application.get.useQuery();
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
  const { data } = api.application.get.useQuery();
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
        label="I will be at least 18 years old on November 29th, 2024"
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
  const { data } = api.application.get.useQuery();
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

const reviewSteps = applySteps.slice(1, -1);

export function ReviewForm() {
  const { data } = api.application.get.useQuery();
  const result = applicationSubmitSchema.safeParse(data);
  const error = result.error?.format();
  console.log({ error, result });
  return (
    <div className="overflow-auto">
      {reviewSteps.map((step, idx) => (
        <ReviewSection step={step} key={idx} error={error} />
      ))}
    </div>
  );
}
