import { HWLogo } from "~/components/apply/hw-logo";
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
import { useToast } from "../hooks/use-toast";
import { api } from "~/utils/api";

type ApplyMenuProps = {
  step: ApplyStep | null;
};

export function ApplyMenu({ step }: ApplyMenuProps) {
  const stepName = step && step?.charAt(0).toUpperCase() + step?.slice(1);
  const stepIndex = useMemo(() => getStepIndex(step), [step]);
  const prevStep = getPreviousStep(stepIndex);
  const nextStep = getNextStep(stepIndex);
  const { toast } = useToast();

  const { data: applicationData } = api.application.get.useQuery();

  const onClickSubmit = () => {
    if (step === "review" && applicationData?.status !== "PENDING_REVIEW") {
      toast({
        title: "Application Incomplete",
        description: "Please complete all required steps before submitting.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mx-auto h-screen w-full gap-3 border-[1px] bg-white py-3 shadow-[5px_0px_10px_0px_rgba(129,74,83,0.1)]">
      <div className="ml-4 mr-auto hidden gap-2 md:flex md:flex-col">
        <div className="ml-2 flex flex-col gap-8">
          <HWLogo />
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
          <Button
            key={s.step}
            variant={s.step === step ? "apply-ghost" : "apply"}
            className="w-full"
            asChild
          >
            <Link href={{ pathname: "/apply", query: { step: s.step } }}>
              {s.label}
            </Link>
          </Button>
        ))}
      </div>

      {/* Mobile View */}
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
          onClick={onClickSubmit}
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
