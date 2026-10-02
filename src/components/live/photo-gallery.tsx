import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "~/lib/utils";

export interface PhotoGalleryProps {
  /** Image paths, in crossfade order. */
  images: string[];
  /** Optional alt text per image, matched by index. Defaults to decorative (""). */
  alt?: string[];
  /** How long each photo stays on screen before crossfading, in ms. */
  interval?: number;
  /** Crossfade duration, in seconds. */
  fadeDuration?: number;
  className?: string;
}

/**
 * A crossfading photo gallery, built to sit directly inside `<Window>`'s
 * `children` (e.g. the "A world of exploration" window). It fills its
 * container (`size-full`) rather than sizing itself, since `Window`'s
 * non-autoHeight content area is already unpadded and full-bleed
 * (`absolute inset-x-0 bottom-0 top-[34px] ... overflow-hidden`) — this
 * component is meant to occupy that whole region.
 *
 * Crossfade mechanics: AnimatePresence's default mode ("sync") animates the
 * outgoing and incoming image at the same time — that's what makes it a
 * crossfade rather than a fade-out-then-fade-in. Only one image is ever
 * "current" in state; the previous one is whatever AnimatePresence is still
 * animating out.
 */
export function PhotoGallery({
  images,
  alt = [],
  interval = 3000,
  fadeDuration = 0.8,
  className,
}: PhotoGalleryProps) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, interval);
    return () => clearInterval(timer);
  }, [images.length, interval]);

  const currentImage = images[index];
  if (!currentImage) return null;

  return (
    <div className={cn("relative size-full overflow-hidden", className)}>
      <AnimatePresence initial={false}>
        <motion.div
          key={currentImage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fadeDuration, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <Image
            src={currentImage}
            alt={alt[index] ?? ""}
            fill
            sizes="400px"
            className="object-cover"
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
