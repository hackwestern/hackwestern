import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  {
    name: "X",
    href: "https://x.com/hackwestern",
    iconSrc: "/landing/promo/icons/x.svg",
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
          onCloseAutoFocus={(e) => e.preventDefault()}
          side="right"
          closeClassName="right-5 top-5 p-2 opacity-90 focus:ring-0 focus:ring-offset-0 focus-visible:ring-2 focus-visible:ring-offset-0 data-[state=open]:bg-transparent"
          closeIconClassName="size-6 stroke-[2.5]"
          className="w-[min(85vw,320px)] border-white/[0.08] bg-promo-sheet font-figtree text-offwhite data-[state=closed]:duration-150 data-[state=open]:duration-300"
        >
          <SheetTitle className="sr-only">Site navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Links to sections of the Hack Western website and social media.
          </SheetDescription>
          <div className="mt-14 flex h-[calc(100%-3.5rem)] flex-col justify-between">
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

// Near the top of the page the header always shows, sitting over the hero.
const ALWAYS_VISIBLE_UNTIL = 80;
// Ignore tiny scroll jitter (trackpad momentum) so the header doesn't flicker.
const DIRECTION_THRESHOLD = 4;

// Fixed to the viewport: hides while scrolling down, slides back in on any
// scroll up so the nav is reachable from anywhere on the page.
export function PromoHeader(props: PromoNavbarProps) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (y < ALWAYS_VISIBLE_UNTIL) setHidden(false);
      else if (delta > DIRECTION_THRESHOLD) setHidden(true);
      else if (delta < -DIRECTION_THRESHOLD) setHidden(false);
      else return;
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "pointer-events-none fixed inset-x-0 top-3 z-50 px-[10%] transition-transform duration-300 ease-out focus-within:translate-y-0 motion-reduce:transition-none",
        hidden && "-translate-y-[calc(100%_+_12px)]",
      )}
    >
      {/* past 1440 wide, zoom grows the bar's text and icons with --ui-scale
          while it still spans the same width */}
      <div className="flex items-start lg:gap-6 min-[1440px]:[zoom:var(--ui-scale,1)]">
        {/* The header strip is as tall as the MLH badge and full width, so
            only the bar and the badge take clicks; the page shows through. */}
        <PromoNavbar
          {...props}
          className={cn("pointer-events-auto flex-1", props.className)}
        />

        {/* Cancels the header's top-3 so the badge hangs from the top edge.
            Divided by --ui-scale because the row's zoom scales it back up. */}
        <a
          href="https://www.mlh.com/"
          target="_blank"
          className="pointer-events-auto lg:mt-[calc(-12px/var(--ui-scale,1))]"
        >
          <Image
            height={43}
            width={75}
            src="/landing/promo/mlh.png"
            alt="mlh"
            className="hidden lg:block"
          />
        </a>
      </div>
    </header>
  );
}
