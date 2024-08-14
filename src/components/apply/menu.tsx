import { applySteps, type ApplyStep } from "~/constants/apply";
import { Button } from "../ui/button";
import Link from "next/link";

type ApplyMenuProps = {
  step: ApplyStep | undefined;
};

export function ApplyMenu({ step }: ApplyMenuProps) {
  return (
    // TODO: make this responsive
    <div className="flex w-full justify-center gap-3 border-[1px] border-t-primary-300 bg-violet-100 py-2">
      {applySteps.map((s) => (
        <Button variant={s.step === step ? "apply" : "apply-ghost"} asChild>
          <Link href={{ pathname: "/apply", query: { step: s.step } }}>
            {s.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
