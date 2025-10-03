import { type FC, useEffect, useState } from "react";
import { type SectionCoordinates } from "~/constants/canvas";
import { useCanvasContext } from "~/contexts/CanvasContext";
import Image from "next/image";
import useWindowDimensions from "~/hooks/useWindowDimensions";
import { usePerformanceMode } from "~/hooks/usePerformanceMode";

interface CanvasProps {
  children: React.ReactNode;
  offset?: SectionCoordinates;
  optimize?: boolean;
  // used for initial load on smaller screens in the mini-canvas
  // shows a static image instead of rendering the component because it's more performant
  imageFallback?: string;
}

/**
 * Returns true if any portion of the component described by `offset`
 * is currently inside the viewport after applying the canvas pan (x,y) and scale.
 *
 * Coordinate systems:
 * - offset.{x,y} are in "scene" coordinates (unscaled canvas space, origin at canvas top-left).
 * - (sceneX, sceneY) are the current translated position of the scene's top-left
 *   in viewport coordinates (these are <= 0; 0 means aligned with the viewport edge).
 * - scale uniformly scales scene coordinates about the scene's origin (top-left) AFTER translation.
 *
 * Mapping a scene-space point (sx, sy) to viewport space:
 *   vx = sceneX + sx * scale
 *   vy = sceneY + sy * scale
 *
 * The component's axis-aligned bounding box in viewport space is:
 *   left   = sceneX + offset.x * scale
 *   top    = sceneY + offset.y * scale
 *   right  = left + offset.width * scale
 *   bottom = top  + offset.height * scale
 *
 * It intersects the viewport iff it isn't entirely left, right, above, or below it.
 *
 * Edge handling:
 * - Touching an edge counts as visible (>= / <= comparisons).
 * - If executed during SSR (no window) and no explicit viewport dimensions are provided,
 *   it returns true to avoid hydration mismatches.
 */
export function isComponentInViewport(params: {
  offset: SectionCoordinates;
  sceneX: number; // current x motion value (.get())
  sceneY: number; // current y motion value (.get())
  scale: number; // current scale motion value (.get())
  viewportWidth?: number; // optional explicit viewport width
  viewportHeight?: number; // optional explicit viewport height
}): boolean {
  const { offset, sceneX, sceneY, scale, viewportWidth, viewportHeight } =
    params;

  // SSR safe fallback: if we can't know viewport size, assume visible
  if (viewportWidth == null || viewportHeight == null) {
    if (typeof window === "undefined") return true;
  }
  const vpWidth = viewportWidth ?? window.innerWidth;
  const vpHeight = viewportHeight ?? window.innerHeight;

  // Guard: zero or negative dimensions mean "not visible"
  if (offset.width <= 0 || offset.height <= 0 || scale <= 0) return false;

  // Compute viewport-space AABB of the component
  const left = sceneX + offset.x * scale;
  const top = sceneY + offset.y * scale;
  const right = left + offset.width * scale;
  const bottom = top + offset.height * scale;

  // Fast reject if entirely outside on any side
  if (right < 0) return false; // completely left of viewport
  if (left > vpWidth) return false; // completely right of viewport
  if (bottom < 0) return false; // completely above viewport
  if (top > vpHeight) return false; // completely below viewport

  return true; // Some overlap (or touching edge) exists
}

export const CanvasComponent: FC<CanvasProps> = ({
  children,
  offset,
  imageFallback,
}) => {
  const { x, y, scale, animationStage } = useCanvasContext();
  const { width } = useWindowDimensions();
  const { mode } = usePerformanceMode();

  // Subscribe to motion value changes so we re-render while panning/zooming
  const [sceneX, setSceneX] = useState(() => x.get());
  const [sceneY, setSceneY] = useState(() => y.get());
  const [sceneScale, setSceneScale] = useState(() => scale.get());

  useEffect(() => {
    // rAF-batched subscription updates without pulling state vars into deps
    let frame: number | null = null;
    const next = { x: x.get(), y: y.get(), s: scale.get() };

    const flush = () => {
      frame = null;
      setSceneX(next.x);
      setSceneY(next.y);
      setSceneScale(next.s);
    };
    const schedule = () => {
      if (frame == null) frame = requestAnimationFrame(flush);
    };
    const unSubX = x.on("change", (v) => {
      next.x = v;
      schedule();
    });
    const unSubY = y.on("change", (v) => {
      next.y = v;
      schedule();
    });
    const unSubScale = scale.on("change", (v) => {
      next.s = v;
      schedule();
    });
    return () => {
      unSubX();
      unSubY();
      unSubScale();
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [x, y, scale]);

  const margin = () => {
    if (!offset) {
      return { margin: "auto" };
    }

    const style: React.CSSProperties = {};

    if (offset.x != null) {
      style.marginLeft = offset.x + "px";
    } else {
      style.marginLeft = "auto";
      style.marginRight = "auto";
    }

    if (offset.y != null) {
      style.marginTop = offset.y + "px";
    } else {
      style.marginTop = "auto";
      style.marginBottom = "auto";
    }

    return style;
  };

  const inViewport =
    offset &&
    isComponentInViewport({
      offset,
      // NOTE: x and y motion values already represent the translated top-left of the scene
      // in viewport coordinates. They are typically negative when the scene has been panned.
      // Passing the negated values caused all calculations to shift in the wrong direction,
      // making every component appear outside the viewport. Use the raw values.
      sceneX,
      sceneY,
      scale: sceneScale,
      viewportWidth: width,
      viewportHeight: typeof window !== "undefined" ? window.innerHeight : 0,
    });

  // don't show fallback for sufficiently large screens because there is a pixel shift that occurs
  // when switching from the image to the real component, and on larger screens this happens on screen
  // also unlikely to find a weaker device on a 1440p+ screen so performance is less of a concern
  const shouldShowFallback =
    animationStage < 2 && imageFallback && width < 2000;

  return (
    <div
      className="absolute inset-0 z-30 flex"
      style={{
        ...margin(),
        width: offset?.width ? offset.width + "px" : "100vw",
        height: offset?.height ? offset.height + "px" : "100vh",
      }}
    >
      {shouldShowFallback ? (
        <Image
          src={imageFallback}
          alt="Canvas Fallback"
          width={offset?.width ?? 1920}
          height={offset?.height ?? 1080}
          className="m-auto h-auto w-full object-contain"
        />
      ) : (
        (mode === "high" || inViewport) && children
      )}
    </div>
  );
};
