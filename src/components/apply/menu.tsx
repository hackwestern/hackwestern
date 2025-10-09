import {
  applySteps,
  mobileApplySteps,
  type ApplyStep,
} from "~/constants/apply";
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
import Image from "next/image";

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
    <>
      {/* Desktop Sidebar */}
      <div className="mx-auto hidden h-screen w-full gap-3 border-[1px] bg-white py-3 shadow-[5px_0px_10px_0px_rgba(129,74,83,0.1)] md:block">
        <div className="mx-4 flex flex-col gap-2">
          <div className="my-8 ml-2 flex flex-col gap-8">
            <Image
              src="/horse.svg"
              alt="Hack Western Logo"
              width={40}
              height={60}
            />
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
              className="mx-10 w-48 justify-start text-left xl:w-64"
              asChild
            >
              <Link href={{ pathname: "/apply", query: { step: s.step } }}>
                {s.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Mobile Hamburger Menu */}
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="apply" className="rounded-2xl p-2.5 shadow-lg">
              <Menu strokeWidth={2.5} className="size-5 text-primary-600" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[80vh]">
            <div className="mx-4 my-6 space-y-4">
              <div className="flex items-center gap-4">
                <Image
                  src="/horse.svg"
                  alt="Hack Western Logo"
                  width={32}
                  height={48}
                />
                <div>
                  <h1 className="font-figtree text-lg font-bold text-heavy">
                    Application Portal
                  </h1>
                  <h2 className="font-figtree text-sm font-semibold text-medium">
                    Hack Western 12
                  </h2>
                </div>
              </div>
              <div className="space-x-2 space-y-2">
                {mobileApplySteps.map((s) => (
                  <DrawerClose key={s.step} asChild>
                    <Button
                      variant={s.step === step ? "apply" : "apply-ghost"}
                      className="w-full justify-start text-left"
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
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
