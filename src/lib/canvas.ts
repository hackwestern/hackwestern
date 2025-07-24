import { type Point } from "framer-motion";
import { useMemo } from "react";

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
  if (width < 3840) return ScreenSizeEnum.LARGE_DESKTOP;
  return ScreenSizeEnum.HUGE_DESKTOP;
};

export function getSectionPanCoordinates({
  windowDimensions,
  coords,
  targetZoom,
  negative,
}: {
  windowDimensions: { width: number; height: number };
  coords: { x: number; y: number; width: number };
  targetZoom: number;
  negative?: boolean;
}) {
  const { width, height } = windowDimensions;
  // Calculate the center of the section
  const sectionCenterX = coords.x + coords.width / 2;
  const sectionCenterY = coords.y + height / 2;

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
