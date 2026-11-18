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
  // The real logo on white, inside a thin ring of the sponsor's colour so
  // it still matches their cells in the room table (Jazz, 2026-11-18).
  if (logo) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex size-6 shrink-0 rounded-full p-0.5",
          c.badge,
          className,
        )}
      >
        <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-dashboard-bg-surface p-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny
              static logo; next/image adds nothing at this size */}
          <img
            src={logo}
            alt=""
            width={20}
            height={20}
            loading="lazy"
            className="size-full object-contain"
          />
        </span>
      </span>
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
