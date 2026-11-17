import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SPONSOR_TIERS,
  SPONSOR_THANK_YOU_TEXT,
} from "~/constants/sponsors-live";

const SponsorCard = ({
  name,
  logo,
  link,
  description,
  scale = 1,
}: {
  name: string;
  logo: string;
  link: string;
  description?: string;
  scale?: number;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const logoSize = 200 * scale;
  const maxHeight = 20 * scale;
  const textSize = scale > 1.5 ? "text-base" : "text-sm";

  return (
    <div
      className={`relative flex flex-col rounded-dashboard-lg border font-figtree transition-colors duration-300 ${
        isExpanded
          ? "border-dashboard-border-subtle bg-dashboard-bg-surface shadow-dashboard-card"
          : "border-transparent bg-transparent"
      }`}
    >
      {description && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 cursor-pixel-hover items-center justify-center rounded-dashboard-sm bg-dashboard-bg-surface transition-colors hover:bg-dashboard-bg-highlight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
          aria-label={
            isExpanded ? "Collapse description" : "Expand description"
          }
        >
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="h-4 w-4 text-dashboard-text-light" />
          </motion.div>
        </button>
      )}
      <div className="flex items-start gap-2">
        <Link
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex flex-1 cursor-pixel-hover items-center justify-center rounded-dashboard-lg bg-dashboard-bg-surface p-4 transition-all duration-300 ${
            isExpanded
              ? "border border-transparent"
              : "border border-dashboard-border-subtle hover:border-dashboard-border-outline hover:shadow-dashboard-card"
          }`}
        >
          <Image
            src={logo}
            alt={name}
            width={logoSize}
            height={logoSize * 0.5}
            className="h-auto w-auto object-contain"
            style={{ maxHeight: `${maxHeight * 4}px` }}
          />
        </Link>
      </div>
      <AnimatePresence>
        {description && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mx-8 border-t border-dashboard-border-faint py-4">
              <p
                className={`whitespace-pre-line ${textSize} font-medium leading-relaxed text-dashboard-text-medium`}
              >
                {description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Sponsors = () => {
  return (
    <div className="h-full overflow-auto pb-16 font-figtree">
      {/* Thank you text */}
      <div className="mb-12 text-center">
        <p className="mx-auto max-w-2xl text-base font-medium leading-normal text-dashboard-text-medium md:text-lg">
          {SPONSOR_THANK_YOU_TEXT}
        </p>
      </div>

      {/* Sponsor tiers */}
      {SPONSOR_TIERS.map((tier) => {
        // Determine grid and scale based on tier importance
        const getTierConfig = (tierName: string) => {
          if (tierName === "Title Sponsor") {
            return {
              gridCols: "grid-cols-1 max-w-2xl mx-auto",
              titleSize: "text-3xl md:text-[32px]",
              scale: 3.0,
            };
          }
          if (tierName === "Diamond Sponsors" || tierName === "Gold Sponsors") {
            return {
              gridCols: "grid-cols-1 max-w-2xl mx-auto",
              titleSize: "text-2xl",
              scale: 2.16,
            };
          }

          // Bronze and In-Kind use default
          return {
            gridCols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            titleSize: "text-xl",
            scale: 1,
          };
        };

        const config = getTierConfig(tier.tier);

        return (
          <div key={tier.tier} className="mb-12">
            <h2
              className={`mb-6 text-center ${config.titleSize} font-semibold leading-default text-dashboard-text-heavy`}
            >
              {tier.tier}
            </h2>
            <div className={`grid ${config.gridCols} gap-6`}>
              {tier.sponsors.map((sponsor) => (
                <SponsorCard
                  key={sponsor.name}
                  name={sponsor.name}
                  logo={sponsor.logo}
                  link={sponsor.link}
                  description={sponsor.description}
                  scale={config.scale}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Sponsors;
