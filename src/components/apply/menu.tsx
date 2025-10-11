import { applySteps, type ApplyStep } from "~/constants/apply";
import { Button } from "../ui/button";
import Link from "next/link";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from "../ui/drawer";
import { Menu, Check } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import { DialogTitle } from "@radix-ui/react-dialog";
import { api } from "~/utils/api";

type ApplyMenuProps = {
  step: ApplyStep | null;
};

// Step started boolean: true when any fields for the step are filled

type MenuItemProps = {
  s: { step: string; label: string };
  currentStep: ApplyStep | null;
  stepStatuses: Record<ApplyStep, boolean>;
  className?: string;
};

function MenuItem({ s, currentStep, stepStatuses, className }: MenuItemProps) {
  const status = stepStatuses[s.step as ApplyStep];
  return (
    <Button
      variant={s.step === currentStep ? "apply-ghost" : "apply"}
      className={`${className ?? ""} flex items-center justify-between`}
      asChild
    >
      <Link href={{ pathname: "/apply", query: { step: s.step } }}>
        <span>{s.label}</span>
        {status && <Check className="h-4 w-4" />}
      </Link>
    </Button>
  );
}

// Helper: compute status for each step (not_started, started, or completed)
function computeStepStatuses(
  application: Record<string, unknown> | null | undefined,
): Record<ApplyStep, boolean> {
  // Agreement fields where false should be treated as empty
  const agreementFields = new Set([
    "agreeCodeOfConduct",
    "agreeShareWithMLH",
    "agreeShareWithSponsors",
    "agreeWillBe18",
    "agreeEmailsFromMLH",
  ]);

  const isEmpty = (v: unknown, fieldName?: string) => {
    if (v === null || v === undefined) return true;
    if (typeof v === "string" && v.trim() === "") return true;
    // For agreement fields, false = not agreed (empty)
    if (
      typeof v === "boolean" &&
      v === false &&
      fieldName &&
      agreementFields.has(fieldName)
    ) {
      return true;
    }
    if (typeof v === "number") return false; // numbers are considered filled
    // Special case for canvasData: check if paths array is empty
    if (typeof v === "object" && v !== null && "paths" in v) {
      const paths = (v as { paths: unknown }).paths;
      if (Array.isArray(paths) && paths.length === 0) return true;
    }
    return false;
  };

  const stepFields: Record<string, string[]> = {
    character: [
      "avatarColour",
      "avatarFace",
      "avatarLeftHand",
      "avatarRightHand",
      "avatarHat",
    ],
    basics: [
      "firstName",
      "lastName",
      "phoneNumber",
      "age",
      "countryOfResidence",
    ],
    info: [
      "school",
      "levelOfStudy",
      "major",
      "attendedBefore",
      "numOfHackathons",
    ],
    application: ["question1", "question2", "question3"],
    links: ["githubLink", "linkedInLink", "resumeLink", "otherLink"],
    agreements: [
      "agreeCodeOfConduct",
      "agreeShareWithMLH",
      "agreeShareWithSponsors",
      "agreeWillBe18",
      "agreeEmailsFromMLH",
    ],
    optional: ["underrepGroup", "gender", "ethnicity", "sexualOrientation"],
    canvas: ["canvasData"],
    review: [],
  };

  // Mandatory fields from applicationSubmitSchema
  const mandatoryFields: Record<string, string[]> = {
    character: [
      "avatarColour",
      "avatarFace",
      "avatarLeftHand",
      "avatarRightHand",
      "avatarHat",
    ],
    basics: [
      "firstName",
      "lastName",
      "phoneNumber",
      "age",
      "countryOfResidence",
    ],
    info: [
      "school",
      "levelOfStudy",
      "major",
      "attendedBefore",
      "numOfHackathons",
    ],
    application: ["question1", "question2", "question3"],
    links: ["resumeLink"],
    agreements: [
      "agreeCodeOfConduct",
      "agreeShareWithMLH",
      "agreeShareWithSponsors",
      "agreeWillBe18",
    ],
    optional: [],
    canvas: [],
    review: [],
  };

  const result = {} as Record<ApplyStep, boolean>;

  for (const stepObj of applySteps) {
    const stepName = stepObj.step as ApplyStep;
    const fields = stepFields[stepName] ?? [];
    const mandatory = mandatoryFields[stepName] ?? [];

    // Check how many fields are filled
    const filledCount = fields.filter(
      (f) =>
        !isEmpty((application as Record<string, unknown> | undefined)?.[f], f),
    ).length;

    // Check if all mandatory fields are filled
    const allMandatoryFilled =
      mandatory.length === 0 ||
      mandatory.every(
        (f) =>
          !isEmpty(
            (application as Record<string, unknown> | undefined)?.[f],
            f,
          ),
      );

    // A step is considered "started" if any of its fields are filled.
    result[stepName] = filledCount > 0;
  }

  return result;
}

export function ApplyMenu({ step }: ApplyMenuProps) {
  const { data: application } = api.application.get.useQuery();
  const status = application?.status ?? "NOT_STARTED";

  if (status !== "NOT_STARTED" && status !== "IN_PROGRESS") {
    return null;
  }

  const stepStatuses: Record<ApplyStep, boolean> = useMemo(() => {
    return computeStepStatuses(application);
  }, [application]);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="mx-auto hidden h-screen w-56 gap-3 border-[1px] bg-white py-3 shadow-[5px_0px_10px_0px_rgba(129,74,83,0.1)] md:block 2xl:w-72 3xl:w-80">
        <div className="mx-4 flex flex-col gap-2">
          <div className="my-8 ml-2 flex flex-col gap-8">
            <Link href="/dashboard" className="cursor-pointer">
              <Image
                src="/horse.svg"
                alt="Hack Western Logo"
                width={40}
                height={60}
              />
            </Link>
            <div className="gap-2">
              <h1 className="font-figtree font-bold text-heavy">
                Application Portal
              </h1>
              <h2 className="font-figtree font-semibold text-medium">
                Hack Western 12
              </h2>
            </div>
          </div>
          {applySteps.map((s) => (
            <MenuItem
              key={s.step}
              s={s}
              currentStep={step}
              stepStatuses={stepStatuses}
              className="mx-auto w-48 justify-start text-left 2xl:w-64 3xl:w-72"
            />
          ))}
        </div>
      </div>

      {/* Mobile Hamburger Menu */}
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <Drawer direction="left">
          <DrawerTrigger asChild>
            <Button variant="apply" className="rounded-2xl p-2.5">
              <Menu strokeWidth={2.5} className="size-5 text-primary-600" />
            </Button>
          </DrawerTrigger>
          <DrawerContent side="left" className="max-h-screen">
            <DialogTitle aria-describedby="mobile-apply-menu">
              <div className="mx-4 my-6 space-y-4">
                <div className="flex items-center gap-4">
                  <Link href="/dashboard">
                    <Image
                      src="/horse.svg"
                      alt="Hack Western Logo"
                      width={32}
                      height={48}
                    />
                  </Link>
                  <div>
                    <h1 className="font-figtree text-lg font-bold text-heavy">
                      Application Portal
                    </h1>
                    <h2 className="font-figtree text-sm font-semibold text-medium">
                      Hack Western 12
                    </h2>
                  </div>
                </div>
                <div className="space-y-2">
                  {applySteps.map((s) => (
                    <DrawerClose key={s.step} asChild>
                      <MenuItem
                        s={s}
                        currentStep={step}
                        stepStatuses={stepStatuses}
                        className="w-64 justify-start px-4 text-left"
                      />
                    </DrawerClose>
                  ))}
                </div>
              </div>
            </DialogTitle>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
