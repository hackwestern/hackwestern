import Link from "next/link";
import { HWLogo } from "~/components/apply/hw-logo";
import { Button } from "~/components/ui/button";
import { InternalWarning } from "~/components/internals/internal-warning";
import { Profile } from "~/components/apply/profile";

export const INTERNAL_LINKS = [
  { href: "/internal", label: "Home" },
  { href: "/internal/judging", label: "Judging Controls" },
  { href: "/internal/roster", label: "Judge Roster" },
  { href: "/internal/rubric", label: "Rubric" },
  { href: "/internal/team-results", label: "Team Results" },
  { href: "/internal/sponsors", label: "Sponsors" },
];

export function InternalNavbar() {
  return (
    <>
      <InternalWarning />
      <nav className="z-100 flex w-full justify-between border-[1px] border-slate-200 px-1 py-3">
        <Button variant="link" asChild>
          <Link href="/internal/dashboard">
            <HWLogo />
          </Link>
        </Button>
        <div className="flex min-w-0 items-center gap-3 overflow-x-auto font-figtree">
          {INTERNAL_LINKS.map(({ href, label }) => (
            <Button
              key={href}
              className="shrink-0 text-primary-600"
              variant={"link"}
              asChild
            >
              <Link href={href}>{label}</Link>
            </Button>
          ))}
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
    </>
  );
}
