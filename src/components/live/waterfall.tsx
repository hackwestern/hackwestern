import { useEffect, useRef, useState } from "react";

import { drawAsciiWaterfall } from "~/constants/waterfall";

interface WaterfallProps<T extends HTMLElement = HTMLElement> {
  // ----------------------------------------------------------
  // MANUAL MODE (original behavior) — used when coverFit props
  // below are NOT provided. Plain, fixed positioning you set
  // yourself.
  // ----------------------------------------------------------
  width?: string;
  height?: string;
  top?: string;
  left?: string;

  // ----------------------------------------------------------
  // COVER-FIT MODE — used when `containerRef` is provided.
  // Positions the shape at a FIXED PIXEL LOCATION IN THE SOURCE
  // IMAGE FILE, then computes where that lands on screen after
  // the browser's object-cover crop is applied — so it stays
  // correctly anchored to that spot in the photo at ANY
  // container aspect ratio, instead of drifting like a
  // percentage-of-rendered-box would.
  // ----------------------------------------------------------

  // Ref to the container div that holds your <Image>. Waterfall
  // measures THIS element's rendered box (not the image itself)
  // — pass the same div you put object-cover/fill on. Generic
  // over T so it accepts a ref typed to whatever specific
  // element the caller is using (HTMLDivElement, etc.) without
  // a variance mismatch.
  containerRef?: React.RefObject<T | null>;

  // Same src as your background <Image> — used only to read the
  // image's natural (file) pixel dimensions, never rendered.
  backgroundSrc?: string;

  // Must match whatever object-position your <Image> actually
  // uses (e.g. Tailwind's object-right / object-left /
  // object-center). Only the horizontal keyword matters here —
  // vertical is assumed center, matching how a single-keyword
  // CSS object-position value behaves.
  objectPositionX?: "left" | "right" | "center";

  // Where the shape should sit, in the SOURCE IMAGE's own pixel
  // coordinates (open the actual file in an image editor and
  // read these off directly — e.g. "the waterfall streak starts
  // 1200px from the left, 300px from the top, in a 2400x1600
  // source photo"). These numbers never change based on screen
  // size, which is the whole point.
  sourceLeft?: number;
  sourceTop?: number;
  sourceWidth?: number;
  sourceHeight?: number;

  className?: string;
  // Draws a visible red outline/fill instead of the real
  // dither effect — useful for confirming positioning
  // independent of the canvas draw.
  debug?: boolean;
}

export default function Waterfall<T extends HTMLElement = HTMLElement>({
  width = "66px",
  height = "606px",
  top = "10%",
  left = "38px",
  containerRef,
  backgroundSrc,
  objectPositionX = "center",
  sourceLeft = 0,
  sourceTop = 0,
  sourceWidth = 0,
  sourceHeight = 0,
  className = "",
  debug = false,
}: WaterfallProps<T>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const maskImageRef = useRef<HTMLImageElement | null>(null);

  const coverFitMode = Boolean(containerRef);

  // ----------------------------------------------------------
  // COVER-FIT CALCULATION
  // ----------------------------------------------------------

  const [coverFitRect, setCoverFitRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!coverFitMode || !containerRef || !backgroundSrc) {
      return;
    }

    let isMounted = true;

    let naturalWidth = 0;
    let naturalHeight = 0;

    const sizingImage = new Image();

    sizingImage.src = backgroundSrc;

    const recompute = () => {
      const container = containerRef.current;

      if (!container || !naturalWidth || !naturalHeight) {
        return;
      }

      const rect = container.getBoundingClientRect();

      const containerWidth = rect.width;
      const containerHeight = rect.height;

      if (containerWidth === 0 || containerHeight === 0) {
        return;
      }

      // object-cover uses the LARGER of the two ratios, so the
      // image fully covers the box on both axes (and overflows
      // on one of them).
      const scale = Math.max(
        containerWidth / naturalWidth,
        containerHeight / naturalHeight,
      );

      const renderedWidth = naturalWidth * scale;
      const renderedHeight = naturalHeight * scale;

      // Horizontal offset of the rendered image's left edge,
      // relative to the container's left edge. Negative means
      // the image overflows past the container on that side
      // (the part that gets cropped).
      let offsetX: number;

      if (objectPositionX === "left") {
        offsetX = 0;
      } else if (objectPositionX === "right") {
        offsetX = containerWidth - renderedWidth;
      } else {
        offsetX = (containerWidth - renderedWidth) / 2;
      }

      // Vertical is always treated as centered — matches how a
      // single-keyword object-position value (e.g. just
      // "right") leaves the other axis at its default, center.
      const offsetY = (containerHeight - renderedHeight) / 2;

      if (debug && process.env.NODE_ENV !== "production") {
        console.log(
          "Waterfall (debug, cover-fit): container",
          containerWidth,
          "x",
          containerHeight,
          "| natural",
          naturalWidth,
          "x",
          naturalHeight,
          "| scale",
          scale.toFixed(3),
          "| offsetX",
          offsetX.toFixed(1),
          "| offsetY",
          offsetY.toFixed(1),
        );
      }

      setCoverFitRect({
        left: offsetX + sourceLeft * scale,
        top: offsetY + sourceTop * scale,
        width: sourceWidth * scale,
        height: sourceHeight * scale,
      });
    };

    sizingImage.onload = () => {
      if (!isMounted) return;

      naturalWidth = sizingImage.naturalWidth;
      naturalHeight = sizingImage.naturalHeight;

      recompute();
    };

    sizingImage.onerror = () => {
      console.error(
        `Waterfall: failed to load background image at "${backgroundSrc}" for cover-fit sizing.`,
      );
    };

    const resizeObserver = new ResizeObserver(recompute);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      isMounted = false;

      sizingImage.onload = null;
      sizingImage.onerror = null;

      resizeObserver.disconnect();
    };
  }, [
    coverFitMode,
    containerRef,
    backgroundSrc,
    objectPositionX,
    sourceLeft,
    sourceTop,
    sourceWidth,
    sourceHeight,
    debug,
  ]);

  // In cover-fit mode, don't render until the first real
  // measurement comes back — avoids a flash at (0,0).
  const shouldRender = !coverFitMode || coverFitRect !== null;

  // ----------------------------------------------------------
  // CANVAS DRAW LOOP (unchanged from manual mode)
  // ----------------------------------------------------------

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    let animationFrame = 0;
    let isMounted = true;

    const startTime = performance.now();

    const maskImage = new Image();

    maskImage.src = "/landing/waterfall-mask.png";

    maskImage.onload = () => {
      if (isMounted) {
        maskImageRef.current = maskImage;
      }
    };

    maskImage.onerror = () => {
      console.error(
        `Waterfall: failed to load mask image at "${maskImage.src}". Check that waterfall-mask.png is in public/landing/ and the path matches exactly.`,
      );
    };

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;

      const rect = canvas.getBoundingClientRect();

      canvas.width = Math.max(1, Math.round(rect.width * dpr));

      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };

    const animate = () => {
      const now = performance.now();

      const time = (now - startTime) / 1000;

      const dpr = window.devicePixelRatio || 1;

      drawAsciiWaterfall(
        ctx,
        canvas.width,
        canvas.height,
        maskImageRef.current,
        time,
        dpr,
      );

      animationFrame = requestAnimationFrame(animate);
    };

    resizeCanvas();

    const resizeObserver = new ResizeObserver(resizeCanvas);

    resizeObserver.observe(canvas);

    animationFrame = requestAnimationFrame(animate);

    return () => {
      isMounted = false;

      maskImage.onload = null;
      maskImage.onerror = null;

      resizeObserver.disconnect();

      cancelAnimationFrame(animationFrame);
    };
  }, [shouldRender]);

  if (!shouldRender) {
    return null;
  }

  const positionStyle =
    coverFitMode && coverFitRect
      ? {
          left: `${coverFitRect.left}px`,
          top: `${coverFitRect.top}px`,
          width: `${coverFitRect.width}px`,
          height: `${coverFitRect.height}px`,
        }
      : { top, left, width, height };

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute select-none ${className}`}
      style={{
        ...positionStyle,
        ...(debug
          ? {
              outline: "2px solid red",
              backgroundColor: "rgba(255, 0, 0, 0.15)",
            }
          : {}),
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
