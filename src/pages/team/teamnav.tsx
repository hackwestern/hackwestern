import Link from "next/link";
import { useRouter } from "next/router";
import { cn } from "~/lib/utils";

const LINKS = [
  { href: "/team", label: "Dashboard" },
  { href: "/team/join", label: "Find / Join / Create" },
  { href: "/team/manage", label: "My Team" },
  { href: "/team/submit", label: "Submit" },
];

export function TeamNav() {
  const router = useRouter();

  return (
    <nav className="mx-auto flex max-w-xl gap-1 border-b border-gray-1 pb-3">
      {LINKS.map((link) => {
        const isActive = router.pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "p3 rounded-full px-3 py-1.5",
              isActive
                ? "bg-blue-1 text-heavy"
                : "text-medium hover:text-heavy",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}