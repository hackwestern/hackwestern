import {
  sponsorColor,
  sponsorInitials,
  type SponsorColor,
} from "~/lib/sponsor-colors";
import { sponsorLogo } from "~/lib/sponsor-logos";
import { cn } from "~/lib/utils";

/**
 * A sponsor's initials on their colour: identity that doesn't rest on
 * colour alone. Decorative (aria-hidden): the sponsor's name is always
 * next to it or in the control's label.
 */
export function SponsorBadge({
  name,
  colors,
  color,
  className,
}: {
  name: string;
  /** Palette indexes (sponsorColorIndexes); or pass `color` directly. */
  colors?: ReadonlyMap<string, number>;
  color?: SponsorColor;
  className?: string;
}) {
  const c = color ?? sponsorColor(colors ?? new Map(), name);
  const logo = sponsorLogo(name);
  // Just the real logo, no circle or frame, at a fixed height so wide and
  // square logos both read clearly (Jazz, 2026-11-18). A plain <img>: a
  // small static logo gains nothing from next/image.
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logo}
        alt=""
        aria-hidden
        width={64}
        height={20}
        loading="lazy"
        className={cn(
          "h-5 w-auto max-w-16 shrink-0 object-contain object-left",
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold leading-none tracking-normal",
        c.badge,
        className,
      )}
    >
      {sponsorInitials(name)}
    </span>
  );
}
