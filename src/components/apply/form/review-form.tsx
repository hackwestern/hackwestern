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
import { AvatarDisplay } from "../avatar-display";
import { colors } from "~/constants/avatar";

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
        <Button asChild variant="secondary" className="gap-2">
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
    case "character":
      return <AvatarReview step={step} error={error} />;
    case "canvas":
      return <CanvasReview step={step} error={error} />;
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
        className={cn("text-sm text-heavy", {
          "text-medium": isEmptyValue,
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

function AvatarReview({}: ReviewSectionProps) {
  const { data } = api.application.get.useQuery();

  const selectedColor = colors.find(
    (c) => c.name === (data?.avatarColour ?? "green"),
  );

  return (
    <div className="space-y-2">
      <Label>Your Avatar</Label>
      <div
        className="mx-auto -mt-4 flex h-80 w-80 scale-90 flex-col justify-center rounded-2xl p-4 pt-8"
        style={{
          background: `linear-gradient(135deg, ${selectedColor?.bg ?? "#F1FDE0"} 30%, ${selectedColor?.gradient ?? "#A7FB73"} 95%)`,
        }}
      >
        <div className="flex items-center justify-center">
          <AvatarDisplay
            avatarColour={data?.avatarColour}
            avatarFace={data?.avatarFace}
            avatarLeftHand={data?.avatarLeftHand}
            avatarRightHand={data?.avatarRightHand}
            avatarHat={data?.avatarHat}
          />
        </div>
      </div>
    </div>
  );
}

function CanvasReview({}: ReviewSectionProps) {
  const { data } = api.application.get.useQuery();

  type CanvasData = {
    paths: Array<Array<{ x: number; y: number }>>;
    timestamp: number;
    version: string;
  };

  const canvasData = data?.canvasData as CanvasData | null | undefined;
  const pathStrings =
    canvasData?.paths?.map((path) =>
      path.reduce((acc, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        return `${acc} L ${point.x} ${point.y}`;
      }, ""),
    ) ?? [];

  return (
    <div className="space-y-2">
      <Label>Your Drawing</Label>
      {pathStrings.length > 0 ? (
        <div className="overflow-hidden rounded-lg border-2 border-gray-300 bg-white">
          <svg className="h-64 w-full lg:h-72">
            {pathStrings.map((pathString, pathIndex) => (
              <path
                key={pathIndex}
                d={pathString}
                stroke="#a16bc7"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        </div>
      ) : (
        <p className="text-sm text-medium">(no drawing)</p>
      )}
    </div>
  );
}

const reviewSteps = applySteps.slice(0, -1);

export function ReviewForm() {
  const { data } = api.application.get.useQuery();
  const result = applicationSubmitSchema.safeParse(data);
  const error = result.error?.format();
  console.log({ error, result });
  return (
    <div className="overflow-auto">
      {reviewSteps.map((step, idx) => (
        <ReviewSection
          step={step}
          key={idx}
          error={error}
          className={step.step === "canvas" ? "hidden sm:block" : ""}
        />
      ))}
    </div>
  );
}
