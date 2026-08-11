import Link from "next/link";
import { HWLogo } from "~/components/apply/hw-logo";
import { Button } from "~/components/ui/button";
import { Profile } from "~/components/apply/profile";

export function InternalNavbar() {
  return (
    <nav className="z-100 flex w-screen justify-between border-[1px] border-slate-200 px-1 py-3">
      <Button variant="link" asChild>
        <Link href="/internal/dashboard">
          <HWLogo />
        </Link>
      </Button>
      <div className="flex items-center gap-3 font-figtree">
        <Button className="text-primary-600" variant={"link"} asChild>
          <Link href="/internal/dashboard">My Dashboard</Link>
        </Button>
        <Button className="text-primary-600" variant={"link"} asChild>
          <Link href="/internal/review">Applicant Review</Link>
        </Button>
        <Button className="text-primary-600" variant={"link"} asChild>
          <Link href="/internal/adjust-status">Status Adjustment</Link>
        </Button>

        {/* <Button variant="link" asChild>
          <Link href="/dashboard">
            <Profile />
          </Link>
        </Button> */}
      </div>
    </nav>
  );
}
