import Image from "next/image";
import {
  PROMO_SPONSOR_LINKS,
  PROMO_SPONSORS_IMAGE,
} from "~/constants/promo-sponsors";

// The sponsor logos are one image; each logo gets a transparent link laid
// over its region so it opens that sponsor's site.
export function SponsorLogos({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="relative">
        <Image
          src={PROMO_SPONSORS_IMAGE.src}
          alt=""
          width={PROMO_SPONSORS_IMAGE.width}
          height={PROMO_SPONSORS_IMAGE.height}
          // Mobile window is at most 382px wide; desktop is 700px minus padding,
          // times --ui-scale (up to ~1.26)
          sizes="(min-width: 1024px) 822px, 360px"
          className="h-auto w-full"
        />
        {PROMO_SPONSOR_LINKS.map((sponsor) => (
          <a
            key={sponsor.name}
            href={sponsor.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={sponsor.name}
            className="absolute cursor-pixel-hover rounded-md outline-none transition-colors duration-150 hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-heavy motion-reduce:transition-none"
            style={{
              left: `${sponsor.left}%`,
              top: `${sponsor.top}%`,
              width: `${sponsor.width}%`,
              height: `${sponsor.height}%`,
            }}
          >
            {sponsor.overlaySrc && (
              <Image
                src={sponsor.overlaySrc}
                alt=""
                fill
                className="object-contain"
              />
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
