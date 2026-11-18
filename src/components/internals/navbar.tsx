import Link from "next/link";
import { useRouter } from "next/router";
import { HWLogo } from "~/components/apply/hw-logo";
import { Button } from "~/components/ui/button";
import { Profile } from "~/components/apply/profile";

function RosterJudgingToggle() {
  const { pathname } = useRouter();
  const items = [
    { href: "/internal/sponsors", label: "Roster" },
    { href: "/internal/judging", label: "Judging" },
  ];
  return (
    <div
      role="tablist"
      aria-label="Roster or judging"
      className="flex shrink-0 rounded-full border border-slate-200 bg-slate-50 p-0.5"
    >
      {items.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              active
                ? "bg-primary-600 text-white"
                : "text-primary-600 hover:bg-slate-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}

export function InternalNavbar() {
  return (
    <nav className="z-100 flex w-full justify-between border-[1px] border-slate-200 px-1 py-3">
      <Button variant="link" asChild>
        <Link href="/internal/dashboard">
          <HWLogo />
        </Link>
      </Button>
      <div className="flex min-w-0 items-center gap-3 overflow-x-auto font-figtree">
        <Button className="text-primary-600" variant={"link"} asChild>
          <Link href="/internal/dashboard">My Dashboard</Link>
        </Button>
        <Button className="text-primary-600" variant={"link"} asChild>
          <Link href="/internal/review">Applicant Review</Link>
        </Button>
        <RosterJudgingToggle />
        {/* Bulk status tool (#558) is hard-disabled (#798); hidden until it's back.
        <Button className="text-primary-600" variant={"link"} asChild>
          <Link href="/internal/adjust-status">Status Adjustment</Link>
        </Button> */}

        {/* <Button variant="link" asChild>
          <Link href="/dashboard">
            <Profile />
          </Link>
        </Button> */}
      </div>
    </nav>
  );
}
