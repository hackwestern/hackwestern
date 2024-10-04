import Link from "next/link";
import { HWLogo } from "~/components/apply/hw-logo";
import { Button } from "~/components/ui/button";
import { Profile } from "~/components/apply/profile";

export function ApplyNavbar() {
  return (
    <nav className="flex w-screen justify-between border-[1px] border-slate-200 px-1 py-3">
      <Button variant="link" asChild>
        <Link href="/">
          <HWLogo />
        </Link>
      </Button>
      <div className="flex">
        <Button className="text-primary-600" variant="link" asChild>
          <Link href="/dashboard">My Dashboard</Link>
        </Button>
        <Button variant="link" asChild>
          <Link href="/dashboard">
            <Profile />
          </Link>
        </Button>
      </div>
    </nav>
  );
}
