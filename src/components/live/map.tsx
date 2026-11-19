"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { useIsMobile } from "~/hooks/use-mobile";

const MIN_ZOOM = 1; // the whole map, fitted to the card
const MAX_ZOOM = 4;

// Images live in public/live/map/
const FLOORS = [
  { id: "floor-1", label: "Level 1", src: "/live/map/floor1.webp" },
  { id: "floor-2", label: "Level 2", src: "/live/map/floor2.webp" },
] as const;

type View = { zoom: number; x: number; y: number };
const FITTED: View = { zoom: 1, x: 0, y: 0 };

// One floor plan. Desktop: pinch or Cmd/Ctrl + scroll zooms toward the
// cursor, drag pans, buttons zoom and reset; plain scrolling still scrolls
// the page. Phones: tap to open the image full size and pinch-zoom there.
const FloorMap = ({ src, alt }: { src: string; alt: string }) => {
  const isMobile = useIsMobile();
  const frameRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(FITTED);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(
    null,
  );

  // Keep the map covering the frame: no dragging it out of sight
  const clamp = (v: View): View => {
    const frame = frameRef.current;
    if (!frame) return v;
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    return {
      zoom: v.zoom,
      x: Math.min(0, Math.max(w - w * v.zoom, v.x)),
      y: Math.min(0, Math.max(h - h * v.zoom, v.y)),
    };
  };

  // Zoom by `factor`, keeping the point (px, py) of the frame in place
  const zoomAt = (factor: number, px: number, py: number) =>
    setView((v) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
      const ratio = zoom / v.zoom;
      return clamp({
        zoom,
        x: px - (px - v.x) * ratio,
        y: py - (py - v.y) * ratio,
      });
    });

  const zoomFromCenter = (factor: number) => {
    const frame = frameRef.current;
    if (frame) zoomAt(factor, frame.clientWidth / 2, frame.clientHeight / 2);
  };

  // Trackpad pinch arrives as ctrl + wheel. React's onWheel is passive, so
  // this needs a native listener to stop the page from zooming too.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const rect = frame.getBoundingClientRect();
      zoomAt(
        Math.exp(-e.deltaY * 0.003),
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  });

  if (isMobile) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-dashboard-lg bg-dashboard-bg-surface p-3 shadow-dashboard-card"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-auto w-full" />
      </a>
    );
  }

  const zoomed = view.zoom > 1;

  return (
    <div className="rounded-dashboard-lg bg-dashboard-bg-surface p-5 shadow-dashboard-card sm:p-10">
      <div
        ref={frameRef}
        className={`relative touch-none select-none overflow-hidden ${zoomed ? "cursor-grab active:cursor-grabbing" : ""}`}
        onPointerDown={(e) => {
          if (!zoomed) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
        }}
        onPointerMove={(e) => {
          const start = drag.current;
          if (!start) return;
          setView((v) =>
            clamp({
              zoom: v.zoom,
              x: start.x + e.clientX - start.px,
              y: start.y + e.clientY - start.py,
            }),
          );
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="block h-auto w-full origin-top-left"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          }}
        />
        <div className="absolute right-2 top-2 flex gap-1">
          {[
            {
              label: "+",
              title: "Zoom in",
              onClick: () => zoomFromCenter(1.5),
            },
            {
              label: "−",
              title: "Zoom out",
              onClick: () => zoomFromCenter(1 / 1.5),
            },
            {
              label: "Reset",
              title: "Show the whole map",
              onClick: () => setView(FITTED),
            },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              title={b.title}
              onClick={b.onClick}
              onPointerDown={(e) => e.stopPropagation()}
              className="min-w-[2rem] rounded-md border border-dashboard-border-card bg-dashboard-bg-surface px-2 py-1 text-sm font-semibold text-dashboard-text-heavy shadow-sm hover:bg-dashboard-bg-page"
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
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
          This year&apos;s event will be at the Ronald D. Schmeichel Building
          for Entrepreneurship and Innovation!
        </p>
        <p className="text-base font-medium text-dashboard-text-medium">
          <b className="font-semibold text-dashboard-text-heavy">Address:</b>{" "}
          1151 Richmond St, London, ON N6A 3K7
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
              ? "* Tap the map to open it full size"
              : "* Pinch or ⌘/Ctrl + scroll to zoom, drag to move"}
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
