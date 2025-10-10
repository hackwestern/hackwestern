import { applySteps, type ApplyStep } from "~/constants/apply";
import { Button } from "../ui/button";
import Link from "next/link";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTrigger,
} from "../ui/drawer";
import { Menu } from "lucide-react";
import Image from "next/image";
import { DialogTitle } from "@radix-ui/react-dialog";

type ApplyMenuProps = {
  step: ApplyStep | null;
};

export function ApplyMenu({ step }: ApplyMenuProps) {
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
            <Button
              key={s.step}
              variant={s.step === step ? "apply-ghost" : "apply"}
              className="mx-auto w-48 justify-start text-left 2xl:w-64 3xl:w-72"
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
                      <Button
                        key={s.step}
                        variant={s.step === step ? "apply-ghost" : "apply"}
                        className="w-64 justify-start px-4 text-left"
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
            </DialogTitle>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
