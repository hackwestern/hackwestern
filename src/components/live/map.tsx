"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { useIsMobile } from "~/hooks/use-mobile";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 10;

// Images live in public/live/map/
const FLOORS = [
  { id: "floor-1", label: "Level 1", src: "/live/map/floor1.webp" },
  { id: "floor-2", label: "Level 2", src: "/live/map/floor2.webp" },
] as const;

// One floor plan: drag and scroll-to-zoom on desktop, plain image on mobile
const FloorMap = ({ src, alt }: { src: string; alt: string }) => {
  const [scale, setScale] = useState(1);
  const isMobile = useIsMobile();
  const cardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Start fitted to the card's width, then shrink just enough that the whole
  // map is visible without scrolling. Scaling doesn't change the layout box,
  // so this measures the image at full width.
  const fitToCard = (img: HTMLImageElement) => {
    const card = cardRef.current;
    if (!card || img.offsetHeight === 0) return;
    const style = getComputedStyle(card);
    const available =
      card.clientHeight -
      parseFloat(style.paddingTop) -
      parseFloat(style.paddingBottom);
    setScale(Math.min(1, available / img.offsetHeight));
  };

  // On a reload the image can finish loading before React attaches onLoad
  // (server-rendered, cached), so the event never fires. Fit it here too.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) fitToCard(img);
  }, [src, isMobile]);

  // Scroll over the map zooms it instead of scrolling the page. React's
  // onWheel is passive, so preventDefault there does nothing; this has to be
  // a native, non-passive listener.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((prev) =>
        Math.min(Math.max(prev + e.deltaY * -0.001, MIN_ZOOM), MAX_ZOOM),
      );
    };
    img.addEventListener("wheel", onWheel, { passive: false });
    return () => img.removeEventListener("wheel", onWheel);
  }, [src, isMobile]);

  return (
    <div
      ref={cardRef}
      className={`flex max-h-[calc(100vh-280px)] w-full flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-5 shadow-dashboard-card sm:p-10 ${
        isMobile ? "overflow-auto" : "overflow-hidden"
      }`}
    >
      {isMobile ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-auto w-full object-contain" />
      ) : (
        <motion.img
          ref={imgRef}
          src={src}
          alt={alt}
          drag
          dragMomentum={false}
          onLoad={(e) => fitToCard(e.currentTarget)}
          style={{ scale, originX: 0.5, originY: 0 }}
          className="h-auto w-full cursor-grab object-contain active:cursor-grabbing"
        />
      )}
    </div>
  );
};

const Map = () => {
  const [floor, setFloor] = useState<(typeof FLOORS)[number]["id"]>("floor-1");
  const isMobile = useIsMobile();
  const current = FLOORS.find((f) => f.id === floor) ?? FLOORS[0];

  return (
    <div className="flex flex-col gap-6 pb-16 font-figtree">
      <DashboardPanel title="Venue">
        <p className="text-base font-medium text-dashboard-text-medium">
          This year&apos;s event will be at the Morrissette Institute for
          Entrepreneurship!
        </p>
        <p className="text-base font-medium text-dashboard-text-medium">
          <b className="font-semibold text-dashboard-text-heavy">Address:</b>{" "}
          1400 Western Rd, London, ON N6A 0C2
        </p>
      </DashboardPanel>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex gap-2">
            {FLOORS.map((f) => (
              <DashboardChip
                key={f.id}
                selected={floor === f.id}
                onClick={() => setFloor(f.id)}
              >
                {f.label}
              </DashboardChip>
            ))}
          </div>
          <p className="text-sm font-medium text-dashboard-text-light">
            {isMobile
              ? "* View the map below"
              : "* Zoom in and out of the map by scrolling!"}
          </p>
        </div>
        {/* key resets the zoom when switching floors */}
        <FloorMap
          key={current.id}
          src={current.src}
          alt={`${current.label} map`}
        />
      </div>
    </div>
  );
};

export default Map;
