import { applySteps, type ApplyStep } from "~/constants/apply";
import { Button } from "../ui/button";
import Link from "next/link";
import { useMemo } from "react";
import { getNextStep, getPreviousStep, getStepIndex } from "./navigation";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerTrigger,
} from "../ui/drawer";
import { ArrowLeft, ArrowRight, Menu, Send } from "lucide-react";
import { cn } from "~/lib/utils";

type ApplyMenuProps = {
  step: ApplyStep | null;
};

export function ApplyMenu({ step }: ApplyMenuProps) {
  const stepName = step && step?.charAt(0).toUpperCase() + step?.slice(1);
  const stepIndex = useMemo(() => getStepIndex(step), [step]);
  const prevStep = getPreviousStep(stepIndex);
  const nextStep = getNextStep(stepIndex);

  return (
    <div className="fixed bottom-0 mx-auto h-fit w-screen justify-center gap-3 border-[1px] border-t-primary-300 bg-violet-100 py-2">
      <div className="mx-auto hidden w-fit gap-1 md:flex">
        {applySteps.map((s) => (
          <Button
            key={s.step}
            variant={s.step === step ? "apply" : "apply-ghost"}
            asChild
          >
            <Link href={{ pathname: "/apply", query: { step: s.step } }}>
              {s.label}
            </Link>
          </Button>
        ))}
      </div>

      <div className="flex h-auto items-center justify-between overflow-clip px-4 py-1.5 md:hidden md:h-0">
        <Button
          asChild
          variant="apply-ghost"
          className="h-full rounded-full p-2 hover:bg-primary-400"
          disabled={!prevStep}
        >
          <Link
            href={{ pathname: "/apply", query: { step: prevStep ?? step } }}
          >
            <ArrowLeft
              className={cn(
                "size-6",
                prevStep ? "text-primary-600" : "text-slate-300",
              )}
            />
          </Link>
        </Button>

        <div className="flex gap-2">
          <Drawer>
            <div className="flex items-center gap-2">
              <DrawerTrigger asChild>
                <Button variant="apply" className="rounded-2xl p-2.5">
                  <Menu strokeWidth={2.5} className="size-5 text-primary-600" />
                </Button>
              </DrawerTrigger>
              <DrawerTrigger asChild>
                <Button
                  variant="apply"
                  className="h-full rounded-2xl p-2.5 text-base font-semibold"
                >
                  {stepName}
                </Button>
              </DrawerTrigger>
            </div>
            <DrawerContent>
              <DrawerFooter>
                {applySteps.map((s) => (
                  <DrawerClose key={s.step} asChild>
                    <Button
                      variant={s.step === step ? "apply" : "apply-ghost"}
                      asChild
                    >
                      <Link
                        href={{ pathname: "/apply", query: { step: s.step } }}
                      >
                        {s.label}
                      </Link>
                    </Button>
                  </DrawerClose>
                ))}
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
        <Button
          asChild
          variant="apply-ghost"
          className="h-full rounded-full p-2 hover:bg-primary-400"
          disabled={!nextStep && step !== "review"}
        >
          <Link
            href={
              step === "review"
                ? "/submitted"
                : { pathname: "/apply", query: { step: nextStep ?? step } }
            }
          >
            {step !== "review" ? (
              <ArrowRight
                className={cn(
                  "size-6",
                  nextStep ? "text-primary-600" : "text-slate-300",
                )}
              />
            ) : (
              <Send className="size-6 text-primary-600" />
            )}
          </Link>
        </Button>
      </div>
    </div>
  );
}
