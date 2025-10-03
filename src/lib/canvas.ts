import { animate, type MotionValue, type Point } from "framer-motion";
import { useMemo } from "react";
import { MAX_DIM_RATIO } from "~/components/canvas/wrapper";
import { type SectionCoordinates } from "~/constants/canvas";

export const canvasWidth = 6000;
export const canvasHeight = 4000;

export const useMemoPoint = (x: number, y: number): Point => {
  return useMemo(() => ({ x, y }), [x, y]);
};

export interface MinimalPointerInput {
  clientX: number;
  clientY: number;
}

export const getDistance = (
  p1: MinimalPointerInput,
  p2: MinimalPointerInput,
) => {
  const dx = p1.clientX - p2.clientX;
  const dy = p1.clientY - p2.clientY;
  return Math.sqrt(dx ** 2 + dy ** 2);
};

export const getMidpoint = (
  p1: MinimalPointerInput,
  p2: MinimalPointerInput,
): Point => {
  return {
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2,
  };
};

export enum ScreenSizeEnum {
  SMALL_MOBILE = "small-mobile",
  MOBILE = "mobile",
  TABLET = "tablet",
  SMALL_DESKTOP = "small-desktop",
  MEDIUM_DESKTOP = "medium-desktop",
  LARGE_DESKTOP = "large-desktop",
  HUGE_DESKTOP = "huge-desktop",
}

export const getScreenSizeEnum = (width: number): ScreenSizeEnum => {
  // iphone 12 pro is 390px, iphone 14 pro max is 430px, SE 3rd gen is 375px
  if (width < 400) return ScreenSizeEnum.SMALL_MOBILE;
  if (width < 768) return ScreenSizeEnum.MOBILE;
  if (width < 1440) return ScreenSizeEnum.TABLET;
  if (width < 1920) return ScreenSizeEnum.SMALL_DESKTOP;
  if (width < 2560) return ScreenSizeEnum.MEDIUM_DESKTOP;
  if (width <= 3440) return ScreenSizeEnum.LARGE_DESKTOP;
  return ScreenSizeEnum.HUGE_DESKTOP;
};

export function getSectionPanCoordinates({
  windowDimensions,
  coords,
  targetZoom,
  negative,
}: {
  windowDimensions: { width: number; height: number };
  coords: { x: number; y: number; width: number; height: number };
  targetZoom: number;
  negative?: boolean;
}) {
  const { width, height } = windowDimensions;
  // Calculate the center of the section
  const sectionCenterX = coords.x + coords.width / 2;
  const sectionCenterY = coords.y + coords.height / 2;

  // Calculate the required pan offset to center the section in the viewport
  const targetX = width / 2 - sectionCenterX * targetZoom;
  const targetY = height / 2 - sectionCenterY * targetZoom;

  if (negative) {
    return {
      x: -targetX,
      y: -targetY,
    };
  }

  return {
    x: targetX,
    y: targetY,
  };
}

const panSpring = {
  visualDuration: 0.34,
  type: "spring",
  stiffness: 200,
  damping: 25,
} as const;

export async function panToOffsetScene(
  offset: Point,
  x: MotionValue<number>,
  y: MotionValue<number>,
  scale: MotionValue<number>,
  newZoom?: number,
  skipAnim?: boolean,
): Promise<void> {
  const anim = skipAnim ? { duration: 0.3 } : panSpring;

  const animX = animate(x, offset.x, anim);
  const animY = animate(y, offset.y, anim);
  const animScale = animate(scale, newZoom ?? 1, anim);
  await Promise.all([animScale, animX, animY]);
}

export const calcInitialBoxWidth = (
  windowWidth: number,
  windowHeight: number,
) => {
  // math CanvasWrapper's bounding box size and compute scale s.t. canvas fits entirely within
  const aspectRatio = 3 / 2;

  const maxWidth = windowWidth * MAX_DIM_RATIO.width;
  const maxHeight = windowHeight * MAX_DIM_RATIO.height;

  let boxWidth, boxHeight;

  if (maxWidth / aspectRatio <= maxHeight) {
    boxWidth = maxWidth;
    boxHeight = boxWidth / aspectRatio;
  } else {
    boxHeight = maxHeight;
    boxWidth = boxHeight * aspectRatio;
  }

  // scale so the canvas fits inside the computed 3:2 box
  return Math.min(boxWidth / canvasWidth, boxHeight / canvasHeight);
};

export const INTERACTIVE_SELECTOR =
  "button,[role='button'],input,textarea,[contenteditable='true']," +
  "[data-toolbar-button],[data-navbar-button]";

export const ZOOM_BOUND = 1.05; // minimum zoom level to prevent zooming out too far
export const MAX_ZOOM = 3;

export const MIN_ZOOMS: Record<ScreenSizeEnum, number> = {
  [ScreenSizeEnum.SMALL_MOBILE]: 0.3,
  [ScreenSizeEnum.MOBILE]: 0.35,
  [ScreenSizeEnum.TABLET]: 0.25,
  [ScreenSizeEnum.SMALL_DESKTOP]: 0.15,
  [ScreenSizeEnum.MEDIUM_DESKTOP]: 0.1,
  [ScreenSizeEnum.LARGE_DESKTOP]: 0.1,
  [ScreenSizeEnum.HUGE_DESKTOP]: 0.1,
} as const;

export const coordinatesToName = (coords: SectionCoordinates) => {
  if (coords === undefined) return "unknown";

  if (coords.x === 1400 && coords.y === 400) return "about";
  if (coords.x === 3663 && coords.y === 400) return "sponsors";
  if (coords.x === 2788 && coords.y === 1200) return "home";
  if (coords.x === 760 && coords.y === 1700) return "projects";
  if (coords.x === 2070 && coords.y === 2600) return "faq";
  if (coords.x === 4050 && coords.y === 1660) return "team";

  return "unknown";
};
