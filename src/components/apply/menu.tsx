import { applySteps, type ApplyStep } from "~/constants/apply";
import { Button } from "../ui/button";
import Link from "next/link";
import { useMemo } from "react";
import { getNextStep, getPreviousStep, getStepIndex } from "./navigation";
import { useRouter } from "next/router";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerTrigger,
} from "../ui/drawer";

type ApplyMenuProps = {
  step: ApplyStep | null;
};

export function ApplyMenu({ step }: ApplyMenuProps) {
  const stepName = step && step?.charAt(0).toUpperCase() + step?.slice(1);
  const stepIndex = useMemo(() => getStepIndex(step), [step]);
  const prevStep = getPreviousStep(stepIndex);
  const nextStep = getNextStep(stepIndex);

  const router = useRouter();

  return (
    <div className="fixed bottom-0 mx-auto h-fit w-screen justify-center gap-3 border-[1px] border-t-primary-300 bg-violet-100 py-2 md:static">
      <div className="mx-auto flex hidden w-fit md:block">
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

      <div className="mx-4 flex h-auto justify-between overflow-clip md:invisible md:h-0">
        <div className="my-3 h-max cursor-pointer rounded-full p-2 transition-all hover:bg-primary-400">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className=""
            onClick={() => {
              if (prevStep) {
                void router.push(`/apply?step=${prevStep}`);
              }
            }}
          >
            <path
              d="M3.8284 9.0001L9.1924 14.3641L7.7782 15.7783L6.79994e-07 8.0001L7.7782 0.221999L9.1924 1.6362L3.8284 7.0001L16 7.0001L16 9.0001L3.8284 9.0001Z"
              fill={prevStep ? "#6D3EBA" : "#BCC1D0"}
            />
          </svg>
        </div>

        <div className="flex gap-2">
          <Drawer>
            <DrawerTrigger className="mt-1.5 flex gap-2">
              <div className="rounded-2xl bg-primary-300 p-2.5">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 18C3.44772 18 3 17.5523 3 17C3 16.4477 3.44772 16 4 16H20C20.5523 16 21 16.4477 21 17C21 17.5523 20.5523 18 20 18H4ZM4 13C3.44772 13 3 12.5523 3 12C3 11.4477 3.44772 11 4 11H20C20.5523 11 21 11.4477 21 12C21 12.5523 20.5523 13 20 13H4ZM4 8C3.44772 8 3 7.55228 3 7C3 6.44772 3.44772 6 4 6H20C20.5523 6 21 6.44772 21 7C21 7.55228 20.5523 8 20 8H4Z"
                    fill="#6D3EBA"
                  />
                </svg>
              </div>
              <div className="h-fit rounded-2xl bg-primary-300 p-2.5 font-semibold text-primary-600">
                {stepName}
              </div>
            </DrawerTrigger>
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
        <div className="mt-3 h-max cursor-pointer rounded-full p-2 transition-all hover:bg-primary-400">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            onClick={() => {
              if (nextStep) {
                void router.push(`/apply?step=${nextStep}`);
              }
            }}
          >
            <path
              d="M12.1716 6.9999L6.8076 1.63589L8.2218 0.22168L16 7.9999L8.2218 15.778L6.8076 14.3638L12.1716 8.9999H0V6.9999H12.1716Z"
              fill={nextStep ? "#6D3EBA" : "#BCC1D0"}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
