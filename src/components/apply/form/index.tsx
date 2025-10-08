import type { ApplyStep } from "~/constants/apply";
import { AvatarForm } from "./avatar-form";
import { BasicsForm } from "./basics-form";
import { InfoForm } from "./info-form";
import { ApplicationForm } from "./application-form";
import { LinksForm } from "./links-form";
import { AgreementsForm } from "./agreements-form";
import { OptionalForm } from "./optional-form";
import { ReviewForm } from "./review-form";

type ApplyFormProps = {
  step: ApplyStep | null;
};

export function ApplyForm({ step }: ApplyFormProps) {
  switch (step) {
    case "character":
      return <AvatarForm />;
    case "basics":
      return <BasicsForm />;
    case "info":
      return <InfoForm />;
    case "application":
      return <ApplicationForm />;
    case "links":
      return <LinksForm />;
    case "agreements":
      return <AgreementsForm />;
    case "optional":
      return <OptionalForm />;
    case "review":
      return <ReviewForm />;
    default:
      return <></>;
  }
}
