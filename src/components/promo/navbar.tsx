import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
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

const navPress =
  "transition-transform duration-100 ease-out active:translate-y-px active:scale-[0.97] active:duration-0 motion-reduce:transition-none motion-reduce:active:transform-none";

const navTextPress = cn("-m-1 p-1", navPress);

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
      <div
        className={cn("flex items-baseline gap-6 whitespace-nowrap", navText)}
      >
        <Link
          href={brandHref}
          className={cn("cursor-pixel-hover", navFocus, navTextPress)}
        >
          Hack Western 13
        </Link>
        <div className="hidden items-baseline gap-6 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn("cursor-pixel-hover", navFocus, navTextPress)}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className="hidden items-center gap-6 md:flex">
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
              navPress,
            )}
          >
            <Image
              src={social.iconSrc}
              alt=""
              width={24}
              height={24}
              className="h-full w-full object-contain"
            />
          </a>
        ))}
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open navigation menu"
            className={cn(
              "flex size-8 cursor-pixel-hover items-center justify-center text-offwhite md:hidden",
              navFocus,
              navPress,
            )}
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-[min(85vw,320px)] border-white/[0.08] bg-[#173f52] font-figtree text-offwhite data-[state=closed]:duration-150 data-[state=open]:duration-300"
        >
          <SheetTitle className="sr-only">Site navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Links to sections of the Hack Western website and social media.
          </SheetDescription>
          <div className="mt-8 flex h-[calc(100%-2rem)] flex-col justify-between">
            <div className="flex flex-col">
              {links.map((link) => (
                <SheetClose key={link.href} asChild>
                  <a
                    href={link.href}
                    className={cn(
                      "cursor-pixel-hover border-b border-white/10 py-4 text-[18px] font-semibold leading-none transition-transform duration-100 ease-out active:translate-y-px active:duration-0 motion-reduce:transition-none motion-reduce:active:transform-none",
                      navFocus,
                    )}
                  >
                    {link.label}
                  </a>
                </SheetClose>
              ))}
            </div>
            <div className="flex items-center gap-6">
              {socials.map((social) => (
                <SheetClose key={social.name} asChild>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    className={cn(
                      "flex size-8 cursor-pixel-hover items-center justify-center",
                      navFocus,
                      navPress,
                    )}
                  >
                    <Image src={social.iconSrc} alt="" width={24} height={24} />
                  </a>
                </SheetClose>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
