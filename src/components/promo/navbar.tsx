import Link from "next/link";
import { cn } from "~/lib/utils";

export type PromoNavLink = {
  label: string;
  href: string;
};

export type PromoSocial = {
  name: string;
  href: string;
  iconSrc: string;
};

const DEFAULT_LINKS: PromoNavLink[] = [
  { label: "About", href: "#about" },
  { label: "Projects", href: "#projects" },
  { label: "Sponsors", href: "#sponsors" },
  { label: "FAQ", href: "#faq" },
];

const DEFAULT_SOCIALS: PromoSocial[] = [
  {
    name: "Instagram",
    href: "https://www.instagram.com/hackwestern",
    iconSrc: "/landing/promo/icons/instagram.svg",
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/hack-western/",
    iconSrc: "/landing/promo/icons/linkedin.svg",
  },
];

const navText =
  "font-figtree text-[16px] font-semibold leading-none text-offwhite";

const navFocus =
  "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offwhite focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

type PromoNavbarProps = {
  className?: string;
  brandHref?: string;
  links?: PromoNavLink[];
  socials?: PromoSocial[];
};

export function PromoNavbar({
  className,
  brandHref = "/",
  links = DEFAULT_LINKS,
  socials = DEFAULT_SOCIALS,
}: PromoNavbarProps) {
  return (
    <nav
      aria-label="Site"
      className={cn(
        "flex h-[50px] items-center justify-between rounded-[12px] border border-white/[0.04] bg-[rgba(47,111,142,0.1)] px-6 backdrop-blur-[10px]",
        className,
      )}
    >
      <div className={cn("flex items-baseline gap-6 whitespace-nowrap", navText)}>
        <Link href={brandHref} className={cn("cursor-pixel-hover", navFocus)}>
          Hack Western 13
        </Link>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={cn("cursor-pixel-hover", navFocus)}
          >
            {link.label}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-6">
        {socials.map((social) => (
          <a
            key={social.name}
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.name}
            className={cn(
              "flex size-6 shrink-0 cursor-pixel-hover items-center justify-center overflow-clip",
              navFocus,
            )}
          >
            <img
              src={social.iconSrc}
              alt=""
              width={24}
              height={24}
              className="h-full w-full object-contain"
            />
          </a>
        ))}
      </div>
    </nav>
  );
}
