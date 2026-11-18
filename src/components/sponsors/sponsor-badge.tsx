import {
  sponsorColor,
  sponsorInitials,
  type SponsorColor,
} from "~/lib/sponsor-colors";
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
